import { buildApiUrl, getStoredAuthToken } from './api';
import {
  DecryptedDraft,
  getPendingAgentDrafts,
  getRegisteredDeviceId,
  listAgentDrafts,
  StoredDocument,
  updateDraftStatus,
} from './offlineStore';

export interface SyncManagerStats {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  lastSyncSummary: string | null;
  lastSyncError: string | null;
}

export type SyncListener = (stats: SyncManagerStats) => void;

class OfflineSyncManager {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private lastSyncAt: string | null = null;
  private lastSyncSummary: string | null = null;
  private lastSyncError: string | null = null;
  private currentAgentUserId: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private heartbeatIntervalId: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));

      // Periodic connectivity heartbeat to ensure actual internet reachability
      this.heartbeatIntervalId = setInterval(() => {
        this.probeConnectivity();
      }, 30000);
    }
  }

  public setAgentUserId(agentUserId: string | null) {
    if (this.currentAgentUserId !== agentUserId) {
      this.currentAgentUserId = agentUserId;
      this.notifyListeners();
    }
  }

  public getStats(pendingCount: number = 0): SyncManagerStats {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount,
      lastSyncAt: this.lastSyncAt,
      lastSyncSummary: this.lastSyncSummary,
      lastSyncError: this.lastSyncError,
    };
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notifyListeners() {
    if (this.listeners.size === 0) return;
    this.getPendingCount().then((count) => {
      const stats = this.getStats(count);
      this.listeners.forEach((fn) => {
        try {
          fn(stats);
        } catch (_) {}
      });
    });
  }

  public async getPendingCount(): Promise<number> {
    if (!this.currentAgentUserId) return 0;
    try {
      const drafts = await listAgentDrafts(this.currentAgentUserId);
      return drafts.filter((d) => d.syncStatus === 'PENDING' || d.syncStatus === 'FAILED').length;
    } catch (_) {
      return 0;
    }
  }

  public async probeConnectivity(): Promise<boolean> {
    if (typeof window === 'undefined') return true;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(buildApiUrl('/api/v1/health'), {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const reachable = res.status >= 200 && res.status < 500;
      this.handleNetworkChange(reachable);
      return reachable;
    } catch (_) {
      this.handleNetworkChange(false);
      return false;
    }
  }

  private handleNetworkChange(online: boolean) {
    const wasOffline = !this.isOnline;
    this.isOnline = online;

    if (wasOffline && online) {
      // Reconnected: trigger auto-sync for pending drafts
      this.syncPendingDrafts();
    } else {
      this.notifyListeners();
    }
  }

  /**
   * Converts stored binary Blobs/ArrayBuffers into Base64 for the sync API contract.
   */
  private async formatInlineDocument(doc: StoredDocument): Promise<any> {
    let base64 = doc.base64Data || '';

    if (!base64 && doc.blob) {
      base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(doc.blob!);
      });
    } else if (!base64 && doc.arrayBuffer) {
      let binary = '';
      const bytes = new Uint8Array(doc.arrayBuffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64 = `data:${doc.mimeType || 'image/jpeg'};base64,${btoa(binary)}`;
    }

    return {
      category: doc.category,
      originalName: doc.originalName || `${doc.category.toLowerCase()}.jpg`,
      mimeType: doc.mimeType || 'image/jpeg',
      base64Data: base64,
      fileHashSha256: doc.fileHashSha256 || null,
    };
  }

  /**
   * Main synchronization routine: sends all pending drafts for the current agent to /api/v1/sync/push.
   */
  public async syncPendingDrafts(): Promise<{
    success: boolean;
    total: number;
    synced: number;
    failed: number;
    message: string;
  }> {
    if (this.isSyncing) {
      return {
        success: false,
        total: 0,
        synced: 0,
        failed: 0,
        message: 'Une synchronisation est déjà en cours.',
      };
    }

    if (!this.currentAgentUserId) {
      return {
        success: false,
        total: 0,
        synced: 0,
        failed: 0,
        message: 'Aucun utilisateur connecté pour la synchronisation.',
      };
    }

    const token = getStoredAuthToken();
    if (!token) {
      this.lastSyncError = 'Session expirée. Veuillez vous reconnecter pour synchroniser.';
      this.notifyListeners();
      return {
        success: false,
        total: 0,
        synced: 0,
        failed: 0,
        message: 'Session expirée. Veuillez vous reconnecter.',
      };
    }

    this.isSyncing = true;
    this.lastSyncError = null;
    this.notifyListeners();

    try {
      const pendingDrafts: DecryptedDraft[] = await getPendingAgentDrafts(this.currentAgentUserId);

      if (pendingDrafts.length === 0) {
        this.isSyncing = false;
        this.lastSyncSummary = 'Aucun enregistrement en attente.';
        this.notifyListeners();
        return {
          success: true,
          total: 0,
          synced: 0,
          failed: 0,
          message: 'Aucun enregistrement en attente de synchronisation.',
        };
      }

      // Mark drafts as SYNCING in IndexedDB
      for (const item of pendingDrafts) {
        await updateDraftStatus(item.draft.clientGeneratedId, 'SYNCING');
      }
      this.notifyListeners();

      // Format items with converted inline documents
      const itemsPayload = [];
      for (const item of pendingDrafts) {
        const formattedDocs = [];
        if (Array.isArray(item.draft.documents) && item.draft.documents.length > 0) {
          for (const doc of item.draft.documents) {
            try {
              const formatted = await this.formatInlineDocument(doc);
              if (formatted.base64Data) {
                formattedDocs.push(formatted);
              }
            } catch (docErr) {
              console.warn(`Could not format document for draft ${item.draft.clientGeneratedId}:`, docErr);
            }
          }
        }

        itemsPayload.push({
          clientGeneratedId: item.draft.clientGeneratedId,
          entityType: item.draft.entityType,
          createdOfflineAt: item.draft.createdAt,
          payload: {
            ...item.payload,
            documents: formattedDocs,
          },
        });
      }

      const deviceId = getRegisteredDeviceId();
      const response = await fetch(buildApiUrl('/api/v1/sync/push'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Device-Id': deviceId,
        },
        body: JSON.stringify({
          deviceId,
          items: itemsPayload,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(
          errorBody?.message ||
            `Le serveur a répondu avec l'erreur HTTP ${response.status} lors de la synchronisation.`
        );
      }

      const syncResult = await response.json();
      const report = syncResult?.data;
      const results: any[] = Array.isArray(report?.results) ? report.results : [];

      let syncedCount = 0;
      let failedCount = 0;

      for (const item of pendingDrafts) {
        const matched = results.find((r) => r.clientGeneratedId === item.draft.clientGeneratedId);

        if (matched) {
          if (
            matched.status === 'SUCCESS' ||
            matched.status === 'ALREADY_SYNCED' ||
            matched.status === 'DUPLICATE'
          ) {
            await updateDraftStatus(item.draft.clientGeneratedId, 'SYNCED', {
              serverRecordId: matched.serverRecordId || matched.personId || null,
            });
            syncedCount++;
          } else if (matched.status === 'CONFLICT') {
            await updateDraftStatus(item.draft.clientGeneratedId, 'CONFLICT', {
              errorMessage: matched.message || 'Conflit détecté avec un enregistrement existant.',
              conflictDetails: matched,
            });
            failedCount++;
          } else {
            await updateDraftStatus(item.draft.clientGeneratedId, 'FAILED', {
              errorMessage: matched.error || matched.message || 'Échec de synchronisation.',
              incrementRetry: true,
            });
            failedCount++;
          }
        } else {
          // If no specific result for this item, keep as PENDING
          await updateDraftStatus(item.draft.clientGeneratedId, 'PENDING', {
            incrementRetry: true,
          });
          failedCount++;
        }
      }

      this.isOnline = true;
      this.lastSyncAt = new Date().toISOString();
      this.lastSyncSummary = `${syncedCount} synchronisé(s), ${failedCount} échec(s) / conflit(s)`;

      return {
        success: failedCount === 0,
        total: pendingDrafts.length,
        synced: syncedCount,
        failed: failedCount,
        message: this.lastSyncSummary,
      };
    } catch (err: any) {
      console.error('Offline synchronization failed:', err);

      // Revert SYNCING drafts back to PENDING so they can be retried
      if (this.currentAgentUserId) {
        const allDrafts = await listAgentDrafts(this.currentAgentUserId);
        for (const draft of allDrafts) {
          if (draft.syncStatus === 'SYNCING') {
            await updateDraftStatus(draft.clientGeneratedId, 'PENDING', {
              incrementRetry: true,
            });
          }
        }
      }

      const isNetworkIssue =
        err?.name === 'TypeError' ||
        err?.message?.includes('fetch') ||
        err?.message?.includes('Network');
      if (isNetworkIssue) {
        this.isOnline = false;
      }

      this.lastSyncError = err?.message || 'Erreur réseau lors de la synchronisation.';
      return {
        success: false,
        total: 0,
        synced: 0,
        failed: 1,
        message: this.lastSyncError || 'Erreur de synchronisation.',
      };
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  public destroy() {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
    }
    this.listeners.clear();
  }
}

export const syncManager = new OfflineSyncManager();
