import React from 'react';
import {
  X,
  RefreshCw,
  CloudUpload,
  User,
  Car,
  Briefcase,
  Building2,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { OfflineDraftRecord } from '../../utils/offlineStore';

interface OfflineQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  drafts: OfflineDraftRecord[];
  isSyncing: boolean;
  isOnline: boolean;
  onTriggerSync: () => void;
  onDeleteDraft: (clientGeneratedId: string) => void;
  onClearSynced: () => void;
}

export const OfflineQueueModal: React.FC<OfflineQueueModalProps> = ({
  isOpen,
  onClose,
  drafts,
  isSyncing,
  isOnline,
  onTriggerSync,
  onDeleteDraft,
  onClearSynced,
}) => {
  if (!isOpen) return null;

  const pendingCount = drafts.filter((d) => d.syncStatus === 'PENDING').length;
  const syncedCount = drafts.filter((d) => d.syncStatus === 'SYNCED').length;
  const failedCount = drafts.filter((d) => d.syncStatus === 'FAILED' || d.syncStatus === 'CONFLICT').length;

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'DRIVER':
        return <User className="w-4 h-4 text-emerald-600" />;
      case 'VEHICLE':
        return <Car className="w-4 h-4 text-blue-600" />;
      case 'OWNER':
        return <Briefcase className="w-4 h-4 text-purple-600" />;
      case 'UNION':
        return <Building2 className="w-4 h-4 text-amber-600" />;
      default:
        return <User className="w-4 h-4 text-slate-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 mr-1" />
            En attente
          </span>
        );
      case 'SYNCING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 animate-pulse">
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            Synchronisation...
          </span>
        );
      case 'SYNCED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Synchronisé
          </span>
        );
      case 'CONFLICT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Conflit
          </span>
        );
      case 'FAILED':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-orange-100 text-orange-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Échec
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-base">File d'Attente d'Enrôlement Hors-Ligne</h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isOnline ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {isOnline ? (
                    <>
                      <Wifi className="w-2.5 h-2.5 mr-1" />
                      En Ligne
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-2.5 h-2.5 mr-1" />
                      Hors Ligne
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Chiffrement local AES-256-GCM • Isolation stricte par terminal et agent
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security & Isolation Notice */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Les données sensibles et photos sont chiffrées localement dans IndexedDB. Aucun autre utilisateur sur ce navigateur ne peut y accéder.
            </span>
          </div>

          <div className="flex items-center space-x-3 font-semibold shrink-0">
            <span className="text-amber-700">{pendingCount} en attente</span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700">{syncedCount} synchronisé(s)</span>
            {failedCount > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-red-700">{failedCount} erreur(s)</span>
              </>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {drafts.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CloudUpload className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">Aucun enregistrement dans la file locale</p>
              <p className="text-xs mt-1 text-slate-400">
                Lorsque vous enregistrez un chauffeur ou un véhicule sans connexion, le dossier apparaîtra ici.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((draft) => (
                <div
                  key={draft.clientGeneratedId}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-slate-100 rounded-lg mt-0.5">
                        {getEntityIcon(draft.entityType)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {draft.entityType === 'DRIVER'
                              ? 'Chauffeur'
                              : draft.entityType === 'VEHICLE'
                              ? 'Véhicule'
                              : draft.entityType === 'OWNER'
                              ? 'Propriétaire'
                              : 'Syndicat'}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">{draft.summary.title}</h4>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{draft.summary.subtitle}</p>

                        <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-2">
                          <span>Commune : <strong className="text-slate-600">{draft.summary.commune || 'Non spécifiée'}</strong></span>
                          <span>•</span>
                          <span>Enregistré le : {new Date(draft.createdAt).toLocaleString('fr-FR')}</span>
                          <span>•</span>
                          <span>{draft.documents.length} document(s)/photo(s)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end space-y-2 shrink-0">
                      {getStatusBadge(draft.syncStatus)}

                      <button
                        type="button"
                        onClick={() => onDeleteDraft(draft.clientGeneratedId)}
                        disabled={draft.syncStatus === 'SYNCING'}
                        className="text-xs text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Supprimer cet enregistrement local"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {draft.errorMessage && (
                    <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{draft.errorMessage}</span>
                    </div>
                  )}

                  {draft.serverRecordId && draft.syncStatus === 'SYNCED' && (
                    <div className="mt-2 text-[11px] text-emerald-700 font-semibold">
                      ID Serveur PostgreSQL : {draft.serverRecordId}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            {syncedCount > 0 && (
              <button
                type="button"
                onClick={onClearSynced}
                className="text-xs text-slate-600 hover:text-slate-900 font-bold hover:underline"
              >
                Vider les dossiers synchronisés ({syncedCount})
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              Fermer
            </button>

            <button
              type="button"
              onClick={onTriggerSync}
              disabled={isSyncing || pendingCount === 0 || !isOnline}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm flex items-center space-x-2 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing
                  ? 'Synchronisation en cours...'
                  : !isOnline
                  ? 'Hors-Ligne (Non disponible)'
                  : `Synchroniser maintenant (${pendingCount})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineQueueModal;
