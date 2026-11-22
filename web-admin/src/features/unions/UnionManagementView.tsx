import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  MapPin,
  Phone,
  Mail,
  User,
  Users,
  Car,
  Shield,
  X,
} from 'lucide-react';
import { UserContext, TransportUnionRecord, UnionStatus } from '../../types';
import { hasRolePermission, PERMISSIONS } from '../../utils/permissions';
import { buildApiUrl, parseApiResponse, getStoredAuthToken } from '../../utils/api';

interface UnionManagementViewProps {
  currentUser: UserContext;
}

const CONAKRY_COMMUNES = [
  'Kaloum',
  'Dixinn',
  'Matam',
  'Ratoma',
  'Matoto',
];

export const UnionManagementView: React.FC<UnionManagementViewProps> = ({ currentUser }) => {
  const [unions, setUnions] = useState<TransportUnionRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [communeFilter, setCommuneFilter] = useState<string>('ALL');

  // Modals state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [selectedUnion, setSelectedUnion] = useState<TransportUnionRecord | null>(null);
  const [detailedUnion, setDetailedUnion] = useState<TransportUnionRecord | null>(null);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState<boolean>(false);

  // Form state
  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formRegNumber, setFormRegNumber] = useState<string>('');
  const [formPresident, setFormPresident] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formCommuneId, setFormCommuneId] = useState<string>('');
  const [formLogoUrl, setFormLogoUrl] = useState<string>('');
  const [formStatus, setFormStatus] = useState<UnionStatus>('ACTIF');
  const [statusReason, setStatusReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<string | null>(null);

  // Active sub-tab in details drawer: 'info' | 'drivers' | 'owners' | 'docs'
  const [detailsTab, setDetailsTab] = useState<'info' | 'drivers' | 'owners' | 'docs'>('info');

  const canManageUnions = hasRolePermission(currentUser.role, PERMISSIONS.UNIONS_MANAGE);

  // Fetch list of unions from backend
  const fetchUnions = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const token = getStoredAuthToken();
      if (!token) {
        throw new Error('Jeton d’accès manquant. Veuillez vous reconnecter.');
      }

      const res = await fetch(buildApiUrl('/api/v1/unions?limit=100'), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      const body = await parseApiResponse<any>(res);
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || `Échec du chargement des syndicats (HTTP ${res.status}).`);
      }

      setUnions(body.data?.items || body.items || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Impossible de contacter le serveur.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnions();
  }, [fetchUnions]);

  // Fetch detailed union with member drivers & owners
  const fetchUnionDetails = async (id: string) => {
    try {
      const token = getStoredAuthToken();
      const res = await fetch(buildApiUrl(`/api/v1/unions/${id}`), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      const body = await parseApiResponse<any>(res);
      if (res.ok && body?.success && body.data) {
        setDetailedUnion(body.data);
      }
    } catch (_) {}
  };

  const handleOpenDetails = async (union: TransportUnionRecord) => {
    setSelectedUnion(union);
    setDetailedUnion(union);
    setDetailsTab('info');
    setIsDetailsDrawerOpen(true);
    await fetchUnionDetails(union.id);
  };

  const handleOpenRegister = () => {
    setFormName('');
    setFormCode('');
    setFormRegNumber('');
    setFormPresident('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormCommuneId('');
    setFormLogoUrl('');
    setFormStatus('ACTIF');
    setFormErrors(null);
    setIsRegisterModalOpen(true);
  };

  const handleOpenEdit = (union: TransportUnionRecord) => {
    setSelectedUnion(union);
    setFormName(union.name || '');
    setFormCode(union.code || '');
    setFormRegNumber(union.registrationNumber || '');
    setFormPresident(union.presidentName || '');
    setFormPhone(union.contactPhone || '');
    setFormEmail(union.contactEmail || '');
    setFormAddress(union.headquartersAddress || '');
    setFormCommuneId(union.communeId || '');
    setFormLogoUrl(union.logoUrl || '');
    setFormStatus(union.status || 'ACTIF');
    setFormErrors(null);
    setIsEditModalOpen(true);
  };

  const handleOpenStatusModal = (union: TransportUnionRecord) => {
    setSelectedUnion(union);
    setFormStatus(union.status);
    setStatusReason('');
    setFormErrors(null);
    setIsStatusModalOpen(true);
  };

  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim()) {
      setFormErrors('Le nom officiel et le sigle du syndicat sont obligatoires.');
      return;
    }

    setIsSubmitting(true);
    setFormErrors(null);
    try {
      const token = getStoredAuthToken();
      const payload: any = {
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        registrationNumber: formRegNumber.trim() || null,
        presidentName: formPresident.trim() || null,
        contactPhone: formPhone.trim() || null,
        contactEmail: formEmail.trim() || null,
        headquartersAddress: formAddress.trim() || null,
        logoUrl: formLogoUrl.trim() || null,
        status: formStatus,
      };

      const res = await fetch(buildApiUrl('/api/v1/unions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const body = await parseApiResponse<any>(res);
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || `Erreur lors de l'enregistrement (HTTP ${res.status}).`);
      }

      setSuccessMessage(`Le syndicat « ${body.data.code} — ${body.data.name} » a été enregistré avec succès dans PostgreSQL.`);
      setIsRegisterModalOpen(false);
      await fetchUnions();
    } catch (err: any) {
      setFormErrors(err.message || "Échec de l'enregistrement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnion) return;

    setIsSubmitting(true);
    setFormErrors(null);
    try {
      const token = getStoredAuthToken();
      const payload: any = {
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        registrationNumber: formRegNumber.trim() || null,
        presidentName: formPresident.trim() || null,
        contactPhone: formPhone.trim() || null,
        contactEmail: formEmail.trim() || null,
        headquartersAddress: formAddress.trim() || null,
        logoUrl: formLogoUrl.trim() || null,
        status: formStatus,
      };

      const res = await fetch(buildApiUrl(`/api/v1/unions/${selectedUnion.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const body = await parseApiResponse<any>(res);
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || `Erreur lors de la mise à jour (HTTP ${res.status}).`);
      }

      setSuccessMessage(`Syndicat « ${body.data.code} » mis à jour avec succès.`);
      setIsEditModalOpen(false);
      await fetchUnions();
      if (detailedUnion && detailedUnion.id === selectedUnion.id) {
        await fetchUnionDetails(selectedUnion.id);
      }
    } catch (err: any) {
      setFormErrors(err.message || 'Échec de la modification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnion) return;

    setIsSubmitting(true);
    setFormErrors(null);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(buildApiUrl(`/api/v1/unions/${selectedUnion.id}/status`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: formStatus,
          reason: statusReason.trim() || undefined,
        }),
      });

      const body = await parseApiResponse<any>(res);
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || `Erreur lors de la mise à jour du statut (HTTP ${res.status}).`);
      }

      setSuccessMessage(`Statut du syndicat actualisé à « ${formStatus} » avec journalisation de sécurité.`);
      setIsStatusModalOpen(false);
      await fetchUnions();
      if (detailedUnion && detailedUnion.id === selectedUnion.id) {
        await fetchUnionDetails(selectedUnion.id);
      }
    } catch (err: any) {
      setFormErrors(err.message || 'Échec de la mise à jour du statut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered unions
  const filteredUnions = useMemo(() => {
    return unions.filter((u) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.code.toLowerCase().includes(q) ||
        (u.registrationNumber && u.registrationNumber.toLowerCase().includes(q)) ||
        (u.presidentName && u.presidentName.toLowerCase().includes(q)) ||
        (u.contactPhone && u.contactPhone.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
      const matchesCommune =
        communeFilter === 'ALL' ||
        (u.commune && u.commune.name.toLowerCase() === communeFilter.toLowerCase());

      return matchesSearch && matchesStatus && matchesCommune;
    });
  }, [unions, searchTerm, statusFilter, communeFilter]);

  // Status stats
  const stats = useMemo(() => {
    const total = unions.length;
    const active = unions.filter((u) => u.status === 'ACTIF').length;
    const suspended = unions.filter((u) => u.status === 'SUSPENDU').length;
    const pending = unions.filter((u) => u.status === 'EN_ATTENTE_VALIDATION').length;
    const rejected = unions.filter((u) => u.status === 'REJETE').length;
    const totalDrivers = unions.reduce((acc, u) => acc + (u._count?.members || 0), 0);
    const totalOwners = unions.reduce((acc, u) => acc + (u._count?.owners || 0), 0);
    return { total, active, suspended, pending, rejected, totalDrivers, totalOwners };
  }, [unions]);

  const renderStatusBadge = (status: UnionStatus) => {
    switch (status) {
      case 'ACTIF':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Actif
          </span>
        );
      case 'SUSPENDU':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Suspendu
          </span>
        );
      case 'EN_ATTENTE_VALIDATION':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
            <Clock className="w-3 h-3 mr-1" />
            En attente
          </span>
        );
      case 'REJETE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400 border border-red-300 dark:border-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Rejeté
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Gestion des Syndicats & Organisations Professionnelles
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enregistrement officiel des syndicats de transport, suivi des agréments, contrôle des statuts et affiliation des chauffeurs & propriétaires à Conakry.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchUnions}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>

          {canManageUnions && (
            <button
              onClick={handleOpenRegister}
              className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Enregistrer un Syndicat</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Syndicats</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{stats.total}</span>
            <span className="text-xs text-slate-400">Organisations</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Actifs Habilités</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{stats.active}</span>
            <span className="text-xs text-emerald-600/70 font-semibold">Autorisés</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Suspendus / En Attente</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{stats.suspended + stats.pending}</span>
            <span className="text-xs text-amber-600/70">{stats.suspended} susp. • {stats.pending} att.</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Membres Affiliés</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{stats.totalDrivers + stats.totalOwners}</span>
            <span className="text-xs text-indigo-600/70">{stats.totalDrivers} Chauff. • {stats.totalOwners} Prop.</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom, sigle (ex: FNTG, USTG), agrément, président..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-emerald-500 dark:text-white"
          />
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filtres :</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white focus:outline-hidden"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIF">Actif</option>
            <option value="SUSPENDU">Suspendu</option>
            <option value="EN_ATTENTE_VALIDATION">En attente de validation</option>
            <option value="REJETE">Rejeté</option>
          </select>

          <select
            value={communeFilter}
            onChange={(e) => setCommuneFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white focus:outline-hidden"
          >
            <option value="ALL">Toutes les communes</option>
            {CONAKRY_COMMUNES.map((comm) => (
              <option key={comm} value={comm}>{comm}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Syndicats Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Sigle & Organisation</th>
                <th className="py-3 px-4">Agrément Officiel</th>
                <th className="py-3 px-4">Président & Contact</th>
                <th className="py-3 px-4">Commune & Siège</th>
                <th className="py-3 px-4 text-center">Affiliés</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    <span>Chargement des syndicats depuis PostgreSQL...</span>
                  </td>
                </tr>
              ) : filteredUnions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-slate-600 dark:text-slate-400">Aucun syndicat trouvé</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {unions.length === 0
                        ? "Aucune organisation professionnelle enregistrée pour l'instant."
                        : "Aucun résultat ne correspond aux filtres de recherche."}
                    </p>
                    {canManageUnions && unions.length === 0 && (
                      <button
                        onClick={handleOpenRegister}
                        className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Enregistrer le premier syndicat</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredUnions.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        {u.logoUrl ? (
                          <img
                            src={u.logoUrl}
                            alt={u.code}
                            className="w-8 h-8 rounded-md object-contain bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-emerald-200 dark:border-emerald-800">
                            {u.code.substring(0, 3)}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-extrabold">{u.code}</span>
                            <span>•</span>
                            <span>{u.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Enregistré le {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {u.registrationNumber ? (
                        <div className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded inline-block">
                          {u.registrationNumber}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Non renseigné</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center space-x-1">
                          <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="truncate max-w-[150px]">{u.presidentName || 'Présidence non renseignée'}</span>
                        </div>
                        {u.contactPhone && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span>{u.contactPhone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                          <span>{u.commune?.name || 'Toutes communes'}</span>
                        </div>
                        {u.headquartersAddress && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                            {u.headquartersAddress}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center space-x-2 text-[11px]">
                        <span className="flex items-center space-x-0.5 text-slate-600 dark:text-slate-400" title="Chauffeurs membres">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span className="font-bold">{u._count?.members || 0}</span>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center space-x-0.5 text-slate-600 dark:text-slate-400" title="Propriétaires">
                          <Car className="w-3 h-3 text-slate-400" />
                          <span className="font-bold">{u._count?.owners || 0}</span>
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {renderStatusBadge(u.status)}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center space-x-1">
                        <button
                          onClick={() => handleOpenDetails(u)}
                          title="Consulter la fiche détaillée et les membres"
                          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {canManageUnions && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(u)}
                              title="Modifier les informations"
                              className="p-1.5 text-slate-500 hover:text-emerald-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleOpenStatusModal(u)}
                              title="Changer le statut (Activer / Suspendre / Rejeter)"
                              className="p-1.5 text-slate-500 hover:text-amber-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. REGISTER MODAL (SUPER_ADMIN ONLY)                                      */}
      {/* ========================================================================= */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Enregistrer un Nouveau Syndicat / Organisation
                </h2>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRegister} className="p-5 overflow-y-auto space-y-4">
              {formErrors && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 text-red-800 dark:text-red-300 rounded-lg text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formErrors}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nom officiel de l'organisation *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="ex: Fédération Nationale des Transports de Guinée"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sigle / Acronyme *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="ex: FNTG"
                    className="w-full px-3 py-2 font-mono font-bold uppercase bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    N° d'Agrément / Récépissé Officiel
                  </label>
                  <input
                    type="text"
                    value={formRegNumber}
                    onChange={(e) => setFormRegNumber(e.target.value)}
                    placeholder="ex: AGR-2026-MATD-0044"
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nom du Président / Secrétaire Général
                  </label>
                  <input
                    type="text"
                    value={formPresident}
                    onChange={(e) => setFormPresident(e.target.value)}
                    placeholder="ex: Elhadj Mamadou Diallo"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Téléphone de Contact
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+224 6XX XX XX XX"
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email Officiel
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="contact@syndicat.gn"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Commune de Rattachement (Optionnel)
                  </label>
                  <select
                    value={formCommuneId}
                    onChange={(e) => setFormCommuneId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  >
                    <option value="">National / Toutes les communes</option>
                    {/* We can map from loaded communes or let user pick */}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Statut Initial
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as UnionStatus)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  >
                    <option value="ACTIF">ACTIF (Habilité immédiatement)</option>
                    <option value="EN_ATTENTE_VALIDATION">EN_ATTENTE_VALIDATION (Vérification pièces)</option>
                    <option value="SUSPENDU">SUSPENDU (Temporairement inactif)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Adresse du Siège Social / Quartier
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="ex: Immeuble Syndical, Madina Marché, Matam, Conakry"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  URL du Logo / Emblème (Optionnel)
                </label>
                <input
                  type="url"
                  value={formLogoUrl}
                  onChange={(e) => setFormLogoUrl(e.target.value)}
                  placeholder="https://... ou chemin de stockage"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement en cours...' : 'Confirmer l’Enregistrement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. EDIT MODAL (SUPER_ADMIN ONLY)                                          */}
      {/* ========================================================================= */}
      {isEditModalOpen && selectedUnion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Edit2 className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Modifier le Syndicat : {selectedUnion.code}
                </h2>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-5 overflow-y-auto space-y-4">
              {formErrors && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 text-red-800 dark:text-red-300 rounded-lg text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formErrors}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nom officiel de l'organisation *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sigle / Acronyme *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 font-mono font-bold uppercase bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    N° d'Agrément / Récépissé
                  </label>
                  <input
                    type="text"
                    value={formRegNumber}
                    onChange={(e) => setFormRegNumber(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Président / Responsable
                  </label>
                  <input
                    type="text"
                    value={formPresident}
                    onChange={(e) => setFormPresident(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Adresse / Siège Social
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  URL du Logo
                </label>
                <input
                  type="url"
                  value={formLogoUrl}
                  onChange={(e) => setFormLogoUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Sauvegarde...' : 'Enregistrer les Modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. STATUS CHANGE MODAL                                                    */}
      {/* ========================================================================= */}
      {isStatusModalOpen && selectedUnion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Changer le Statut : {selectedUnion.code}
                </h2>
              </div>
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitStatusChange} className="p-4 space-y-4">
              {formErrors && (
                <div className="p-2.5 bg-red-50 text-red-800 rounded text-xs flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formErrors}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs space-y-1">
                <div className="text-slate-500">Organisation : <span className="font-bold text-slate-900 dark:text-white">{selectedUnion.name}</span></div>
                <div className="text-slate-500">Statut actuel : <span className="font-bold">{selectedUnion.status}</span></div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nouveau statut réglementaire *
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as UnionStatus)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                >
                  <option value="ACTIF">ACTIF — Organisation habilitée et reconnue</option>
                  <option value="SUSPENDU">SUSPENDU — Organisation suspendue provisoirement</option>
                  <option value="EN_ATTENTE_VALIDATION">EN_ATTENTE_VALIDATION — Pièces justificatives en cours d'examen</option>
                  <option value="REJETE">REJETE — Demande de reconnaissance rejetée</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Motif de la décision / Référence administrative
                </label>
                <textarea
                  rows={3}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="ex: Arrêté ministériel portant suspension conservatoire suite à non-conformité..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition"
                >
                  {isSubmitting ? 'Mise à jour...' : 'Appliquer le Statut'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DETAILS DRAWER / MODAL (WITH MEMBER DRIVERS & OWNERS)                  */}
      {/* ========================================================================= */}
      {isDetailsDrawerOpen && detailedUnion && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full w-full max-w-xl flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center space-x-3">
                {detailedUnion.logoUrl ? (
                  <img
                    src={detailedUnion.logoUrl}
                    alt={detailedUnion.code}
                    className="w-10 h-10 rounded-md object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                    {detailedUnion.code.substring(0, 3)}
                  </div>
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-extrabold text-emerald-700 dark:text-emerald-400">{detailedUnion.code}</span>
                    {renderStatusBadge(detailedUnion.status)}
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[280px]">
                    {detailedUnion.name}
                  </h2>
                </div>
              </div>

              <button
                onClick={() => setIsDetailsDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-tabs header */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 bg-slate-50/30">
              <button
                onClick={() => setDetailsTab('info')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                  detailsTab === 'info'
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Informations & Agrément
              </button>
              <button
                onClick={() => setDetailsTab('drivers')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
                  detailsTab === 'drivers'
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>Chauffeurs</span>
                <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 text-[10px] rounded-full">
                  {detailedUnion.members?.length ?? detailedUnion._count?.members ?? 0}
                </span>
              </button>
              <button
                onClick={() => setDetailsTab('owners')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
                  detailsTab === 'owners'
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>Propriétaires</span>
                <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 text-[10px] rounded-full">
                  {detailedUnion.owners?.length ?? detailedUnion._count?.owners ?? 0}
                </span>
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {detailsTab === 'info' && (
                <div className="space-y-4 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Agrément & Enregistrement</div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-slate-500">N° d'Agrément :</span>
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {detailedUnion.registrationNumber || 'Non renseigné'}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Date de création :</span>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {new Date(detailedUnion.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Gouvernance & Contacts</div>
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center space-x-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500">Président :</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{detailedUnion.presidentName || 'Non renseigné'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500">Téléphone :</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{detailedUnion.contactPhone || 'Non renseigné'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500">Email :</span>
                        <span className="text-slate-800 dark:text-slate-200">{detailedUnion.contactEmail || 'Non renseigné'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500">Siège :</span>
                        <span className="text-slate-800 dark:text-slate-200">{detailedUnion.headquartersAddress || 'Non renseigné'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Synthèse des Affiliations</div>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="p-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-center">
                        <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                          {detailedUnion.members?.length ?? detailedUnion._count?.members ?? 0}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">Chauffeurs Enrôlés</div>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-center">
                        <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                          {detailedUnion.owners?.length ?? detailedUnion._count?.owners ?? 0}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">Propriétaires Rattachés</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {detailsTab === 'drivers' && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Conducteurs enregistrés sous l'égide de {detailedUnion.code} :
                  </div>
                  {!detailedUnion.members || detailedUnion.members.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                      <Users className="w-6 h-6 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">Aucun conducteur affilié à ce syndicat pour le moment.</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Les chauffeurs peuvent sélectionner {detailedUnion.code} lors de leur enregistrement.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                      {detailedUnion.members.map((driver) => (
                        <div key={driver.id} className="p-3 flex items-center justify-between bg-white dark:bg-slate-800/60">
                          <div className="flex items-center space-x-3">
                            {driver.person?.photoUrl ? (
                              <img
                                src={driver.person.photoUrl}
                                alt={driver.person.firstName}
                                className="w-8 h-8 rounded-full object-cover border border-slate-300 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                {driver.person?.firstName?.charAt(0) || 'C'}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white text-xs">
                                {driver.person?.firstName} {driver.person?.lastName}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                Permis : {driver.drivingLicenseNumber} • NIN : {driver.person?.nin}
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-[11px] text-slate-500 font-mono">
                            {driver.person?.phoneNumber}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {detailsTab === 'owners' && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Propriétaires rattachés à {detailedUnion.code} :
                  </div>
                  {!detailedUnion.owners || detailedUnion.owners.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                      <Car className="w-6 h-6 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">Aucun propriétaire affilié à ce syndicat pour le moment.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                      {detailedUnion.owners.map((owner) => (
                        <div key={owner.id} className="p-3 flex items-center justify-between bg-white dark:bg-slate-800/60">
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white text-xs">
                              {owner.businessName || `${owner.person?.firstName} ${owner.person?.lastName}`}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Type : {owner.ownerType} • NIN : {owner.person?.nin}
                            </div>
                          </div>
                          <div className="text-right text-[11px] text-slate-500 font-mono">
                            {owner.person?.phoneNumber}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnionManagementView;
