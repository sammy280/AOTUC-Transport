import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Car,
  MapPin,
  RefreshCw,
  AlertOctagon,
} from 'lucide-react';
import {
  UserContext,
  FieldInspectionItem,
  FieldAssignmentItem,
  CheckpointStatus,
  InspectionOutcome,
} from '../../types';
import { buildApiUrl, getStoredAuthToken } from '../../utils/api';
import { OFFICIAL_COMMUNES } from '../../config/communes';

interface InspectionsTabProps {
  currentUser: UserContext;
  assignments: FieldAssignmentItem[];
}

export const InspectionsTab: React.FC<InspectionsTabProps> = ({ currentUser, assignments }) => {
  const [inspections, setInspections] = useState<FieldInspectionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const isChef = currentUser.role === 'CHEF_SERVICE';
  const [communeFilter, setCommuneFilter] = useState<string>(currentUser.communeId || 'ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('ALL');
  const [missionFilter, setMissionFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedInspection, setSelectedInspection] = useState<FieldInspectionItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    missionId: '',
    targetType: 'VEHICLE',
    vehiclePlate: '',
    driverName: '',
    driverPhone: '',
    driverLicenseNumber: '',
    vehicleType: 'MINIBUS',
    checkpointDriverLicense: 'NOT_CHECKED' as CheckpointStatus,
    checkpointVehiclePermit: 'NOT_CHECKED' as CheckpointStatus,
    checkpointTechnicalVisit: 'NOT_CHECKED' as CheckpointStatus,
    isAuthorizedRoute: 'NOT_CHECKED' as CheckpointStatus,
    checkpointFireExtinguisher: 'NOT_CHECKED' as CheckpointStatus,
    outcome: 'NOT_ASSESSED' as InspectionOutcome,
    infractions: [] as string[],
    notes: '',
    evidenceUrl: '',
  });

  const [infractionInput, setInfractionInput] = useState<string>('');

  const fetchInspections = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getStoredAuthToken();
      const params = new URLSearchParams();
      if (communeFilter !== 'ALL' && !isChef) params.append('communeId', communeFilter);
      if (outcomeFilter !== 'ALL') params.append('outcome', outcomeFilter);
      if (missionFilter !== 'ALL') params.append('missionId', missionFilter);
      if (searchTerm) params.append('search', searchTerm);

      const url = buildApiUrl(`/api/v1/field/inspections?${params.toString()}`);
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Impossible de charger les contrôles.');
      }

      const data = await res.json();
      setInspections(data.items || []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des contrôles.');
    } finally {
      setIsLoading(false);
    }
  }, [communeFilter, outcomeFilter, missionFilter, searchTerm, isChef]);

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  const handleAddInfraction = () => {
    if (infractionInput.trim() && !createForm.infractions.includes(infractionInput.trim())) {
      setCreateForm({
        ...createForm,
        infractions: [...createForm.infractions, infractionInput.trim()],
      });
      setInfractionInput('');
    }
  };

  const handleRemoveInfraction = (index: number) => {
    setCreateForm({
      ...createForm,
      infractions: createForm.infractions.filter((_, i) => i !== index),
    });
  };

  const handleCreateInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.missionId) {
      setError('Veuillez sélectionner une mission de terrain.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const token = getStoredAuthToken();
      const documents = createForm.evidenceUrl.trim()
        ? [{ fileUrl: createForm.evidenceUrl.trim(), category: 'VIOLATION_EVIDENCE', mimeType: 'image/jpeg' }]
        : [];

      const payload = {
        missionId: createForm.missionId,
        targetType: createForm.targetType,
        vehiclePlate: createForm.vehiclePlate.trim() || undefined,
        driverName: createForm.driverName.trim() || undefined,
        driverPhone: createForm.driverPhone.trim() || undefined,
        driverLicenseNumber: createForm.driverLicenseNumber.trim() || undefined,
        vehicleType: createForm.vehicleType || undefined,
        checkpointDriverLicense: createForm.checkpointDriverLicense,
        checkpointVehiclePermit: createForm.checkpointVehiclePermit,
        checkpointTechnicalVisit: createForm.checkpointTechnicalVisit,
        isAuthorizedRoute: createForm.isAuthorizedRoute,
        checkpointFireExtinguisher: createForm.checkpointFireExtinguisher,
        outcome: createForm.outcome,
        infractions: createForm.infractions,
        notes: createForm.notes.trim() || undefined,
        documents,
      };

      const res = await fetch(buildApiUrl('/api/v1/field/inspections'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erreur lors de l enregistrement du contrôle.');
      }

      setShowCreateModal(false);
      // Reset form
      setCreateForm({
        missionId: '',
        targetType: 'VEHICLE',
        vehiclePlate: '',
        driverName: '',
        driverPhone: '',
        driverLicenseNumber: '',
        vehicleType: 'MINIBUS',
        checkpointDriverLicense: 'NOT_CHECKED',
        checkpointVehiclePermit: 'NOT_CHECKED',
        checkpointTechnicalVisit: 'NOT_CHECKED',
        isAuthorizedRoute: 'NOT_CHECKED',
        checkpointFireExtinguisher: 'NOT_CHECKED',
        outcome: 'NOT_ASSESSED',
        infractions: [],
        notes: '',
        evidenceUrl: '',
      });

      fetchInspections();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderOutcomeBadge = (outcome: InspectionOutcome) => {
    switch (outcome) {
      case 'CONFORME':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Conforme
          </span>
        );
      case 'AVERTISSEMENT':
      case 'AVEC_RESERVES':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" /> Avec Réserves
          </span>
        );
      case 'NON_CONFORME':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3 h-3 mr-1 text-rose-600" /> Non Conforme
          </span>
        );
      case 'INFRACTION':
      case 'IMMOBILISATION':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-700">
            <AlertOctagon className="w-3 h-3 mr-1 text-red-600" /> Infraction / Saisie
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <Clock className="w-3 h-3 mr-1 text-slate-500" /> Non Évalué
          </span>
        );
    }
  };

  const renderCheckpointPill = (status: CheckpointStatus, label: string) => {
    const isYes = status === 'YES' || status === 'CONFORME';
    const isNo = status === 'NO' || status === 'NON_CONFORME';

    if (isYes) {
      return (
        <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium border border-emerald-200 dark:border-emerald-800">
          ✓ {label}
        </span>
      );
    }
    if (isNo) {
      return (
        <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-medium border border-rose-200 dark:border-rose-800">
          ✕ {label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 font-medium">
        — {label}
      </span>
    );
  };

  const activeMissions = assignments.filter((a) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED');

  return (
    <div className="space-y-5">
      {/* Search and Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher immatriculation, chauffeur, réf..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <select
              value={missionFilter}
              onChange={(e) => setMissionFilter(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[200px]"
            >
              <option value="ALL">Toutes les Missions</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.reference} - {a.title.slice(0, 20)}...
                </option>
              ))}
            </select>

            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Tous les Résultats</option>
              <option value="CONFORME">Conforme</option>
              <option value="AVERTISSEMENT">Avec Réserves</option>
              <option value="NON_CONFORME">Non Conforme</option>
              <option value="INFRACTION">Infraction / Saisie</option>
              <option value="NOT_ASSESSED">Non Évalué</option>
            </select>

            {!isChef && (
              <select
                value={communeFilter}
                onChange={(e) => setCommuneFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">Toutes les Communes</option>
                {OFFICIAL_COMMUNES.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={fetchInspections}
              disabled={isLoading}
              className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau Contrôle Terrain</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Inspections Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Registres des Contrôles & Inspections ({inspections.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            Contrôles opérationnels de police du transport urbain
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Réf Contrôle</th>
                <th className="px-4 py-3">Véhicule / Chauffeur</th>
                <th className="px-4 py-3">Mission & Commune</th>
                <th className="px-4 py-3">Vérifications (Checkpoints)</th>
                <th className="px-4 py-3">Résultat</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-emerald-600" />
                    Chargement des contrôles...
                  </td>
                </tr>
              ) : inspections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Aucun contrôle enregistré.
                  </td>
                </tr>
              ) : (
                inspections.map((insp) => (
                  <tr key={insp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {insp.reference}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(insp.inspectedAt).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1.5 font-semibold text-slate-900 dark:text-slate-100">
                        <Car className="w-3.5 h-3.5 text-slate-400" />
                        <span>{insp.plateNumber || 'Sans plaque'}</span>
                      </div>
                      {insp.driverName && (
                        <div className="text-[11px] text-slate-400">
                          {insp.driverName} {insp.licenseNumber ? `(Permis: ${insp.licenseNumber})` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {insp.assignment?.title || 'Mission'}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{insp.commune?.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {renderCheckpointPill(insp.hasValidLicense, 'Permis')}
                        {renderCheckpointPill(insp.hasMunicipalSticker, 'Vignette')}
                        {renderCheckpointPill(insp.hasTechnicalControl, 'Visite')}
                        {renderCheckpointPill(insp.isAuthorizedRoute, 'Itinéraire')}
                        {renderCheckpointPill(insp.hasSafetyEquipment, 'Sécurité')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {renderOutcomeBadge(insp.outcome)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      <div className="font-medium">
                        {insp.agentUser ? `${insp.agentUser.firstName} ${insp.agentUser.lastName}` : 'Agent'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {insp.agentUser?.employeeNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedInspection(insp);
                          setShowDetailModal(true);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-emerald-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded transition"
                      >
                        Détails
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE INSPECTION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Enregistrer un Contrôle de Terrain (Inspection)
                </h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateInspection} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mission de Rattachement *
                </label>
                <select
                  required
                  value={createForm.missionId}
                  onChange={(e) => setCreateForm({ ...createForm, missionId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                >
                  <option value="">Sélectionnez la mission active...</option>
                  {activeMissions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.reference} — {a.title} ({a.locationName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Plaque d Immatriculation
                  </label>
                  <input
                    type="text"
                    value={createForm.vehiclePlate}
                    onChange={(e) => setCreateForm({ ...createForm, vehiclePlate: e.target.value.toUpperCase() })}
                    placeholder="ex. RC-4589-A"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nom du Chauffeur
                  </label>
                  <input
                    type="text"
                    value={createForm.driverName}
                    onChange={(e) => setCreateForm({ ...createForm, driverName: e.target.value })}
                    placeholder="ex. Alpha Oumar Barry"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Numéro de Permis de Conduire
                  </label>
                  <input
                    type="text"
                    value={createForm.driverLicenseNumber}
                    onChange={(e) => setCreateForm({ ...createForm, driverLicenseNumber: e.target.value })}
                    placeholder="ex. PC-2024-12345"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Téléphone du Chauffeur
                  </label>
                  <input
                    type="text"
                    value={createForm.driverPhone}
                    onChange={(e) => setCreateForm({ ...createForm, driverPhone: e.target.value })}
                    placeholder="+224 6XX XX XX XX"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  />
                </div>
              </div>

              {/* THREE-STATE CHECKPOINTS */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center justify-between">
                  <span>Points de Contrôle Réglementaires (3 États)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Par défaut: Non Vérifié</span>
                </h4>

                {[
                  { key: 'checkpointDriverLicense', label: '1. Permis de conduire valide' },
                  { key: 'checkpointVehiclePermit', label: '2. Vignette municipale / Autorisation AOTUC' },
                  { key: 'checkpointTechnicalVisit', label: '3. Visite technique à jour' },
                  { key: 'isAuthorizedRoute', label: '4. Respect de l itinéraire autorisé' },
                  { key: 'checkpointFireExtinguisher', label: '5. Extincteur & trousse de secours' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{label}</span>
                    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => setCreateForm({ ...createForm, [key]: 'CONFORME' })}
                        className={`px-2 py-1 text-[10px] font-bold rounded ${
                          createForm[key as keyof typeof createForm] === 'CONFORME'
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Conforme
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateForm({ ...createForm, [key]: 'NON_CONFORME' })}
                        className={`px-2 py-1 text-[10px] font-bold rounded ${
                          createForm[key as keyof typeof createForm] === 'NON_CONFORME'
                            ? 'bg-rose-600 text-white'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Non Conforme
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateForm({ ...createForm, [key]: 'NOT_CHECKED' })}
                        className={`px-2 py-1 text-[10px] font-bold rounded ${
                          createForm[key as keyof typeof createForm] === 'NOT_CHECKED'
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                            : 'text-slate-400'
                        }`}
                      >
                        Non Vérifié
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* OUTCOME & INFRACTIONS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Décision d Issue (Outcome)
                  </label>
                  <select
                    value={createForm.outcome}
                    onChange={(e) => setCreateForm({ ...createForm, outcome: e.target.value as InspectionOutcome })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg font-semibold"
                  >
                    <option value="NOT_ASSESSED">Non Évalué</option>
                    <option value="CONFORME">Conforme</option>
                    <option value="AVERTISSEMENT">Avec Réserves (Avertissement)</option>
                    <option value="NON_CONFORME">Non Conforme</option>
                    <option value="INFRACTION">Infraction Majeure (Immobilisation)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Photo / Preuve Documentaire (URL)
                  </label>
                  <input
                    type="text"
                    value={createForm.evidenceUrl}
                    onChange={(e) => setCreateForm({ ...createForm, evidenceUrl: e.target.value })}
                    placeholder="https://... ou identifiant photo"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Infractions Constatées
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={infractionInput}
                    onChange={(e) => setInfractionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddInfraction();
                      }
                    }}
                    placeholder="ex. Défaut de vignette municipale..."
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleAddInfraction}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-semibold hover:bg-slate-300"
                  >
                    Ajouter
                  </button>
                </div>
                {createForm.infractions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {createForm.infractions.map((inf, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200"
                      >
                        <span>{inf}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveInfraction(i)}
                          className="hover:text-rose-900 font-bold ml-1"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Observations et Notes de Terrain
                </label>
                <textarea
                  rows={2}
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  placeholder="Circonstances, déclaration de l usager ou du chauffeur..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer le Contrôle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECTION DETAIL MODAL */}
      {showDetailModal && selectedInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-emerald-600">
                  {selectedInspection.reference}
                </span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Détail du Contrôle de Terrain
                </h3>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Date et heure :</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {new Date(selectedInspection.inspectedAt).toLocaleString('fr-FR')}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Véhicule :</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                  {selectedInspection.plateNumber || 'Non spécifié'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Chauffeur :</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {selectedInspection.driverName || 'Non renseigné'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Permis :</span>
                <span className="font-medium font-mono text-slate-900 dark:text-slate-100">
                  {selectedInspection.licenseNumber || 'Non renseigné'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Résultat global :</span>
                <div>{renderOutcomeBadge(selectedInspection.outcome)}</div>
              </div>

              {/* Checkpoints summary */}
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg space-y-1.5">
                <div className="font-bold text-slate-700 dark:text-slate-300 text-[11px] mb-1">
                  Vérifications Réglementaires
                </div>
                <div className="flex justify-between">
                  <span>Permis de conduire :</span>
                  <span>{renderCheckpointPill(selectedInspection.hasValidLicense, 'Permis')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vignette municipale :</span>
                  <span>{renderCheckpointPill(selectedInspection.hasMunicipalSticker, 'Vignette')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Visite technique :</span>
                  <span>{renderCheckpointPill(selectedInspection.hasTechnicalControl, 'Visite')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Itinéraire autorisé :</span>
                  <span>{renderCheckpointPill(selectedInspection.isAuthorizedRoute, 'Itinéraire')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sécurité & Extincteur :</span>
                  <span>{renderCheckpointPill(selectedInspection.hasSafetyEquipment, 'Sécurité')}</span>
                </div>
              </div>

              {selectedInspection.observations && (
                <div>
                  <span className="text-slate-500 font-semibold block mb-1">Observations :</span>
                  <p className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 italic">
                    "{selectedInspection.observations}"
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowDetailModal(false)}
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectionsTab;
