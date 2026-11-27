import React, { useState, useEffect, useCallback } from 'react';
import { UserContext, ValidationItem, ValidationAction } from '../../types';
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  FileText,
  MapPin,
  Lock,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import { buildApiUrl, getStoredAuthToken } from '../../utils/api';

interface ValidationQueueProps {
  currentUser: UserContext;
}

export const ValidationQueue: React.FC<ValidationQueueProps> = ({ currentUser }) => {
  const [items, setItems] = useState<ValidationItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ValidationItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Dialog State for Rejection Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [rejectionComment, setRejectionComment] = useState<string>('');
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  // Dialog State for Return for Correction Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
  const [returnComment, setReturnComment] = useState<string>('');
  const [returnError, setReturnError] = useState<string | null>(null);

  // Role Checks
  const isChefAgents = currentUser.role === 'CHEF_SERVICE';
  const isDirector = currentUser.role === 'DIRECTOR';
  const isAgentTerrain = currentUser.role === 'AGENT_TERRAIN';

  // Fetch validation requests from the backend
  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = getStoredAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const params = new URLSearchParams({ limit: '100' });
      if (filterStatus !== 'ALL') {
        params.append('status', filterStatus);
      }
      if (isChefAgents && currentUser.communeId) {
        params.append('communeId', currentUser.communeId);
      }

      const res = await fetch(buildApiUrl(`/api/v1/validation/requests?${params.toString()}`), {
        headers,
      });

      if (!res.ok) {
        throw new Error('Erreur lors du chargement des dossiers de validation.');
      }

      const payload = await res.json();
      const fetchedItems: ValidationItem[] = payload.data?.items || [];
      setItems(fetchedItems);

      // Keep current selection fresh if already selected
      if (selectedItem) {
        const refreshed = fetchedItems.find((i) => i.id === selectedItem.id);
        if (refreshed) setSelectedItem(refreshed);
      } else if (fetchedItems.length > 0) {
        setSelectedItem(fetchedItems[0]);
      } else {
        setSelectedItem(null);
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Impossible de joindre le serveur pour charger les dossiers.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, isChefAgents, currentUser.communeId, selectedItem?.id]);

  useEffect(() => {
    fetchRequests();
  }, [filterStatus]);

  // Execute transition on backend
  const handleExecuteTransition = async (action: ValidationAction, comment?: string) => {
    if (!selectedItem) return;

    setIsSubmitting(true);
    setFeedbackMessage(null);

    try {
      const token = getStoredAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(buildApiUrl(`/api/v1/validation/requests/${selectedItem.id}/transition`), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action,
          comment: comment ? comment.trim() : undefined,
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok || !payload.success) {
        throw new Error(payload.message || 'La transition de validation a été refusée par le serveur.');
      }

      const updatedRequest: ValidationItem = payload.data;

      // Update state locally & refresh
      setItems((prev) => prev.map((item) => (item.id === updatedRequest.id ? updatedRequest : item)));
      setSelectedItem(updatedRequest);

      // Close modals
      setIsRejectModalOpen(false);
      setRejectionComment('');
      setRejectionError(null);

      setIsReturnModalOpen(false);
      setReturnComment('');
      setReturnError(null);

      const actionLabels: Record<ValidationAction, string> = {
        APPROVE_FINAL: 'Dossier validé avec succès. Titre opérationnel activé.',
        REJECT: 'Dossier rejeté avec motif enregistré.',
        RETURN_FOR_CORRECTION: 'Dossier renvoyé à l agent avec remarques.',
        SUBMIT: 'Dossier soumis.',
        FORWARD_TO_L3: 'Dossier transmis.',
      };

      setFeedbackMessage({
        type: 'success',
        text: actionLabels[action] || `Décision enregistrée (${action}).`,
      });

      // Refetch for synchronized counts
      fetchRequests();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erreur lors de l enregistrement de la décision.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Rejection from Modal
  const handleConfirmRejection = () => {
    const cleanComment = rejectionComment.trim();
    if (!cleanComment || cleanComment.length < 5) {
      setRejectionError('Un motif circonstancié d au moins 5 caractères est obligatoire pour confirmer le rejet.');
      return;
    }
    handleExecuteTransition('REJECT', cleanComment);
  };

  // Submit Return from Modal
  const handleConfirmReturn = () => {
    const cleanComment = returnComment.trim();
    if (!cleanComment || cleanComment.length < 5) {
      setReturnError('Veuillez préciser les motifs et corrections demandées (au moins 5 caractères).');
      return;
    }
    handleExecuteTransition('RETURN_FOR_CORRECTION', cleanComment);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Validation des Dossiers Chauffeurs &amp; Véhicules
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800 uppercase">
              Chef des Agents (L2)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Instruction hiérarchique et approbation directe par le Chef des Agents territorial. Les remarques de rejet ou renvoi sont archivées et notifiées aux agents.
          </p>
        </div>

        <button
          onClick={fetchRequests}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Role Notice Banner */}
      {isDirector && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center space-x-3 text-xs text-amber-900 dark:text-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <span className="font-bold">Consultation Institutionnelle (Directeur Général) :</span> Conformément aux directives ministérielles, la validation finale des chauffeurs et véhicules est attribuée au <strong>Chef des Agents</strong>. Vous disposez d un accès complet en consultation sur l ensemble du registre national.
          </div>
        </div>
      )}

      {isAgentTerrain && (
        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center space-x-3 text-xs text-blue-900 dark:text-blue-200">
          <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <div>
            <span className="font-bold">Suivi d Instruction :</span> En tant qu agent enrôleur, vous pouvez consulter le statut de vos dossiers soumis. Si un dossier est rejeté ou retourné pour correction par votre Chef des Agents, son motif apparaît en rouge ci-dessous.
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { id: 'ALL', label: 'Tous les dossiers' },
          { id: 'SOUMIS_NIVEAU2', label: 'En attente Chef des Agents' },
          { id: 'VALIDE', label: 'Validés' },
          { id: 'REJETE', label: 'Rejetés' },
          { id: 'RETOURNE_POUR_CORRECTION', label: 'À corriger' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-3.5 py-2 rounded-xl font-bold transition cursor-pointer ${
              filterStatus === tab.id
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-200 border-red-200 dark:border-red-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span className="font-semibold">{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Left List (5 Cols) + Right Inspector Pane (7 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">
        {/* Left Dossiers List */}
        <div className="lg:col-span-5 space-y-3 min-w-0">
          {isLoading && items.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-slate-400" />
              Chargement des dossiers d instruction...
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <FileText className="w-8 h-8 mx-auto mb-2 stroke-1 text-slate-300 dark:text-slate-600" />
              Aucun dossier dans cette catégorie.
            </div>
          ) : (
            items.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const isRejected = item.status === 'REJETE';
              const isReturned = item.status === 'RETOURNE_POUR_CORRECTION';
              const isValidated = item.status === 'VALIDE';

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedItem(item);
                    setFeedbackMessage(null);
                  }}
                  className={`p-4 bg-white dark:bg-slate-800 border rounded-2xl cursor-pointer transition shadow-xs min-w-0 ${
                    isSelected
                      ? 'border-slate-900 dark:border-slate-300 ring-2 ring-slate-900/10 dark:ring-slate-400/20'
                      : 'border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center space-x-2 truncate">
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                        {item.requestNumber}
                      </span>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-extrabold uppercase">
                        {item.entityType === 'DRIVER_ENROLMENT'
                          ? 'CHAUFFEUR'
                          : item.entityType === 'VEHICLE_ENROLMENT'
                          ? 'VÉHICULE'
                          : 'PROPRIÉTAIRE'}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                        isValidated
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : isRejected
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                          : isReturned
                          ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300'
                      }`}
                    >
                      {item.status === 'VALIDE'
                        ? 'VALIDÉ'
                        : item.status === 'REJETE'
                        ? 'REJETÉ'
                        : item.status === 'RETOURNE_POUR_CORRECTION'
                        ? 'À CORRIGER'
                        : 'EN ATTENTE CHEF'}
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {item.applicantName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono">
                      {item.targetDetails}
                    </div>
                  </div>

                  {/* Rejection Snippet Preview */}
                  {(isRejected || isReturned) && item.history?.[0]?.comment && (
                    <div className="mt-2 p-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg text-[11px] text-rose-800 dark:text-rose-300 truncate">
                      <span className="font-bold">Motif :</span> « {item.history[0].comment} »
                    </div>
                  )}

                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center space-x-1 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{item.communeName}</span>
                    </div>
                    <span className="shrink-0">{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('fr-FR') : ''}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Inspector & Decision Desk (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-xs min-w-0">
          {selectedItem ? (
            <div className="space-y-6 min-w-0">
              {/* Dossier Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-700">
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white truncate">
                      {selectedItem.applicantName}
                    </h2>
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 shrink-0">
                      ({selectedItem.requestNumber})
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    Tél : <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{selectedItem.applicantPhone}</span> • Soumis par <span className="font-semibold">{selectedItem.submitterName}</span>
                  </p>
                </div>

                <div className="sm:text-right shrink-0">
                  <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
                    Palier d Instruction
                  </div>
                  <div className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 inline-block mt-0.5">
                    Chef des Agents (N2)
                  </div>
                </div>
              </div>

              {/* Prominent Rejection Banner if Rejected or Returned */}
              {(selectedItem.status === 'REJETE' || selectedItem.status === 'RETOURNE_POUR_CORRECTION') && (
                <div className="p-4 rounded-xl border bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 space-y-2">
                  <div className="flex items-center space-x-2 text-rose-900 dark:text-rose-200 font-bold text-xs uppercase tracking-wide">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>
                      {selectedItem.status === 'REJETE'
                        ? 'Dossier Rejeté Définitivement'
                        : 'Dossier Renvoyé pour Correction'}
                    </span>
                  </div>

                  {selectedItem.history?.[0]?.comment ? (
                    <div className="p-3 bg-white dark:bg-slate-900/80 rounded-lg border border-rose-100 dark:border-rose-900/60 text-xs">
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mb-1">
                        Motif consigné par <span className="font-bold text-slate-800 dark:text-slate-200">{selectedItem.history[0].reviewerName}</span> le {selectedItem.history[0].timestamp} :
                      </div>
                      <div className="text-rose-950 dark:text-rose-200 font-medium italic">
                        « {selectedItem.history[0].comment} »
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-rose-800 dark:text-rose-300 italic">
                      Aucun motif textuel n a été archivé pour cette décision.
                    </div>
                  )}

                  <p className="text-[11px] text-rose-700 dark:text-rose-400">
                    {selectedItem.status === 'REJETE'
                      ? 'L entité rattachée à ce dossier est actuellement INACTIVE dans le système officiel.'
                      : 'L agent enrôleur doit corriger les pièces ou données signalées et soumettre à nouveau le dossier.'}
                  </p>
                </div>
              )}

              {/* Uploaded Documents List */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Pièces Justificatives Biométriques</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    {selectedItem.documents?.length || 0} document(s)
                  </span>
                </div>

                {selectedItem.documents && selectedItem.documents.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedItem.documents.map((doc, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2 truncate min-w-0">
                          <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span className="truncate text-slate-800 dark:text-slate-200 font-medium">
                            {doc.label}
                          </span>
                        </div>
                        {doc.url && doc.url !== '#' ? (
                          <a
                            href={buildApiUrl(doc.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1 shrink-0"
                            title="Ouvrir la pièce dans un nouvel onglet"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400">Non téléversé</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-400 text-center">
                    Aucun document physique numérisé joint à ce dossier.
                  </div>
                )}
              </div>

              {/* Chronological History Steps */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Traçabilité &amp; Historique des Décisions
                </div>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900/50 space-y-3">
                  {selectedItem.history && selectedItem.history.length > 0 ? (
                    selectedItem.history.map((step, idx) => (
                      <div key={idx} className="text-xs flex items-start space-x-2.5">
                        <div
                          className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                            step.action === 'APPROVE_FINAL'
                              ? 'bg-emerald-500'
                              : step.action === 'REJECT'
                              ? 'bg-rose-500'
                              : step.action === 'RETURN_FOR_CORRECTION'
                              ? 'bg-orange-500'
                              : 'bg-blue-500'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {step.reviewerName}{' '}
                            <span className="text-slate-500 dark:text-slate-400 font-normal">
                              ({step.role})
                            </span>{' '}
                            —{' '}
                            <span
                              className={`font-black ${
                                step.action === 'APPROVE_FINAL'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : step.action === 'REJECT'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : step.action === 'RETURN_FOR_CORRECTION'
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : 'text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              {step.action}
                            </span>
                          </div>
                          {step.comment && (
                            <div className="p-2 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 italic">
                              « {step.comment} »
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {step.timestamp}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 text-center py-2">
                      Dossier en attente d instruction initiale par le Chef des Agents.
                    </div>
                  )}
                </div>
              </div>

              {/* Decision Action Bar (Role-Aware) */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Décision Administrative
                </div>

                {/* Chef des Agents Execution Buttons */}
                {isChefAgents ? (
                  selectedItem.status === 'SOUMIS_NIVEAU2' ||
                  selectedItem.status === 'EN_ATTENTE_NIVEAU3' ? (
                    <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
                      {/* Approve Button */}
                      <button
                        onClick={() => handleExecuteTransition('APPROVE_FINAL')}
                        disabled={isSubmitting}
                        className="flex-1 min-h-[44px] justify-center flex items-center space-x-1.5 bg-[#009460] hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Valider Définitivement (Activer Titre)</span>
                      </button>

                      {/* Return for Correction Button */}
                      <button
                        onClick={() => {
                          setReturnError(null);
                          setReturnComment('');
                          setIsReturnModalOpen(true);
                        }}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto min-h-[44px] justify-center flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Renvoyer pour Correction</span>
                      </button>

                      {/* Reject Button */}
                      <button
                        onClick={() => {
                          setRejectionError(null);
                          setRejectionComment('');
                          setIsRejectModalOpen(true);
                        }}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto min-h-[44px] justify-center flex items-center space-x-1.5 bg-[#CE1126] hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Rejeter avec Remarque</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-xl text-xs text-slate-600 dark:text-slate-400">
                      Ce dossier a déjà été statué (Statut actuel : <strong>{selectedItem.status}</strong>).
                    </div>
                  )
                ) : isDirector ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-900 dark:text-amber-200">
                    <span className="font-bold">Information Direction Générale :</span> Les boutons de validation et rejet des dossiers chauffeurs/véhicules sont désactivés pour le Directeur Général conformément au transfert de responsabilité vers le Chef des Agents.
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 p-3 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-xl text-xs">
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      Mode Consultation : Votre rôle ({currentUser.roleLabel}) ne dispose pas des pouvoirs de validation sur ce dossier.
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
              <FileText className="w-10 h-10 mb-2 stroke-1 text-slate-300 dark:text-slate-600" />
              <span>Sélectionnez un dossier dans la liste de gauche pour afficher l instruction.</span>
            </div>
          )}
        </div>
      </div>

      {/* REJECTION MODAL WITH MANDATORY REMARK */}
      {isRejectModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Rejeter le Dossier d Enrôlement
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Dossier : <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{selectedItem.requestNumber}</span> ({selectedItem.applicantName})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Veuillez saisir une explication claire et précise détaillant la non-conformité. Cette remarque sera <strong>conservée en base de données</strong> et affichée à l agent enrôleur.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Remarque Officielle de Rejet (Obligatoire)
              </label>
              <textarea
                rows={4}
                value={rejectionComment}
                onChange={(e) => {
                  setRejectionComment(e.target.value);
                  setRejectionError(null);
                }}
                placeholder="Ex : Document de visite technique expiré. Le numéro de châssis relevé sur la carte grise ne correspond pas à la photo du véhicule..."
                className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#CE1126]"
              />
              <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                <span>Minimum 5 caractères requis.</span>
                <span>{rejectionComment.trim().length} caractère(s)</span>
              </div>
              {rejectionError && (
                <div className="text-xs text-red-600 dark:text-red-400 font-bold mt-1.5 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{rejectionError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectionComment('');
                  setRejectionError(null);
                }}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmRejection}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-[#CE1126] hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition disabled:opacity-50 cursor-pointer shadow-md shadow-red-500/20"
              >
                {isSubmitting ? (
                  <span>Enregistrement...</span>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>Confirmer le Rejet</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RETURN FOR CORRECTION MODAL WITH MANDATORY REMARK */}
      {isReturnModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Renvoyer le Dossier pour Correction
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Dossier : <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{selectedItem.requestNumber}</span> ({selectedItem.applicantName})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Précisez à l agent enrôleur les pièces ou informations à rectifier. Le dossier repassera en statut <strong>À CORRIGER</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Remarques &amp; Corrections Attendues (Obligatoire)
              </label>
              <textarea
                rows={4}
                value={returnComment}
                onChange={(e) => {
                  setReturnComment(e.target.value);
                  setReturnError(null);
                }}
                placeholder="Ex : La photo du permis est floue ou illisible. Veuillez re-scanner le recto et vérifier la date de validité..."
                className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                <span>Minimum 5 caractères requis.</span>
                <span>{returnComment.trim().length} caractère(s)</span>
              </div>
              {returnError && (
                <div className="text-xs text-red-600 dark:text-red-400 font-bold mt-1.5 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{returnError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsReturnModalOpen(false);
                  setReturnComment('');
                  setReturnError(null);
                }}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmReturn}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition disabled:opacity-50 cursor-pointer shadow-md shadow-amber-500/20"
              >
                {isSubmitting ? (
                  <span>Envoi...</span>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Renvoyer à l Agent</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidationQueue;
