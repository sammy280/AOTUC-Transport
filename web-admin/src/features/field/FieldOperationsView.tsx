import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Users,
  Target,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  Filter,
  UserCheck,
  Printer,
  ChevronRight,
  TrendingUp,
  Award,
  Navigation,
  X,
  Compass,
  ShieldCheck,
  FileText,
  Ban,
} from 'lucide-react';
import {
  UserContext,
  FieldAssignmentItem,
  FieldDashboardSummary,
  FieldReceiptItem,
  FieldAssignmentStatus,
  AgentItem,
} from '../../types';
import { buildApiUrl, getStoredAuthToken } from '../../utils/api';
import { OFFICIAL_COMMUNES } from '../../config/communes';
import { InspectionsTab } from './InspectionsTab';
import { MissionReportsTab } from './MissionReportsTab';
import { AgentsManagementTab } from './AgentsManagementTab';
import { AgentSearchSelect } from './AgentSearchSelect';

interface FieldOperationsViewProps {
  currentUser: UserContext;
}

const CONAKRY_COMMUNES = OFFICIAL_COMMUNES;

export const FieldOperationsView: React.FC<FieldOperationsViewProps> = ({ currentUser }) => {
  const [summary, setSummary] = useState<FieldDashboardSummary | null>(null);
  const [assignments, setAssignments] = useState<FieldAssignmentItem[]>([]);
  const [receipts, setReceipts] = useState<FieldReceiptItem[]>([]);
  const [fieldAgents, setFieldAgents] = useState<AgentItem[]>([]);
  const [isAgentsLoading, setIsAgentsLoading] = useState<boolean>(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [communeFilter, setCommuneFilter] = useState<string>(currentUser.communeId || 'ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showReassignModal, setShowReassignModal] = useState<boolean>(false);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [showReceiptsModal, setShowReceiptsModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [selectedAssignment, setSelectedAssignment] = useState<FieldAssignmentItem | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<FieldReceiptItem | null>(null);
  const [activeTab, setActiveTab] = useState<'missions' | 'inspections' | 'reports' | 'agents'>('missions');
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');

  // Form states
  const [createForm, setCreateForm] = useState({
    title: '',
    communeId: currentUser.communeId || '',
    locationName: '',
    latitude: '' as string | number,
    longitude: '' as string | number,
    assignedUserId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    targetPeople: 50,
    targetVehicles: 30,
    instructions: '',
  });

  const [reassignForm, setReassignForm] = useState({
    assignedUserId: '',
    reason: '',
    supervisorNotes: '',
  });

  const [statusForm, setStatusForm] = useState({
    status: 'IN_PROGRESS' as FieldAssignmentStatus,
    supervisorNotes: '',
  });

  const isChef = currentUser.role === 'CHEF_SERVICE';
  const isAgent = currentUser.role === 'AGENT_TERRAIN';
  const canManage =
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.role === 'DIRECTOR' ||
    currentUser.role === 'IT' ||
    isChef;

  const fetchFieldAgents = useCallback(async () => {
    setIsAgentsLoading(true);
    setAgentsError(null);
    try {
      const token = getStoredAuthToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Use dedicated field agents endpoint:
      // Scoped automatically for CHEF_SERVICE (by commune) and global for SUPER_ADMIN / DIRECTOR / IT
      const agentsUrl = buildApiUrl('/api/v1/field/agents?role=AGENT_TERRAIN&status=ACTIVE&limit=100');
      const agentsRes = await fetch(agentsUrl, { headers });
      if (!agentsRes.ok) {
        const errJson = await agentsRes.json().catch(() => ({}));
        throw new Error(errJson.message || 'Impossible de charger la liste des agents de terrain.');
      }
      const json = await agentsRes.json();
      setFieldAgents(json.data || []);
    } catch (err: unknown) {
      const e = err as Error;
      setAgentsError(e.message || 'Erreur lors du chargement des agents de terrain.');
    } finally {
      setIsAgentsLoading(false);
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getStoredAuthToken();
      const headers = {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      };

      // 1. Dashboard summary
      const sumUrl = buildApiUrl(
        isChef && currentUser.communeId
          ? `/api/v1/field-operations/dashboard-summary?communeId=${currentUser.communeId}`
          : '/api/v1/field-operations/dashboard-summary'
      );
      const sumRes = await fetch(sumUrl, { headers });
      if (sumRes.ok) {
        const sumJson = await sumRes.json();
        setSummary(sumJson.data);
      }

      // 2. Assignments list
      let assignQuery = '?limit=100';
      if (communeFilter !== 'ALL') assignQuery += `&communeId=${communeFilter}`;
      if (statusFilter !== 'ALL') assignQuery += `&status=${statusFilter}`;
      if (searchTerm.trim()) assignQuery += `&search=${encodeURIComponent(searchTerm.trim())}`;

      const assignUrl = buildApiUrl(`/api/v1/field-operations/assignments${assignQuery}`);
      const assignRes = await fetch(assignUrl, { headers });
      if (assignRes.ok) {
        const assignJson = await assignRes.json();
        setAssignments(assignJson.assignments || []);
      }

      // 3. Receipts list
      const recUrl = buildApiUrl('/api/v1/field-operations/receipts?limit=50');
      const recRes = await fetch(recUrl, { headers });
      if (recRes.ok) {
        const recJson = await recRes.json();
        setReceipts(recJson.receipts || []);
      }

      // 4. Field Agents list for assignments dropdown
      await fetchFieldAgents();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Erreur lors du chargement des opérations de terrain.');
    } finally {
      setIsLoading(false);
    }
  }, [communeFilter, statusFilter, searchTerm, isChef, currentUser.communeId, fetchFieldAgents]);

  useEffect(() => {
    fetchDashboardData();
    fetchFieldAgents();
  }, [fetchDashboardData, fetchFieldAgents]);

  // Capture GPS from browser/device
  const handleCaptureGps = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCreateForm((prev) => ({
            ...prev,
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
          }));
        },
        () => {
          // Fallback to Conakry central coordinates
          setCreateForm((prev) => ({
            ...prev,
            latitude: 9.5092,
            longitude: -13.7122,
          }));
        }
      );
    }
  };

  // Create Assignment submit
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = getStoredAuthToken();
      const payload = {
        ...createForm,
        latitude: createForm.latitude ? Number(createForm.latitude) : undefined,
        longitude: createForm.longitude ? Number(createForm.longitude) : undefined,
        targetPeople: Number(createForm.targetPeople),
        targetVehicles: Number(createForm.targetVehicles),
        assignedUserId: createForm.assignedUserId || undefined,
      };

      const res = await fetch(buildApiUrl('/api/v1/field-operations/assignments'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Impossible de créer la mission.');
      }

      setShowCreateModal(false);
      setCreateForm({
        title: '',
        communeId: currentUser.communeId || '',
        locationName: '',
        latitude: '',
        longitude: '',
        assignedUserId: '',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        targetPeople: 50,
        targetVehicles: 30,
        instructions: '',
      });
      fetchDashboardData();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Erreur : ${e.message}`);
    }
  };

  // Reassign Agent submit
  const handleReassignAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    try {
      const token = getStoredAuthToken();
      const res = await fetch(
        buildApiUrl(`/api/v1/field-operations/assignments/${selectedAssignment.id}/reassign`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify(reassignForm),
        }
      );

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Échec de la réassignation.');
      }

      setShowReassignModal(false);
      setSelectedAssignment(null);
      setReassignForm({ assignedUserId: '', reason: '', supervisorNotes: '' });
      fetchDashboardData();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Erreur : ${e.message}`);
    }
  };

  // Status Change submit
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    try {
      const token = getStoredAuthToken();
      const res = await fetch(
        buildApiUrl(`/api/v1/field-operations/assignments/${selectedAssignment.id}/status`),
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify(statusForm),
        }
      );

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Échec de la mise à jour du statut.');
      }

      setShowStatusModal(false);
      setSelectedAssignment(null);
      fetchDashboardData();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Erreur : ${e.message}`);
    }
  };

  // Supervisor Cancel Mission
  const handleCancelAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment || !cancelReason.trim()) {
      alert("Veuillez renseigner un motif obligatoire d'annulation.");
      return;
    }
    try {
      const token = getStoredAuthToken();
      const res = await fetch(
        buildApiUrl(`/api/v1/field/assignments/${selectedAssignment.id}/cancel`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({ reason: cancelReason.trim() }),
        }
      );

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || "Échec de l'annulation de la mission.");
      }

      setShowCancelModal(false);
      setSelectedAssignment(null);
      setCancelReason('');
      fetchDashboardData();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Erreur : ${e.message}`);
    }
  };

  const getStatusBadge = (status: FieldAssignmentStatus) => {
    switch (status) {
      case 'PLANNED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <Clock className="w-3 h-3 mr-1 text-slate-500" /> Planifiée
          </span>
        );
      case 'ASSIGNED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <UserCheck className="w-3 h-3 mr-1 text-blue-600" /> Assignée
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Compass className="w-3 h-3 mr-1 text-amber-600 animate-spin" /> En cours
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Terminée
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" /> Annulée
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Module Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-full border border-emerald-300 dark:border-emerald-800 uppercase tracking-wide">
                Phase 6 — Opérations de Terrain
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isChef
                  ? `Territoire : Commune de ${currentUser.communeName || 'Matoto'}`
                  : 'Portée Nationale — 5 Communes de Conakry'}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              Supervision des Missions de Terrain & Objectifs d Enrôlement
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pilotage des brigades mobiles, suivi temps réel des cibles personnes & véhicules, géolocalisation et récépissés administratifs officiels.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchDashboardData}
              disabled={isLoading}
              className="min-h-[40px] flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Rafraîchir les données"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>

            {canManage && (
              <button
                onClick={() => {
                  fetchFieldAgents();
                  setShowCreateModal(true);
                }}
                className="min-h-[40px] flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Nouvelle Mission</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 1.1 Navigation Tab Bar */}
      <div className="flex items-center space-x-1 border-b border-slate-200 dark:border-slate-800 pb-px">
        <button
          onClick={() => setActiveTab('missions')}
          className={`inline-flex items-center px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors ${
            activeTab === 'missions'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Navigation className="w-4 h-4 mr-1.5" />
          Missions & Déploiements
        </button>
        <button
          onClick={() => setActiveTab('inspections')}
          className={`inline-flex items-center px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors ${
            activeTab === 'inspections'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 mr-1.5" />
          Contrôles Routiers
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`inline-flex items-center px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors ${
            activeTab === 'reports'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4 mr-1.5" />
          Rapports de Mission
        </button>
        {canManage && (
          <button
            onClick={() => setActiveTab('agents')}
            className={`inline-flex items-center px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors ${
              activeTab === 'agents'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4 mr-1.5" />
            Gestion des Agents
          </button>
        )}
      </div>

      {activeTab === 'inspections' && (
        <InspectionsTab currentUser={currentUser} assignments={assignments} />
      )}

      {activeTab === 'reports' && (
        <MissionReportsTab
          currentUser={currentUser}
          assignments={assignments}
          onMissionUpdated={fetchDashboardData}
        />
      )}

      {activeTab === 'agents' && <AgentsManagementTab currentUser={currentUser} />}

      {activeTab === 'missions' && (
        <>
      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Key Metrics Overview */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Missions Totales</span>
              <Navigation className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {summary.totalAssignments}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Toutes communes
            </div>
          </div>

          <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Missions Actives</span>
              <Compass className="w-4 h-4 text-amber-500 animate-spin" />
            </div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {summary.activeAssignments}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              En cours & assignées
            </div>
          </div>

          <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Agents Déployés</span>
              <Users className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {summary.assignedAgentsCount}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Brigades actives
            </div>
          </div>

          <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Aujourd hui</span>
              <TrendingUp className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {summary.registrationsToday}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              {summary.todayBreakdown.peopleToday} pers. / {summary.todayBreakdown.vehiclesToday} véh.
            </div>
          </div>

          <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Cible Globale</span>
              <Target className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              {summary.targetsSummary.overallPercent}%
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              {summary.targetsSummary.actualPeople + summary.targetsSummary.actualVehicles} / {summary.targetsSummary.targetPeople + summary.targetsSummary.targetVehicles} réalisés
            </div>
          </div>

          <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Récépissés Émis</span>
              <Award className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {summary.totalReceiptsIssued}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Preuves officielles
            </div>
          </div>
        </div>
      )}

      {/* 3. Conakry 5 Communes Target Breakdown */}
      {summary && summary.communeBreakdown && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Avancement par Commune Urbaine de Conakry</span>
            </h2>
            <span className="text-xs text-slate-400">
              Chiffres synchronisés en base PostgreSQL
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {summary.communeBreakdown.map((c) => (
              <div
                key={c.communeId}
                className={`p-3 rounded-lg border text-xs transition ${
                  communeFilter === c.communeId
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                  <span>{c.communeName}</span>
                  <span className="text-[10px] font-semibold text-slate-400">{c.communeCode}</span>
                </div>

                <div className="mt-2 space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Missions actives:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{c.activeAssignments}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Personnes:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {c.actualPeople} / {c.targetPeople}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Véhicules:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {c.actualVehicles} / {c.targetVehicles}
                    </span>
                  </div>

                  <div className="pt-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-0.5">
                      <span>Réalisation</span>
                      <span>{c.completionRate}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, c.completionRate)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Filter Toolbar & Search */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par référence, lieu, titre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-1 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtres :</span>
          </div>

          {/* Commune Filter */}
          <select
            value={communeFilter}
            onChange={(e) => setCommuneFilter(e.target.value)}
            disabled={isChef}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          >
            {!isChef && <option value="ALL">Toutes les Communes</option>}
            {CONAKRY_COMMUNES.map((c) => (
              <option key={c.code} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="PLANNED">Planifiée</option>
            <option value="ASSIGNED">Assignée</option>
            <option value="IN_PROGRESS">En cours</option>
            <option value="COMPLETED">Terminée</option>
            <option value="CANCELLED">Annulée</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-bold text-slate-800 dark:text-slate-200">{assignments.length}</span> mission(s) affichée(s)
        </div>
      </div>

      {/* 5. Assignments Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">Référence / Titre</th>
                <th className="p-3">Commune & Lieu</th>
                <th className="p-3">Agent Assigné</th>
                <th className="p-3">Dates</th>
                <th className="p-3">Progression Personnes</th>
                <th className="p-3">Progression Véhicules</th>
                <th className="p-3">Statut</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    Aucune mission de terrain trouvée pour ces critères.
                  </td>
                </tr>
              ) : (
                assignments.map((assignment) => {
                  const pProg = assignment.progress?.peoplePercent || 0;
                  const vProg = assignment.progress?.vehiclesPercent || 0;

                  return (
                    <tr
                      key={assignment.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {assignment.reference}
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          {assignment.title}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-emerald-600" />
                          <span>{assignment.commune?.name || 'Conakry'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          {assignment.locationName}
                        </div>
                        {assignment.latitude && assignment.longitude && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            GPS: {assignment.latitude.toFixed(4)}, {assignment.longitude.toFixed(4)}
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        {assignment.assignedUser ? (
                          <div className="flex items-center space-x-2">
                            {assignment.assignedUser.avatarUrl ? (
                              <img
                                src={assignment.assignedUser.avatarUrl}
                                alt=""
                                className="w-6 h-6 rounded-full object-cover border border-emerald-500"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold flex items-center justify-center">
                                {assignment.assignedUser.firstName.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                                <span>{assignment.assignedUser.firstName} {assignment.assignedUser.lastName}</span>
                                {assignment.assignedUser.employeeNumber && (
                                  <span className="px-1 py-0.2 text-[9px] font-mono font-bold rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    {assignment.assignedUser.employeeNumber}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {assignment.assignedUser.phoneNumber || assignment.assignedUser.email}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Non assigné</span>
                        )}
                      </td>

                      <td className="p-3 text-[11px] text-slate-600 dark:text-slate-400">
                        <div>Du : {new Date(assignment.startDate).toLocaleDateString('fr-FR')}</div>
                        {assignment.endDate && (
                          <div>Au : {new Date(assignment.endDate).toLocaleDateString('fr-FR')}</div>
                        )}
                      </td>

                      <td className="p-3 min-w-[130px]">
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {assignment.progress?.actualPeople || 0} / {assignment.targetPeople}
                          </span>
                          <span className="font-bold text-emerald-600">{pProg}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, pProg)}%` }}
                          />
                        </div>
                      </td>

                      <td className="p-3 min-w-[130px]">
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {assignment.progress?.actualVehicles || 0} / {assignment.targetVehicles}
                          </span>
                          <span className="font-bold text-blue-600">{vProg}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, vProg)}%` }}
                          />
                        </div>
                      </td>

                      <td className="p-3">{getStatusBadge(assignment.status)}</td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Reassign Agent button */}
                          {canManage && (
                            <button
                              onClick={() => {
                                fetchFieldAgents();
                                setSelectedAssignment(assignment);
                                setReassignForm({
                                  assignedUserId: assignment.assignedUserId || '',
                                  reason: '',
                                  supervisorNotes: '',
                                });
                                setShowReassignModal(true);
                              }}
                              className="px-2 py-1 text-[11px] font-medium rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                              title="Réassigner un agent"
                            >
                              Réassigner
                            </button>
                          )}

                          {/* Change Status button */}
                          {(canManage || isAgent) && (
                            <button
                              onClick={() => {
                                setSelectedAssignment(assignment);
                                setStatusForm({
                                  status: assignment.status,
                                  supervisorNotes: '',
                                });
                                setShowStatusModal(true);
                              }}
                              className="px-2 py-1 text-[11px] font-medium rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 transition"
                              title="Changer statut"
                            >
                              Statut
                            </button>
                          )}

                          {/* Cancel Mission button (Supervisors only) */}
                          {canManage && assignment.status !== 'CANCELLED' && assignment.status !== 'COMPLETED' && (
                            <button
                              onClick={() => {
                                setSelectedAssignment(assignment);
                                setCancelReason('');
                                setShowCancelModal(true);
                              }}
                              className="px-2 py-1 text-[11px] font-medium rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 transition"
                              title="Annuler la mission avec motif obligatoire"
                            >
                              Annuler
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Recent Field Receipts / Proof of Work */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <Award className="w-4 h-4 text-emerald-600" />
              <span>Récépissés Officiels de Terrain (Preuves de Démarche Sans Frais)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Chaque récépissé atteste formellement de la prise en charge administrative du chauffeur ou du véhicule en mission de terrain.
            </p>
          </div>

          <button
            onClick={() => setShowReceiptsModal(true)}
            className="flex items-center space-x-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            <span>Voir tous les récépissés</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {receipts.slice(0, 3).map((rec) => (
            <div
              key={rec.id}
              className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex flex-col justify-between space-y-2 text-xs"
            >
              <div>
                <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100">
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">{rec.receiptNumber}</span>
                  <span className="text-[10px] text-slate-400">{new Date(rec.issuedAt).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                  {rec.person && (
                    <div>Chauffeur/Usager : <span className="font-medium text-slate-900 dark:text-slate-200">{rec.person.firstName} {rec.person.lastName}</span></div>
                  )}
                  {rec.vehicle && (
                    <div>Véhicule : <span className="font-medium text-slate-900 dark:text-slate-200">{rec.vehicle.plateNumber} ({rec.vehicle.make} {rec.vehicle.model})</span></div>
                  )}
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Agent : {rec.agentUser?.firstName} {rec.agentUser?.lastName}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => {
                    setSelectedReceipt(rec);
                    setShowPrintModal(true);
                  }}
                  className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-900 text-white dark:bg-slate-800 hover:bg-slate-800 transition"
                >
                  <Printer className="w-3 h-3 text-[#FCD116]" />
                  <span>Imprimer / Preuve</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CREATE MISSION */}
      {/* ===================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Créer une Nouvelle Mission de Terrain</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Titre de la mission *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Campagne d enrôlement Gare Centrale"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Commune de rattachement *
                  </label>
                  <select
                    required
                    value={createForm.communeId}
                    onChange={(e) => setCreateForm({ ...createForm, communeId: e.target.value })}
                    disabled={isChef}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Sélectionner une commune</option>
                    {CONAKRY_COMMUNES.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Lieu / Station / Rond-point *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Rond-point Entag"
                    value={createForm.locationName}
                    onChange={(e) => setCreateForm({ ...createForm, locationName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* GPS Coordinates */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-slate-700 dark:text-slate-300">
                    Coordonnées GPS du poste terrain (optionnel)
                  </label>
                  <button
                    type="button"
                    onClick={handleCaptureGps}
                    className="text-[11px] text-emerald-600 hover:underline flex items-center space-x-1"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>Capturer position actuelle</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="number"
                    step="any"
                    placeholder="Latitude (ex: 9.5092)"
                    value={createForm.latitude}
                    onChange={(e) => setCreateForm({ ...createForm, latitude: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Longitude (ex: -13.7122)"
                    value={createForm.longitude}
                    onChange={(e) => setCreateForm({ ...createForm, longitude: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Searchable Field Agent Selection */}
              <div>
                <AgentSearchSelect
                  label="Agent de terrain désigné"
                  value={createForm.assignedUserId}
                  onChange={(agentId) => setCreateForm({ ...createForm, assignedUserId: agentId })}
                  agents={fieldAgents}
                  isLoading={isAgentsLoading}
                  error={agentsError}
                  onRetry={fetchFieldAgents}
                  targetCommuneId={createForm.communeId}
                  allowEmpty={true}
                  emptyLabel="Assigner plus tard (Mission Planifiée)"
                  placeholder="Rechercher par nom, matricule, commune..."
                  helperText="Sélectionnez l'agent de terrain accrédité parmi les comptes AGENT_TERRAIN actifs."
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date de début *
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={createForm.endDate}
                    onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Target Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Cible Personnes (Chauffeurs/Propriétaires)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={createForm.targetPeople}
                    onChange={(e) => setCreateForm({ ...createForm, targetPeople: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Cible Véhicules
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={createForm.targetVehicles}
                    onChange={(e) => setCreateForm({ ...createForm, targetVehicles: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Instructions & consignes de supervision
                </label>
                <textarea
                  rows={2}
                  placeholder="Consignes opérationnelles pour l agent sur place..."
                  value={createForm.instructions}
                  onChange={(e) => setCreateForm({ ...createForm, instructions: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                >
                  Créer la Mission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: REASSIGN AGENT */}
      {/* ===================================================================== */}
      {showReassignModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span>Réassigner un Agent de Terrain</span>
              </h3>
              <button onClick={() => setShowReassignModal(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                Mission : {selectedAssignment.reference}
              </div>
              <div className="text-slate-500">{selectedAssignment.title}</div>
            </div>

            <form onSubmit={handleReassignAgent} className="space-y-3">
              {/* Current Agent Info */}
              {selectedAssignment.assignedUser && (
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Agent actuel :</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedAssignment.assignedUser.firstName} {selectedAssignment.assignedUser.lastName}
                    {selectedAssignment.assignedUser.employeeNumber && (
                      <span className="ml-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                        ({selectedAssignment.assignedUser.employeeNumber})
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Searchable New Agent Selection */}
              <div>
                <AgentSearchSelect
                  label="Nouvel Agent de Terrain"
                  value={reassignForm.assignedUserId}
                  onChange={(agentId) => setReassignForm({ ...reassignForm, assignedUserId: agentId })}
                  agents={fieldAgents}
                  isLoading={isAgentsLoading}
                  error={agentsError}
                  onRetry={fetchFieldAgents}
                  targetCommuneId={selectedAssignment.communeId}
                  allowEmpty={false}
                  required={true}
                  placeholder="Rechercher par nom, matricule..."
                  helperText="Sélectionnez le nouvel agent accrédité auquel transférer la mission."
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Motif de réassignation *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Renfort prioritaire, indisponibilité temporaire..."
                  value={reassignForm.reason}
                  onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes de supervision
                </label>
                <textarea
                  rows={2}
                  value={reassignForm.supervisorNotes}
                  onChange={(e) => setReassignForm({ ...reassignForm, supervisorNotes: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700"
                >
                  Valider la Réassignation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: UPDATE STATUS */}
      {/* ===================================================================== */}
      {showStatusModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>Mettre à jour le Statut de la Mission</span>
              </h3>
              <button onClick={() => setShowStatusModal(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nouveau statut *
                </label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value as FieldAssignmentStatus })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="PLANNED">Planifiée</option>
                  <option value="ASSIGNED">Assignée</option>
                  <option value="IN_PROGRESS">En cours</option>
                  <option value="COMPLETED">Terminée</option>
                  <option value="CANCELLED">Annulée</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Observation / Compte-rendu
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes sur l avancement ou le motif de clôture..."
                  value={statusForm.supervisorNotes}
                  onChange={(e) => setStatusForm({ ...statusForm, supervisorNotes: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: PRINTABLE OFFICIAL FIELD RECEIPT */}
      {/* ===================================================================== */}
      {showPrintModal && selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-xl max-w-xl w-full border border-slate-300 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Aperçu du Récépissé Officiel d Enrôlement
              </div>
              <button onClick={() => setShowPrintModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Receipt Paper */}
            <div className="border border-slate-300 p-6 rounded-lg bg-slate-50/50 space-y-4 font-sans text-xs">
              {/* Official Header */}
              <div className="text-center pb-3 border-b-2 border-slate-800">
                <div className="font-serif font-bold text-xs uppercase tracking-widest text-slate-800">
                  RÉPUBLIQUE DE GUINÉE
                </div>
                <div className="text-[10px] italic text-slate-600">
                  Travail — Justice — Solidarité
                </div>
                <div className="mt-2 text-xs font-black uppercase text-slate-900 tracking-wide">
                  AUTORITÉ ORGANISATRICE DES TRANSPORTS URBAINS DE CONAKRY (AOTUC)
                </div>
                <div className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider mt-0.5">
                  Récépissé Officiel d Enrôlement de Terrain (Preuve de Démarche)
                </div>
              </div>

              {/* Receipt Reference Bar */}
              <div className="flex justify-between items-center bg-slate-100 p-2.5 rounded border border-slate-200 font-mono text-xs">
                <div>
                  <span className="text-slate-500">RÉF : </span>
                  <span className="font-bold text-slate-900">{selectedReceipt.receiptNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500">DATE : </span>
                  <span className="font-bold text-slate-900">
                    {new Date(selectedReceipt.issuedAt).toLocaleString('fr-FR')}
                  </span>
                </div>
              </div>

              {/* Entity Information */}
              <div className="space-y-2 text-slate-700">
                {selectedReceipt.person && (
                  <div className="p-2.5 bg-white rounded border border-slate-200">
                    <div className="font-bold text-slate-900 uppercase text-[11px] mb-1">
                      Identité de l Usager / Chauffeur Enrôlé :
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>Nom complet : <span className="font-semibold text-slate-900">{selectedReceipt.person.firstName} {selectedReceipt.person.lastName}</span></div>
                      <div>NIN : <span className="font-mono font-semibold text-slate-900">{selectedReceipt.person.nin}</span></div>
                      <div>Téléphone : <span className="font-semibold text-slate-900">{selectedReceipt.person.phoneNumber}</span></div>
                      <div>Commune : <span className="font-semibold text-slate-900">{selectedReceipt.commune?.name || 'Conakry'}</span></div>
                    </div>
                  </div>
                )}

                {selectedReceipt.vehicle && (
                  <div className="p-2.5 bg-white rounded border border-slate-200">
                    <div className="font-bold text-slate-900 uppercase text-[11px] mb-1">
                      Véhicule Identifié :
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>Immatriculation : <span className="font-mono font-bold text-slate-900">{selectedReceipt.vehicle.plateNumber}</span></div>
                      <div>Marque / Modèle : <span className="font-semibold text-slate-900">{selectedReceipt.vehicle.make} {selectedReceipt.vehicle.model}</span></div>
                    </div>
                  </div>
                )}

                <div className="p-2.5 bg-white rounded border border-slate-200 text-[11px]">
                  <div>Agent enrôleur : <span className="font-semibold text-slate-900">{selectedReceipt.agentUser?.firstName} {selectedReceipt.agentUser?.lastName} ({selectedReceipt.agentUser?.phoneNumber})</span></div>
                  {selectedReceipt.assignment && (
                    <div>Mission rattachée : <span className="font-semibold text-slate-900">{selectedReceipt.assignment.reference} — {selectedReceipt.assignment.locationName}</span></div>
                  )}
                  {selectedReceipt.latitude && selectedReceipt.longitude && (
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Coordonnées GPS terrain : {selectedReceipt.latitude.toFixed(6)}, {selectedReceipt.longitude.toFixed(6)}
                    </div>
                  )}
                </div>
              </div>

              {/* Legal Notice */}
              <div className="p-2.5 bg-emerald-50 rounded border border-emerald-200 text-[10px] text-emerald-900 leading-snug">
                <span className="font-bold">Mention Légale Administrative : </span>
                Ce document officiel atteste formellement de la complétude du dossier d enrôlement sur le terrain.
                Délivré à titre gracieux sans perception d aucun frais illicite.
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs"
              >
                Fermer
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center space-x-1.5 hover:bg-emerald-700"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer Récépissé</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ===================================================================== */}
      {/* MODAL: ALL FIELD RECEIPTS LIST */}
      {/* ===================================================================== */}
      {showReceiptsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Award className="w-4 h-4 text-emerald-600" />
                <span>Registre Complet des Récépissés de Terrain</span>
              </h3>
              <button onClick={() => setShowReceiptsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5">Numéro Récépissé</th>
                    <th className="p-2.5">Bénéficiaire / Enrôlé</th>
                    <th className="p-2.5">Véhicule</th>
                    <th className="p-2.5">Agent</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {receipts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        Aucun récépissé enregistré pour le moment.
                      </td>
                    </tr>
                  ) : (
                    receipts.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {r.receiptNumber}
                        </td>
                        <td className="p-2.5">
                          {r.person ? `${r.person.firstName} ${r.person.lastName}` : '—'}
                        </td>
                        <td className="p-2.5">
                          {r.vehicle ? r.vehicle.plateNumber : '—'}
                        </td>
                        <td className="p-2.5 text-slate-500">
                          {r.agentUser ? `${r.agentUser.firstName} ${r.agentUser.lastName}` : '—'}
                        </td>
                        <td className="p-2.5 text-slate-500">
                          {new Date(r.issuedAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => {
                              setSelectedReceipt(r);
                              setShowPrintModal(true);
                            }}
                            className="px-2 py-1 text-[11px] font-semibold rounded bg-slate-900 text-white dark:bg-slate-800 hover:bg-slate-800"
                          >
                            Imprimer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowReceiptsModal(false)}
                className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CANCEL MISSION (SUPERVISOR WITH MANDATORY REASON) */}
      {/* ===================================================================== */}
      {showCancelModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-rose-600 dark:text-rose-400 flex items-center space-x-2">
                <Ban className="w-4 h-4" />
                <span>Annuler la Mission de Terrain</span>
              </h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Mission : <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedAssignment.title}</span> ({selectedAssignment.reference}).
              Une fois annulée, aucune inspection ou rapport ne pourra plus être soumis.
            </p>

            <form onSubmit={handleCancelAssignment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Motif d'annulation obligatoire *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Précisez la raison de l'annulation (intempéries, réaffectation urgente, etc.)..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  disabled={!cancelReason.trim()}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 transition disabled:opacity-50"
                >
                  Confirmer l'annulation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldOperationsView;
