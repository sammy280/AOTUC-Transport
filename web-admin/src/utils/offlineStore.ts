import { encryptOfflineData, decryptOfflineData, EncryptedPayload } from './offlineCrypto';

export type OfflineEntityType =
  | 'DRIVER'
  | 'VEHICLE'
  | 'OWNER'
  | 'UNION'
  | 'DOCUMENT'
  | 'FIELD_INSPECTION'
  | 'MISSION_REPORT';
export type OfflineSyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT' | 'DUPLICATE';

export interface StoredDocument {
  category: string;
  originalName: string;
  mimeType: string;
  blob?: Blob;
  arrayBuffer?: ArrayBuffer;
  base64Data?: string;
  fileHashSha256?: string;
}

export interface OfflineDraftRecord {
  clientGeneratedId: string;
  agentUserId: string;
  agentName: string;
  deviceId: string;
  entityType: OfflineEntityType;
  encryptedPayload: EncryptedPayload;
  documents: StoredDocument[];
  summary: {
    title: string;
    subtitle: string;
    commune?: string | null;
    referenceCode?: string | null;
  };
  createdAt: string;
  updatedAt: string;
  syncStatus: OfflineSyncStatus;
  retryCount: number;
  serverRecordId?: string | null;
  errorMessage?: string | null;
  conflictDetails?: any;
}

export interface DecryptedDraft {
  draft: OfflineDraftRecord;
  payload: any;
}

const DB_NAME = 'aotuc_web_offline_db';
const DB_VERSION = 2;
export const STORE_DRAFTS = 'offline_drafts';
export const STORE_CACHE = 'reference_cache';
export const STORE_ENROLLED_USERS = 'enrolled_users';
export const STORE_DEVICE_BINDING = 'device_binding';

let dbPromise: Promise<IDBDatabase> | null = null;

function getIndexedDB(): IDBFactory {
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).indexedDB) {
    return (globalThis as any).indexedDB;
  }
  throw new Error('IndexedDB is not supported in this runtime environment.');
}

export function openOfflineDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const idb = getIndexedDB();
      const request = idb.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Offline drafts table
        if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
          const draftsStore = db.createObjectStore(STORE_DRAFTS, { keyPath: 'clientGeneratedId' });
          draftsStore.createIndex('agentUserId', 'agentUserId', { unique: false });
          draftsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          draftsStore.createIndex('entityType', 'entityType', { unique: false });
          draftsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 2. Reference data cache (Communes, Unions, Owners)
        if (!db.objectStoreNames.contains(STORE_CACHE)) {
          db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
        }

        // 3. Enrolled users for offline login (Phase 2 & 3)
        if (!db.objectStoreNames.contains(STORE_ENROLLED_USERS)) {
          const userStore = db.createObjectStore(STORE_ENROLLED_USERS, { keyPath: 'userId' });
          userStore.createIndex('identifierHash', 'identifierHash', { unique: true });
          userStore.createIndex('identifier', 'identifier', { unique: false });
        }

        // 4. Device cryptographic binding (Phase 2)
        if (!db.objectStoreNames.contains(STORE_DEVICE_BINDING)) {
          db.createObjectStore(STORE_DEVICE_BINDING, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error || new Error('Failed to open IndexedDB database.'));
      };
      request.onblocked = () => {
        console.warn('AOTUC IndexedDB upgrade blocked by open connections in other tabs.');
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
}

export function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Gets or creates a persistent registered device identifier for this browser instance.
 */
export function getRegisteredDeviceId(): string {
  const DEVICE_STORAGE_KEY = 'aotuc_web_registered_device_id';
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'web-default-device';
  }

  let id = localStorage.getItem(DEVICE_STORAGE_KEY);
  if (!id) {
    id = `web-${generateUuidV4()}`;
    try {
      localStorage.setItem(DEVICE_STORAGE_KEY, id);
    } catch (_) {}
  }
  return id;
}

/**
 * Saves a new or updated draft into IndexedDB with AES-256-GCM encryption.
 */
export async function saveOfflineDraft(input: {
  clientGeneratedId?: string;
  agentUserId: string;
  agentName: string;
  entityType: OfflineEntityType;
  payload: any;
  documents?: StoredDocument[];
  summary: {
    title: string;
    subtitle: string;
    commune?: string | null;
    referenceCode?: string | null;
  };
}): Promise<OfflineDraftRecord> {
  const db = await openOfflineDatabase();
  const clientGeneratedId = input.clientGeneratedId || generateUuidV4();

  // Encrypt payload containing citizen PII
  const encryptedPayload = await encryptOfflineData(input.payload);
  const now = new Date().toISOString();

  const record: OfflineDraftRecord = {
    clientGeneratedId,
    agentUserId: input.agentUserId,
    agentName: input.agentName,
    deviceId: getRegisteredDeviceId(),
    entityType: input.entityType,
    encryptedPayload,
    documents: input.documents || [],
    summary: input.summary,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'PENDING',
    retryCount: 0,
    serverRecordId: null,
    errorMessage: null,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    const store = tx.objectStore(STORE_DRAFTS);
    const putReq = store.put(record);

    putReq.onsuccess = () => resolve(record);
    putReq.onerror = () => reject(putReq.error || new Error('Failed to save offline draft to IndexedDB.'));
  });
}

/**
 * Retrieves a single draft by client ID and decrypts its payload.
 * Strictly verifies agentUserId ownership for multi-agent isolation.
 */
export async function getOfflineDraftDecrypted(
  clientGeneratedId: string,
  agentUserId: string
): Promise<DecryptedDraft | null> {
  const db = await openOfflineDatabase();

  const record = await new Promise<OfflineDraftRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFTS, 'readonly');
    const store = tx.objectStore(STORE_DRAFTS);
    const getReq = store.get(clientGeneratedId);

    getReq.onsuccess = () => resolve((getReq.result as OfflineDraftRecord) || null);
    getReq.onerror = () => reject(getReq.error);
  });

  if (!record || record.agentUserId !== agentUserId) {
    return null;
  }

  const payload = await decryptOfflineData(record.encryptedPayload);
  return { draft: record, payload };
}

/**
 * Lists all drafts for the authenticated agent (sorted by newest first).
 * Does not decrypt payloads immediately for fast UI rendering.
 */
export async function listAgentDrafts(agentUserId: string): Promise<OfflineDraftRecord[]> {
  const db = await openOfflineDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFTS, 'readonly');
    const store = tx.objectStore(STORE_DRAFTS);
    const index = store.index('agentUserId');
    const req = index.getAll(agentUserId);

    req.onsuccess = () => {
      const records = (req.result as OfflineDraftRecord[]) || [];
      records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(records);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves all pending/retryable drafts for the authenticated agent, decrypted for synchronization.
 */
export async function getPendingAgentDrafts(agentUserId: string): Promise<DecryptedDraft[]> {
  const allDrafts = await listAgentDrafts(agentUserId);
  const pendingOrFailed = allDrafts.filter(
    (d) => d.syncStatus === 'PENDING' || d.syncStatus === 'FAILED'
  );

  const decryptedList: DecryptedDraft[] = [];
  for (const draft of pendingOrFailed) {
    try {
      const payload = await decryptOfflineData(draft.encryptedPayload);
      decryptedList.push({ draft, payload });
    } catch (err) {
      console.error(`Failed to decrypt draft ${draft.clientGeneratedId}:`, err);
    }
  }

  return decryptedList;
}

/**
 * Updates the sync status and server record ID of a draft.
 */
export async function updateDraftStatus(
  clientGeneratedId: string,
  status: OfflineSyncStatus,
  updates?: {
    serverRecordId?: string | null;
    errorMessage?: string | null;
    conflictDetails?: any;
    incrementRetry?: boolean;
  }
): Promise<void> {
  const db = await openOfflineDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    const store = tx.objectStore(STORE_DRAFTS);
    const getReq = store.get(clientGeneratedId);

    getReq.onsuccess = () => {
      const record = getReq.result as OfflineDraftRecord;
      if (!record) {
        return resolve();
      }

      record.syncStatus = status;
      record.updatedAt = new Date().toISOString();
      if (updates?.serverRecordId !== undefined) {
        record.serverRecordId = updates.serverRecordId;
      }
      if (updates?.errorMessage !== undefined) {
        record.errorMessage = updates.errorMessage;
      }
      if (updates?.conflictDetails !== undefined) {
        record.conflictDetails = updates.conflictDetails;
      }
      if (updates?.incrementRetry) {
        record.retryCount = (record.retryCount || 0) + 1;
      }

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Deletes a draft from IndexedDB (strictly verifying agent ownership).
 */
export async function deleteOfflineDraft(
  clientGeneratedId: string,
  agentUserId: string
): Promise<boolean> {
  const db = await openOfflineDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    const store = tx.objectStore(STORE_DRAFTS);
    const getReq = store.get(clientGeneratedId);

    getReq.onsuccess = () => {
      const record = getReq.result as OfflineDraftRecord;
      if (!record) return resolve(false);
      if (record.agentUserId !== agentUserId) {
        return reject(new Error('Interdit : Vous ne pouvez pas supprimer les enregistrements d un autre agent.'));
      }

      const delReq = store.delete(clientGeneratedId);
      delReq.onsuccess = () => resolve(true);
      delReq.onerror = () => reject(delReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Saves reference datasets (communes, unions, owners) to IndexedDB cache for offline form rendering.
 */
export async function cacheReferenceData(key: string, data: any): Promise<void> {
  const db = await openOfflineDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readwrite');
    const store = tx.objectStore(STORE_CACHE);
    const putReq = store.put({
      key,
      data,
      cachedAt: new Date().toISOString(),
    });

    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error);
  });
}

/**
 * Retrieves cached reference datasets from IndexedDB.
 */
export async function getCachedReferenceData<T = any>(key: string): Promise<T | null> {
  const db = await openOfflineDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readonly');
    const store = tx.objectStore(STORE_CACHE);
    const getReq = store.get(key);

    getReq.onsuccess = () => {
      const result = getReq.result;
      resolve(result ? (result.data as T) : null);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}
