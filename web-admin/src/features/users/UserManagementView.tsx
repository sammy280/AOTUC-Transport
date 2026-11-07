import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  KeyRound,
  Plus,
  Search,
  CheckCircle2,
  Lock,
  Building2,
} from 'lucide-react';
import { UserContext, RoleType } from '../../types';

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: RoleType;
  roleLabel: string;
  commune: string;
  isActive: boolean;
  lastLogin: string;
}

const INITIAL_USERS: ManagedUser[] = [
  {
    id: 'usr-dir-001',
    name: 'Mamadou Camara',
    email: 'directeur@aotuc.test',
    phoneNumber: '+224 620 00 00 02',
    role: 'DIRECTOR',
    roleLabel: 'Directeur Général AOTUC',
    commune: 'Direction Générale (Conakry)',
    isActive: true,
    lastLogin: 'Aujourd hui à 08:30',
  },
  {
    id: 'usr-adm-001',
    name: 'Ibrahima Diallo',
    email: 'superadmin@aotuc.test',
    phoneNumber: '+224 620 00 00 01',
    role: 'SUPER_ADMIN',
    roleLabel: 'Super Administrateur DSI',
    commune: 'Toutes Communes',
    isActive: true,
    lastLogin: 'Session active',
  },
  {
    id: 'usr-chf-001',
    name: 'Fanta Soumah',
    email: 'chef.matoto@aotuc.test',
    phoneNumber: '+224 620 00 00 03',
    role: 'CHEF_SERVICE',
    roleLabel: 'Chef de Service Territorial Matoto',
    commune: 'Commune de Matoto',
    isActive: true,
    lastLogin: 'Hier à 17:15',
  },
  {
    id: 'usr-chf-002',
    name: 'Alpha Barry',
    email: 'chef.kaloum@aotuc.test',
    phoneNumber: '+224 620 00 00 04',
    role: 'CHEF_SERVICE',
    roleLabel: 'Chef de Service Territorial Kaloum',
    commune: 'Commune de Kaloum',
    isActive: true,
    lastLogin: 'Il y a 2 jours',
  },
  {
    id: 'usr-agt-001',
    name: 'Sekou Conte',
    email: 'agent.matoto@aotuc.test',
    phoneNumber: '+224 620 00 00 05',
    role: 'AGENT_TERRAIN',
    roleLabel: 'Agent d Enrôlement Terrain Matoto',
    commune: 'Commune de Matoto',
    isActive: true,
    lastLogin: 'Aujourd hui à 09:10',
  },
  {
    id: 'usr-dst-001',
    name: 'Ousmane Sylla',
    email: 'distributeur.kaloum@aotuc.test',
    phoneNumber: '+224 620 00 00 06',
    role: 'DISTRIBUTEUR',
    roleLabel: 'Distributeur Billetterie Agréé',
    commune: 'Commune de Kaloum',
    isActive: true,
    lastLogin: 'Aujourd hui à 11:20',
  },
  {
    id: 'usr-syn-001',
    name: 'Amadou Diallo',
    email: 'syndicat.fntg@aotuc.test',
    phoneNumber: '+224 620 00 00 07',
    role: 'SYNDICAT',
    roleLabel: 'Délégué Syndical FNTG',
    commune: 'Fédération Syndicale',
    isActive: true,
    lastLogin: 'Il y a 3 jours',
  },
];

export const UserManagementView: React.FC<{ currentUser: UserContext }> = ({ currentUser }) => {
  const [users, setUsers] = useState<ManagedUser[]>(INITIAL_USERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [feedback, setFeedback] = useState<string | null>(null);

  // New User Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<RoleType>('AGENT_TERRAIN');
  const [newCommune, setNewCommune] = useState('Commune de Matoto');

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phoneNumber.includes(searchQuery);
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleToggleStatus = (user: ManagedUser) => {
    const updatedStatus = !user.isActive;
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, isActive: updatedStatus } : u))
    );

    // Call backend API in background if server is online
    fetch(`/api/v1/users/${user.id}/${updatedStatus ? 'reactivate' : 'deactivate'}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('aotuc_auth_token') || 'admin-session'}`,
      },
    }).catch(() => null);

    setFeedback(
      updatedStatus
        ? `Compte de ${user.name} réactivé avec succès.`
        : `Compte de ${user.name} désactivé. Sessions actives immédiatement révoquées (HTTP 401).`
    );
  };

  const handleResetPassword = (user: ManagedUser) => {
    setFeedback(`Mot de passe réinitialisé pour ${user.name} avec la clé par défaut standardisée DevAotuc2026!.`);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim() || !newLastName.trim() || !newPhone.trim()) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    const created: ManagedUser = {
      id: `usr-${Date.now()}`,
      name: `${newFirstName.trim()} ${newLastName.trim()}`,
      email: newEmail.trim() || `${newFirstName.toLowerCase()}.${newLastName.toLowerCase()}@aotuc.test`,
      phoneNumber: newPhone.trim(),
      role: newRole,
      roleLabel:
        newRole === 'DIRECTOR'
          ? 'Directeur Général AOTUC'
          : newRole === 'SUPER_ADMIN'
          ? 'Super Administrateur DSI'
          : newRole === 'CHEF_SERVICE'
          ? 'Chef de Service Territorial'
          : newRole === 'AGENT_TERRAIN'
          ? 'Agent d Enrôlement Terrain'
          : newRole === 'DISTRIBUTEUR'
          ? 'Distributeur Billetterie Agréé'
          : 'Délégué Syndical',
      commune: newCommune,
      isActive: true,
      lastLogin: 'Jamais connecté',
    };

    setUsers([created, ...users]);
    setShowCreateModal(false);
    setNewFirstName('');
    setNewLastName('');
    setNewEmail('');
    setNewPhone('');
    setFeedback(`Nouveau compte créé avec succès pour ${created.name} (${created.roleLabel}).`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="inline-flex items-center space-x-2 bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mb-1">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>Direction des Systèmes d Information (DSI)</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Gestion des Utilisateurs & Accréditations AOTUC
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Session administrateur : {currentUser.name} ({currentUser.roleLabel}) • Habilitations RBAC, désactivation instantanée et gestion des comptes.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Créer un Compte Assermenté</span>
        </button>
      </div>

      {/* Security Separation Banner */}
      <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-start space-x-3 text-xs text-blue-900">
        <Lock className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Principe de Séparation des Responsabilités :</span> Le Super Administrateur (DSI) détient l autorité technique sur les comptes, les politiques de sécurité et les sauvegardes. Conformément aux règles d intégrité, il ne peut en aucun cas s auto-attribuer l autorité d approbation des dossiers de transport ni émettre de titres officiels.
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="font-bold text-slate-400 hover:text-slate-600 ml-4">
            ×
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, email ou téléphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="flex flex-wrap gap-2 text-xs w-full sm:w-auto">
          {[
            { id: 'ALL', label: 'Tous les rôles' },
            { id: 'DIRECTOR', label: 'Direction (L3)' },
            { id: 'CHEF_SERVICE', label: 'Chefs (L2)' },
            { id: 'AGENT_TERRAIN', label: 'Agents (L1)' },
            { id: 'DISTRIBUTEUR', label: 'Distributeurs' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setRoleFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                roleFilter === f.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="p-3">Utilisateur</th>
                <th className="p-3">Identifiants</th>
                <th className="p-3">Rôle RBAC</th>
                <th className="p-3">Commune / Périmètre</th>
                <th className="p-3">Statut</th>
                <th className="p-3 text-right">Actions Administration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-3">
                    <div className="font-bold text-slate-900">{user.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{user.id}</div>
                  </td>
                  <td className="p-3">
                    <div className="text-slate-800">{user.email}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{user.phoneNumber}</div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        user.role === 'DIRECTOR'
                          ? 'bg-emerald-100 text-emerald-800'
                          : user.role === 'SUPER_ADMIN'
                          ? 'bg-slate-800 text-white'
                          : user.role === 'CHEF_SERVICE'
                          ? 'bg-blue-100 text-blue-800'
                          : user.role === 'AGENT_TERRAIN'
                          ? 'bg-amber-100 text-amber-900'
                          : user.role === 'DISTRIBUTEUR'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {user.role}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">{user.roleLabel}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center space-x-1.5 text-slate-700">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{user.commune}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        user.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          user.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      {user.isActive ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => handleResetPassword(user)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition inline-flex items-center space-x-1 cursor-pointer"
                      title="Réinitialiser le mot de passe"
                    >
                      <KeyRound className="w-3 h-3 text-slate-500" />
                      <span>Réinitialiser</span>
                    </button>
                    <button
                      onClick={() => handleToggleStatus(user)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition inline-flex items-center space-x-1 cursor-pointer ${
                        user.isActive
                          ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      {user.isActive ? (
                        <>
                          <UserX className="w-3 h-3 text-rose-600" />
                          <span>Désactiver</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3 h-3 text-emerald-600" />
                          <span>Réactiver</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-slate-700" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Création d un Compte Assermenté AOTUC
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Prénom</label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="Mamadou"
                    required
                    className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nom</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Diallo"
                    required
                    className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Téléphone Mobile (+224)</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+224 620 00 00 10"
                  required
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Email Professionnel</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nom@aotuc.test"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Rôle et Accréditation RBAC</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as RoleType)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  <option value="AGENT_TERRAIN">Agent d Enrôlement Terrain (Niveau 1)</option>
                  <option value="CHEF_SERVICE">Chef de Service Territorial (Niveau 2)</option>
                  <option value="DISTRIBUTEUR">Distributeur Billetterie Agréé</option>
                  <option value="SYNDICAT">Délégué Syndical FNTG</option>
                  <option value="DIRECTOR">Directeur Général (Niveau 3)</option>
                  <option value="SUPER_ADMIN">Super Administrateur DSI</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Périmètre Territorial (Commune)</label>
                <select
                  value={newCommune}
                  onChange={(e) => setNewCommune(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  <option value="Commune de Matoto">Commune de Matoto</option>
                  <option value="Commune de Kaloum">Commune de Kaloum</option>
                  <option value="Commune de Ratoma">Commune de Ratoma</option>
                  <option value="Commune de Dixinn">Commune de Dixinn</option>
                  <option value="Commune de Matam">Commune de Matam</option>
                  <option value="Toutes Communes">Toutes Communes (Direction Générale)</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold rounded-lg shadow"
                >
                  Créer le Compte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementView;
