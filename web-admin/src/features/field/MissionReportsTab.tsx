import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  Send,
  MessageSquare,
  Award,
  Printer,
  Download,
  Shield,
  PlusCircle,
} from 'lucide-react';
import {
  UserContext,
  MissionReportItem,
  FieldAssignmentItem,
  MissionReportStatus,
} from '../../types';
import { buildApiUrl, getStoredAuthToken } from '../../utils/api';
import { OFFICIAL_COMMUNES } from '../../config/communes';

interface MissionReportsTabProps {
  currentUser: UserContext;
  assignments: FieldAssignmentItem[];
  onMissionUpdated?: () => void;
}

export const MissionReportsTab: React.FC<MissionReportsTabProps> = ({
  currentUser,
  assignments,
  onMissionUpdated,
}) => {
  const [reports, setReports] = useState<MissionReportItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [communeFilter, setCommuneFilter] = useState<string>(currentUser.communeId || 'ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals / Drawers
  const [selectedReport, setSelectedReport] = useState<MissionReportItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [showObservationModal, setShowObservationModal] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form states
  const [observationForm, setObservationForm] = useState({
    observation: '',
    category: 'GENERAL',
  });

  const [reviewForm, setReviewForm] = useState({
    decision: 'APPROVED' as 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED',
    notes: '',
  });

  const [createReportForm, setCreateReportForm] = useState({
    assignmentId: '',
    summary: '',
    objectivesAssessed: '',
    recommendations: '',
    conclusions: '',
  });

  const isChef = currentUser.role === 'CHEF_SERVICE';
  const isSupervisor = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'DIRECTOR' || isChef;

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getStoredAuthToken();
      let url = buildApiUrl('/api/v1/field/reports');
      const params = new URLSearchParams();

      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }
      if (communeFilter !== 'ALL') {
        params.append('communeId', communeFilter);
      }
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Impossible de charger les rapports de mission.');
      }

      const json = await res.json();
      setReports(json.data || []);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, communeFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Open single report detail
  const handleOpenDetail = async (report: MissionReportItem) => {
    try {
      const token = getStoredAuthToken();
      const res = await fetch(buildApiUrl(`/api/v1/field/reports/${report.id}`), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      if (res.ok) {
        const json = await res.json();
        setSelectedReport(json.data || report);
      } else {
        setSelectedReport(report);
      }
    } catch {
      setSelectedReport(report);
    }
    setShowDetailModal(true);
  };

  // Submit Observation
  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    setIsSubmitting(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(buildApiUrl(`/api/v1/field/reports/${selectedReport.id}/contribute`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          observation: `[${observationForm.category}] ${observationForm.observation}`,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || "Échec de l'ajout de l'observation.");
      }

      const updatedRes = await res.json();
      setSelectedReport(updatedRes.data);
      setShowObservationModal(false);
      setObservationForm({ observation: '', category: 'GENERAL' });
      fetchReports();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Erreur : ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Report (Lead Agent)
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(buildApiUrl('/api/v1/field/reports'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(createReportForm),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Échec de la soumission du rapport.');
      }

      setShowCreateModal(false);
      setCreateReportForm({
        assignmentId: '',
        summary: '',
        objectivesAssessed: '',
        recommendations: '',
        conclusions: '',
      });
      fetchReports();
      if (onMissionUpdated) onMissionUpdated();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Erreur : ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Supervisor Review
  const handleReviewReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    if (
      (reviewForm.decision === 'REJECTED' || reviewForm.decision === 'CHANGES_REQUESTED') &&
      !reviewForm.notes.trim()
    ) {
      alert('Veuillez fournir une note explicative obligatoire pour cette décision.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(buildApiUrl(`/api/v1/field/reports/${selectedReport.id}/review`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(reviewForm),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Échec de la validation du rapport.');
      }

      const updated = await res.json();
      setSelectedReport(updated.data);
      setShowReviewModal(false);
      setReviewForm({ decision: 'APPROVED', notes: '' });
      fetchReports();
      if (onMissionUpdated) onMissionUpdated();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Erreur : ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download official PDF
  const handleDownloadPdf = async (reportId: string, reference: string) => {
    try {
      const token = getStoredAuthToken();
      const res = await fetch(buildApiUrl(`/api/v1/field/reports/${reportId}/pdf`), {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!res.ok) {
        throw new Error('Impossible de générer le document PDF.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RAPPORT_MISSION_${reference}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Erreur téléchargement PDF : ${e.message}`);
    }
  };

  const getStatusBadge = (status: MissionReportStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <Clock className="w-3 h-3 mr-1 text-slate-500" /> Brouillon
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Send className="w-3 h-3 mr-1 text-blue-600" /> Soumis
          </span>
        );
      case 'CHANGES_REQUESTED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" /> Corrections requises
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Validé & Clôturé
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3 h-3 mr-1 text-rose-600" /> Rejeté
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  // Filtered reports
  const filteredReports = reports.filter((rpt) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const ref = (rpt.reference || '').toLowerCase();
    const title = (rpt.assignment?.title || '').toLowerCase();
    const authorName = `${rpt.leadAuthor?.firstName || ''} ${rpt.leadAuthor?.lastName || ''}`.toLowerCase();
    const communeName = (rpt.assignment?.commune?.name || '').toLowerCase();
    return (
      ref.includes(term) ||
      title.includes(term) ||
      authorName.includes(term) ||
      communeName.includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
            <FileText className="w-5 h-5 mr-2 text-primary-600 dark:text-primary-400" />
            Rapports de Mission & Validation Hiérarchique
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Rapports d'activité partagés, observations multi-agents, validation hiérarchique et téléchargement officiel
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center px-3.5 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" /> Nouveau Rapport
          </button>
          <button
            onClick={fetchReports}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher référence, mission, agent..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full py-1.5 px-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
          >
            <option value="ALL">Tous les statuts de rapport</option>
            <option value="DRAFT">Brouillon</option>
            <option value="SUBMITTED">Soumis (en attente d'approbation)</option>
            <option value="CHANGES_REQUESTED">Corrections requises</option>
            <option value="APPROVED">Validé & Clôturé</option>
            <option value="REJECTED">Rejeté</option>
          </select>
        </div>

        {/* Commune Filter */}
        <div>
          <select
            value={communeFilter}
            disabled={currentUser.role === 'CHEF_SERVICE'}
            onChange={(e) => setCommuneFilter(e.target.value)}
            className="w-full py-1.5 px-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white disabled:opacity-60"
          >
            {currentUser.role !== 'CHEF_SERVICE' && (
              <option value="ALL">Toutes les communes</option>
            )}
            {OFFICIAL_COMMUNES.map((c) => (
              <option key={c.code} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-primary-600 mr-2" />
            <span className="text-xs text-slate-500">Chargement des rapports...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500 text-xs">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-rose-400" />
            {error}
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
            Aucun rapport de mission trouvé.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Réf / Version</th>
                  <th className="px-4 py-3">Mission & Commune</th>
                  <th className="px-4 py-3">Auteur Principal</th>
                  <th className="px-4 py-3">Statut Rapport</th>
                  <th className="px-4 py-3 text-center">Contrôles</th>
                  <th className="px-4 py-3 text-center">Infractions</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {report.reference}
                      </div>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        v{report.currentVersion}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white truncate max-w-xs">
                        {report.assignment?.title || 'Mission sans titre'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {report.assignment?.commune?.name || 'Commune non précisée'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {report.leadAuthor?.firstName} {report.leadAuthor?.lastName}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {report.leadAuthor?.employeeNumber || 'Agent AOTUC'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(report.status)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap font-bold text-slate-800 dark:text-slate-200">
                      {report.inspectionsCount || 0}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {report.violationsCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                          {report.violationsCount}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-400">
                      {new Date(report.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(report)}
                          className="p-1.5 text-slate-600 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                          title="Consulter le rapport"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(report.id, report.reference)}
                          className="p-1.5 text-slate-600 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                          title="Télécharger PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: CREATE / SUBMIT REPORT */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-primary-600" />
              Rédiger & Soumettre le Rapport de Mission
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Ce rapport consolide les résultats de la mission terrain et sera soumis pour validation hiérarchique.
            </p>

            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mission associée *
                </label>
                <select
                  required
                  value={createReportForm.assignmentId}
                  onChange={(e) =>
                    setCreateReportForm({ ...createReportForm, assignmentId: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">Sélectionner une mission</option>
                  {assignments
                    .filter((a) => a.status === 'IN_PROGRESS' || a.status === 'AWAITING_REPORT' || a.status === 'ASSIGNED')
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        [{a.reference}] {a.title} ({a.commune?.name || 'Commune'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Résumé exécutif & Déroulement de la mission *
                </label>
                <textarea
                  required
                  rows={4}
                  value={createReportForm.summary}
                  onChange={(e) =>
                    setCreateReportForm({ ...createReportForm, summary: e.target.value })
                  }
                  placeholder="Décrivez les opérations menées, les zones couvertes, l'implication des équipes..."
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Recommandations de l'équipe
                  </label>
                  <textarea
                    rows={3}
                    value={createReportForm.recommendations}
                    onChange={(e) =>
                      setCreateReportForm({ ...createReportForm, recommendations: e.target.value })
                    }
                    placeholder="Mesures suggérées, renforts à prévoir..."
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Conclusions générales
                  </label>
                  <textarea
                    rows={3}
                    value={createReportForm.conclusions}
                    onChange={(e) =>
                      setCreateReportForm({ ...createReportForm, conclusions: e.target.value })
                    }
                    placeholder="Bilan global de conformité..."
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {isSubmitting ? 'Soumission...' : 'Soumettre le Rapport'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REPORT DETAILS & COLLABORATIVE TIMELINE */}
      {showDetailModal && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto print:shadow-none print:border-none print:p-0">
            {/* Header info */}
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-primary-600 dark:text-primary-400">
                    {selectedReport.reference}
                  </span>
                  {getStatusBadge(selectedReport.status)}
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-semibold">
                    Version {selectedReport.currentVersion}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  {selectedReport.assignment?.title || 'Rapport de Mission'}
                </h3>
                <p className="text-xs text-slate-500">
                  Commune : {selectedReport.assignment?.commune?.name || 'N/A'} • Auteur :{' '}
                  {selectedReport.leadAuthor?.firstName} {selectedReport.leadAuthor?.lastName} (
                  {selectedReport.leadAuthor?.employeeNumber || 'Agent Lead'})
                </p>
              </div>

              <div className="flex items-center gap-2 print:hidden">
                <button
                  onClick={() => handleDownloadPdf(selectedReport.id, selectedReport.reference)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> PDF
                </button>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" /> Imprimer
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedReport.inspectionsCount || 0}
                </div>
                <div className="text-[11px] text-slate-500">Inspections menées</div>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-200 dark:border-rose-900 text-center">
                <div className="text-lg font-bold text-rose-700 dark:text-rose-400">
                  {selectedReport.violationsCount || 0}
                </div>
                <div className="text-[11px] text-rose-600 dark:text-rose-300">Infractions constatées</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {Array.isArray(selectedReport.contributors) ? selectedReport.contributors.length : 0}
                </div>
                <div className="text-[11px] text-slate-500">Observations agents</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {new Date(selectedReport.createdAt).toLocaleDateString('fr-FR')}
                </div>
                <div className="text-[11px] text-slate-500">Date d'émission</div>
              </div>
            </div>

            {/* Content Body */}
            <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1">
                  Résumé exécutif
                </h4>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl whitespace-pre-wrap leading-relaxed border border-slate-200 dark:border-slate-700">
                  {selectedReport.summary}
                </div>
              </div>

              {selectedReport.recommendations && (
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1">
                    Recommandations opérationnelles
                  </h4>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl whitespace-pre-wrap leading-relaxed border border-slate-200 dark:border-slate-700">
                    {selectedReport.recommendations}
                  </div>
                </div>
              )}

              {selectedReport.conclusions && (
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1">
                    Conclusions
                  </h4>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl whitespace-pre-wrap leading-relaxed border border-slate-200 dark:border-slate-700">
                    {selectedReport.conclusions}
                  </div>
                </div>
              )}

              {/* Multi-Agent Contributions Timeline */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center">
                    <MessageSquare className="w-3.5 h-3.5 mr-1 text-primary-600" />
                    Journal des Observations Terrain (Équipe Déployée)
                  </h4>
                  <button
                    onClick={() => setShowObservationModal(true)}
                    className="inline-flex items-center px-2 py-1 text-[11px] font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/60 dark:text-primary-300 rounded border border-primary-200 dark:border-primary-800 print:hidden"
                  >
                    <PlusCircle className="w-3 h-3 mr-1" /> Ajouter une note
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                  {Array.isArray(selectedReport.contributors) && selectedReport.contributors.length > 0 ? (
                    selectedReport.contributors.map((contrib: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs shadow-xs"
                      >
                        <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {contrib.authorName || contrib.agentName || 'Agent contributeur'}
                          </span>
                          <span>
                            {contrib.timestamp
                              ? new Date(contrib.timestamp).toLocaleString('fr-FR')
                              : 'Heure non précisée'}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300">{contrib.observation}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-slate-400 text-[11px]">
                      Aucune observation additionnelle enregistrée pour le moment.
                    </div>
                  )}
                </div>
              </div>

              {/* Supervisor Review Notes Banner */}
              {selectedReport.supervisorNotes && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center text-amber-800 dark:text-amber-300 font-semibold mb-1 text-xs">
                    <Shield className="w-4 h-4 mr-1.5" />
                    Avis du Superviseur ({selectedReport.reviewedByUser?.firstName}{' '}
                    {selectedReport.reviewedByUser?.lastName}) :
                  </div>
                  <p className="text-amber-900 dark:text-amber-200 text-xs">
                    {selectedReport.supervisorNotes}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer / Review Action */}
            <div className="flex items-center justify-between pt-4 mt-6 border-t border-slate-200 dark:border-slate-800 print:hidden">
              <span className="text-[11px] text-slate-400">
                Dernière modification : {new Date(selectedReport.updatedAt).toLocaleString('fr-FR')}
              </span>

              <div className="flex items-center gap-2">
                {isSupervisor && selectedReport.status === 'SUBMITTED' && (
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm"
                  >
                    <Award className="w-3.5 h-3.5 mr-1.5" /> Évaluer & Valider
                  </button>
                )}
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD OBSERVATION */}
      {showObservationModal && selectedReport && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center">
              <MessageSquare className="w-4 h-4 mr-2 text-primary-600" />
              Ajouter une observation terrain
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Votre note sera horodatée et attribuée à votre compte agent dans le journal de mission.
            </p>

            <form onSubmit={handleAddObservation} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Catégorie
                </label>
                <select
                  value={observationForm.category}
                  onChange={(e) =>
                    setObservationForm({ ...observationForm, category: e.target.value })
                  }
                  className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="GENERAL">Observation générale</option>
                  <option value="TRAFFIC_INCIDENT">Incident de circulation</option>
                  <option value="OBSTACLE">Obstruction / Contrôle difficile</option>
                  <option value="SAFETY_HAZARD">Danger de sécurité publique</option>
                  <option value="REMARQUE_POSITIVE">Bonne conformité constatée</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Observation détaillée *
                </label>
                <textarea
                  required
                  rows={4}
                  value={observationForm.observation}
                  onChange={(e) =>
                    setObservationForm({ ...observationForm, observation: e.target.value })
                  }
                  placeholder="Décrivez les faits constatés, le numéro de plaque concerné ou l'événement..."
                  className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowObservationModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer la note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: SUPERVISOR REVIEW */}
      {showReviewModal && selectedReport && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center">
              <Award className="w-4 h-4 mr-2 text-primary-600" />
              Évaluation hiérarchique du Rapport
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Rapport : <span className="font-mono font-bold">{selectedReport.reference}</span>
            </p>

            <form onSubmit={handleReviewReport} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Décision d'approbation *
                </label>
                <select
                  value={reviewForm.decision}
                  onChange={(e) =>
                    setReviewForm({
                      ...reviewForm,
                      decision: e.target.value as 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED',
                    })
                  }
                  className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="APPROVED">APPROUVER (Valider et clôturer la mission)</option>
                  <option value="CHANGES_REQUESTED">DEMANDER DES CORRECTIONS (Renvoyer au lead)</option>
                  <option value="REJECTED">REJETER LE RAPPORT (Non satisfaisant)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes et remarques du superviseur {reviewForm.decision !== 'APPROVED' && '*'}
                </label>
                <textarea
                  rows={4}
                  required={reviewForm.decision !== 'APPROVED'}
                  value={reviewForm.notes}
                  onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                  placeholder={
                    reviewForm.decision === 'APPROVED'
                      ? 'Commentaires optionnels de félicitations ou directives...'
                      : 'Motif obligatoire des corrections demandées ou du rejet...'
                  }
                  className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Validation...' : 'Confirmer la décision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
