import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Phone,
  Mail,
  MapPin,
  Copy,
  Edit2,
  Lock,
  Unlock,
  RefreshCw,
  Check,
} from 'lucide-react';
import { UserContext, AgentItem, AgentAccountStatus } from '../../types';
import { buildApiUrl, getStoredAuthToken } from '../../utils/api';
import { OFFICIAL_COMMUNES } from '../../config/communes';

interface AgentsManagementTabProps {
  currentUser: UserContext;
}

export const AgentsManagementTab: React.FC<AgentsManagementTabProps> = ({ currentUser }) => {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const isChef = currentUser.role === 'CHEF_SERVICE';
  const [communeFilter, setCommuneFilter] = useState<string>(currentUser.communeId || 'ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState<boolean>(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentItem | null>(null);

  // Generated credentials to show creator once
  const [createdCredentials, setCreatedCredentials] = useState<{
    agent: AgentItem;
    initialPassword?: string;
  } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState<boolean>(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    jobTitle: 'Agent de Terrain AOTUC',
    employeeNumber: '',
    address: '',
    communeId: isChef ? (currentUser.communeId || '') : '',
    password: '',
  });

  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    jobTitle: '',
    employeeNumber: '',
    address: '',
  });

  const [statusForm, setStatusForm] = useState({
    status: 'ACTIVE' as AgentAccountStatus,
    reason: '',
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getStoredAuthToken();
      const params = new URLSearchParams();
      if (communeFilter !== 'ALL' && !isChef) params.append('communeId', communeFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);

      const url = buildApiUrl(`/api/v1/field/agents?${params.toString()}`);
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Impossible de charger la liste des agents.');
      }

      const data = await res.json();
      setAgents(data.items || []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des agents.');
    } finally {
      setIsLoading(false);
    }
  }, [communeFilter, statusFilter, searchTerm, isChef]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const token = getStoredAuthToken();
      const payload: any = {
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        phoneNumber: createForm.phoneNumber.trim(),
        jobTitle: createForm.jobTitle.trim(),
      };
      if (createForm.email) payload.email = createForm.email.trim();
      if (createForm.employeeNumber) payload.employeeNumber = createForm.employeeNumber.trim();
      if (createForm.address) payload.address = createForm.address.trim();
      if (createForm.password) payload.password = createForm.password.trim();
      if (!isChef && createForm.communeId) payload.communeId = createForm.communeId;

      const res = await fetch(buildApiUrl('/api/v1/field/agents'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erreur lors de la création de l agent.');
      }

      setShowCreateModal(false);
      setCreatedCredentials({
        agent: data.agent,
        initialPassword: data.initialPassword,
      });
      setShowCredentialsModal(true);

      // Reset form
      setCreateForm({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        email: '',
        jobTitle: 'Agent de Terrain AOTUC',
        employeeNumber: '',
        address: '',
        communeId: isChef ? (currentUser.communeId || '') : '',
        password: '',
      });

      fetchAgents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAgent = async (e: React.FormEvent) => {
    if (!selectedAgent) return;
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const token = getStoredAuthToken();
      const payload: any = {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phoneNumber: editForm.phoneNumber.trim(),
        jobTitle: editForm.jobTitle.trim(),
      };
      if (editForm.email) payload.email = editForm.email.trim();
      if (editForm.employeeNumber) payload.employeeNumber = editForm.employeeNumber.trim();
      if (editForm.address) payload.address = editForm.address.trim();

      const res = await fetch(buildApiUrl(`/api/v1/field/agents/${selectedAgent.id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erreur lors de la modification du profil.');
      }

      setShowEditModal(false);
      setSelectedAgent(null);
      fetchAgents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    if (!selectedAgent) return;
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(buildApiUrl(`/api/v1/field/agents/${selectedAgent.id}/status`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          status: statusForm.status,
          reason: statusForm.reason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erreur lors de la modification du statut.');
      }

      setShowStatusModal(false);
      setSelectedAgent(null);
      fetchAgents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (agent: AgentItem) => {
    setSelectedAgent(agent);
    setEditForm({
      firstName: agent.firstName,
      lastName: agent.lastName,
      phoneNumber: agent.phoneNumber,
      email: agent.email || '',
      jobTitle: agent.jobTitle || '',
      employeeNumber: agent.employeeNumber || '',
      address: agent.address || '',
    });
    setShowEditModal(true);
  };

  const openStatusModal = (agent: AgentItem) => {
    setSelectedAgent(agent);
    setStatusForm({
      status: agent.accountStatus,
      reason: '',
    });
    setShowStatusModal(true);
  };

  const renderStatusBadge = (status: AgentAccountStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Actif
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-3 h-3 mr-1 text-amber-600" /> Suspendu
          </span>
        );
      case 'INACTIVE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3 h-3 mr-1 text-rose-600" /> Inactif
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Action and Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher nom, matricule, téléphone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

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

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Tous les Statuts</option>
              <option value="ACTIVE">Actif</option>
              <option value="SUSPENDED">Suspendu</option>
              <option value="INACTIVE">Inactif</option>
            </select>

            <button
              onClick={fetchAgents}
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
              <UserPlus className="w-3.5 h-3.5" />
              <span>Créer un Agent AOTUC</span>
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

      {/* Agents Roster Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Effectif des Agents de Terrain ({agents.length})
            </h2>
          </div>
          {isChef && (
            <span className="text-xs text-slate-500">
              Commune : <strong className="text-slate-700 dark:text-slate-300">{currentUser.communeName}</strong>
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Matricule</th>
                <th className="px-4 py-3">Commune & Équipe</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Missions / Contrôles</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-emerald-600" />
                    Chargement des agents...
                  </td>
                </tr>
              ) : agents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Aucun agent de terrain trouvé.
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xs">
                          {agent.firstName.charAt(0)}{agent.lastName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold">{agent.firstName} {agent.lastName}</div>
                          <div className="text-[11px] text-slate-400">{agent.jobTitle || 'Agent de Terrain'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                        {agent.employeeNumber || 'NON DÉFINI'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1 text-slate-700 dark:text-slate-300 font-medium">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{agent.commune?.name || 'Non assigné'}</span>
                      </div>
                      {agent.assignedTeam && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Équipe : {agent.assignedTeam.name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1 text-slate-700 dark:text-slate-300">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{agent.phoneNumber}</span>
                      </div>
                      {agent.email && (
                        <div className="flex items-center space-x-1 text-[11px] text-slate-400 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{agent.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700 dark:text-slate-300">
                        <span className="font-semibold text-emerald-600">{agent.missionsCount || 0}</span> missions
                      </div>
                      <div className="text-[11px] text-slate-400">
                        <span className="font-semibold">{agent.inspectionsCount || 0}</span> contrôles
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {renderStatusBadge(agent.accountStatus)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => openEditModal(agent)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
                          title="Modifier le profil"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openStatusModal(agent)}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
                          title="Changer le statut (Activer / Suspendre / Désactiver)"
                        >
                          {agent.accountStatus === 'ACTIVE' ? (
                            <Lock className="w-3.5 h-3.5 text-amber-500" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE AGENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Création d un Nouvel Agent de Terrain
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    placeholder="ex. Mamadou"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Nom de Famille *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    placeholder="ex. Diallo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Téléphone (+224...) *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.phoneNumber}
                    onChange={(e) => setCreateForm({ ...createForm, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    placeholder="+224 62X XX XX XX"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Email professionnel (optionnel)
                  </label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    placeholder="agent@aotuc.gov.gn"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Fonction / Poste
                  </label>
                  <input
                    type="text"
                    value={createForm.jobTitle}
                    onChange={(e) => setCreateForm({ ...createForm, jobTitle: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Matricule / Identifiant (optionnel)
                  </label>
                  <input
                    type="text"
                    value={createForm.employeeNumber}
                    onChange={(e) => setCreateForm({ ...createForm, employeeNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    placeholder="Généré auto si vide (AGT-XXX-...)"
                  />
                </div>
              </div>

              {!isChef && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Commune d Affectation *
                  </label>
                  <select
                    required
                    value={createForm.communeId}
                    onChange={(e) => setCreateForm({ ...createForm, communeId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Sélectionnez la commune</option>
                    {OFFICIAL_COMMUNES.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Adresse de résidence / Quartier
                </label>
                <input
                  type="text"
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  placeholder="ex. Quartier Almamya, Kaloum"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Mot de passe initial (optionnel)
                </label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  placeholder="Laisser vide pour générer un mot de passe sécurisé"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Création en cours...' : 'Enregistrer l Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREDENTIALS SUCCESS MODAL */}
      {showCredentialsModal && createdCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Compte Agent Créé avec Succès !
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Veuillez communiquer ces identifiants sécurisés à l agent.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500">Nom complet :</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {createdCredentials.agent.firstName} {createdCredentials.agent.lastName}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500">Matricule :</span>
                <span className="font-mono font-bold text-emerald-600">
                  {createdCredentials.agent.employeeNumber}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500">Téléphone (identifiant) :</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {createdCredentials.agent.phoneNumber}
                </span>
              </div>
              {createdCredentials.initialPassword && (
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-500 font-medium">Mot de passe temporaire :</span>
                  <div className="flex items-center space-x-1">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded border border-amber-300 dark:border-amber-700">
                      {createdCredentials.initialPassword}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(createdCredentials.initialPassword || '');
                        setCopiedPassword(true);
                        setTimeout(() => setCopiedPassword(false), 2000);
                      }}
                      className="p-1 text-slate-500 hover:text-emerald-600"
                      title="Copier le mot de passe"
                    >
                      {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setShowCredentialsModal(false);
                setCreatedCredentials(null);
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              Fermer et Poursuivre
            </button>
          </div>
        </div>
      )}

      {/* EDIT AGENT MODAL */}
      {showEditModal && selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Modifier le Profil de l Agent
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleUpdateAgent} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Prénom</label>
                  <input
                    type="text"
                    required
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nom</label>
                  <input
                    type="text"
                    required
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Téléphone</label>
                  <input
                    type="text"
                    required
                    value={editForm.phoneNumber}
                    onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Fonction</label>
                  <input
                    type="text"
                    value={editForm.jobTitle}
                    onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Matricule</label>
                  <input
                    type="text"
                    value={editForm.employeeNumber}
                    onChange={(e) => setEditForm({ ...editForm, employeeNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Adresse</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Mettre à Jour'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATUS CHANGE MODAL */}
      {showStatusModal && selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Modifier le Statut du Compte Agent
              </h3>
              <button onClick={() => setShowStatusModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-4 text-xs">
              <div>
                <span className="text-slate-500">Agent concerné :</span>
                <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedAgent.firstName} {selectedAgent.lastName} ({selectedAgent.employeeNumber || selectedAgent.phoneNumber})
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Nouveau Statut *</label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value as AgentAccountStatus })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                >
                  <option value="ACTIVE">Actif (Session et jetons autorisés)</option>
                  <option value="SUSPENDED">Suspendu (Révocation immédiate des sessions)</option>
                  <option value="INACTIVE">Inactif (Compte désactivé)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Motif du Changement</label>
                <textarea
                  rows={3}
                  value={statusForm.reason}
                  onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  placeholder="Justification administrative ou disciplinaire..."
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  {isSubmitting ? 'Application...' : 'Confirmer le Statut'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentsManagementTab;
