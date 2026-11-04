import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Building2,
  FileCheck2,
  Users,
  Ticket,
  ArrowRight,
} from 'lucide-react';
import { UserContext, RoleType } from '../../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserContext, token?: string) => void;
}

interface DemoAccount {
  name: string;
  role: RoleType;
  roleLabel: string;
  email: string;
  phone: string;
  commune: string;
  communeId: string | null;
  badgeColor: string;
  icon: React.ReactNode;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: 'Mamadou Camara',
    role: 'DIRECTOR',
    roleLabel: 'Directeur Général AOTUC',
    email: 'directeur@aotuc.test',
    phone: '+224 620 00 00 02',
    commune: 'Direction Générale (Conakry)',
    communeId: null,
    badgeColor: 'bg-red-50 text-red-700 border-red-200',
    icon: <ShieldCheck className="w-4 h-4 text-[#CE1126]" />,
  },
  {
    name: 'Ibrahima Diallo',
    role: 'SUPER_ADMIN',
    roleLabel: 'Super Administrateur DSI',
    email: 'superadmin@aotuc.test',
    phone: '+224 620 00 00 01',
    commune: 'Toutes Communes',
    communeId: null,
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: <Lock className="w-4 h-4 text-purple-600" />,
  },
  {
    name: 'Fanta Soumah',
    role: 'CHEF_SERVICE',
    roleLabel: 'Chef de Service Territorial',
    email: 'chef.matoto@aotuc.test',
    phone: '+224 620 00 00 03',
    commune: 'Commune de Matoto',
    communeId: 'cm-matoto',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <Building2 className="w-4 h-4 text-blue-600" />,
  },
  {
    name: 'Sekou Conte',
    role: 'AGENT_TERRAIN',
    roleLabel: 'Agent d Enrôlement Terrain',
    email: 'agent.matoto@aotuc.test',
    phone: '+224 620 00 00 05',
    commune: 'Commune de Matoto',
    communeId: 'cm-matoto',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <FileCheck2 className="w-4 h-4 text-emerald-600" />,
  },
  {
    name: 'Ousmane Sylla',
    role: 'DISTRIBUTEUR',
    roleLabel: 'Distributeur Billetterie Agréé',
    email: 'distributeur.kaloum@aotuc.test',
    phone: '+224 620 00 00 06',
    commune: 'Commune de Kaloum',
    communeId: 'cm-kaloum',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <Ticket className="w-4 h-4 text-amber-600" />,
  },
  {
    name: 'Amadou Diallo',
    role: 'SYNDICAT',
    roleLabel: 'Délégué Syndical FNTG',
    email: 'syndicat.fntg@aotuc.test',
    phone: '+224 620 00 00 07',
    commune: 'Fédération Syndicale',
    communeId: null,
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: <Users className="w-4 h-4 text-slate-600" />,
  },
];

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('directeur@aotuc.test');
  const [password, setPassword] = useState('DevAotuc2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim() || !password.trim()) {
      setErrorMessage('Veuillez renseigner votre identifiant et votre mot de passe.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. First attempt real backend authentication
      const response = await fetch('http://localhost:5000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password: password.trim() }),
      }).catch(() => null);

      if (response && response.ok) {
        const payload = await response.json();
        const apiUser = payload.data?.user;
        const accessToken = payload.data?.accessToken;

        const loggedUser: UserContext = {
          id: apiUser?.id || 'usr-dir',
          name: `${apiUser?.firstName || 'Mamadou'} ${apiUser?.lastName || 'Camara'}`,
          role: (apiUser?.roles?.[0] as RoleType) || 'DIRECTOR',
          roleLabel: 'Directeur Général AOTUC',
          communeName: apiUser?.communeName || 'Direction Générale',
          communeId: apiUser?.communeId || null,
          email: apiUser?.email || identifier,
          phoneNumber: apiUser?.phoneNumber,
        };

        if (rememberMe) {
          localStorage.setItem('aotuc_auth_token', accessToken || 'mock-token');
          localStorage.setItem('aotuc_user', JSON.stringify(loggedUser));
        }

        onLoginSuccess(loggedUser, accessToken);
        return;
      }

      // 2. Fallback to Local Certified Demo Match (offline/standalone dev mode)
      const matchedDemo = DEMO_ACCOUNTS.find(
        (acc) =>
          acc.email.toLowerCase() === identifier.trim().toLowerCase() ||
          acc.phone.replace(/\s+/g, '') === identifier.replace(/\s+/g, '')
      );

      if (matchedDemo && password.trim() === 'DevAotuc2026!') {
        const loggedUser: UserContext = {
          id: `usr-${matchedDemo.role.toLowerCase()}`,
          name: matchedDemo.name,
          role: matchedDemo.role,
          roleLabel: matchedDemo.roleLabel,
          communeName: matchedDemo.commune,
          communeId: matchedDemo.communeId,
          email: matchedDemo.email,
          phoneNumber: matchedDemo.phone,
        };

        if (rememberMe) {
          localStorage.setItem('aotuc_auth_token', 'mock-jwt-token-aotuc-2026');
          localStorage.setItem('aotuc_user', JSON.stringify(loggedUser));
        }

        onLoginSuccess(loggedUser, 'mock-jwt-token-aotuc-2026');
        return;
      }

      // If credentials do not match
      setErrorMessage(
        'Identifiant ou mot de passe incorrect. Pour les tests, utilisez le mot de passe "DevAotuc2026!" ou cliquez sur un compte de démonstration ci-dessous.'
      );
    } catch {
      setErrorMessage('Une erreur est survenue lors de la tentative de connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDemoAccount = (demo: DemoAccount) => {
    setIdentifier(demo.email);
    setPassword('DevAotuc2026!');
    setErrorMessage(null);

    // Instant login for smooth developer experience
    const loggedUser: UserContext = {
      id: `usr-${demo.role.toLowerCase()}`,
      name: demo.name,
      role: demo.role,
      roleLabel: demo.roleLabel,
      communeName: demo.commune,
      communeId: demo.communeId,
      email: demo.email,
      phoneNumber: demo.phone,
    };

    if (rememberMe) {
      localStorage.setItem('aotuc_auth_token', 'mock-jwt-token-aotuc-2026');
      localStorage.setItem('aotuc_user', JSON.stringify(loggedUser));
    }

    onLoginSuccess(loggedUser, 'mock-jwt-token-aotuc-2026');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between selection:bg-[#CE1126] selection:text-white">
      {/* Guinean Tricolor Banner Top Header */}
      <div className="h-2 w-full flex shadow-md">
        <div className="w-1/3 bg-[#CE1126]" />
        <div className="w-1/3 bg-[#FCD116]" />
        <div className="w-1/3 bg-[#009460]" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Official Institutional Hero */}
          <div className="lg:col-span-5 text-white space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center space-x-3 bg-slate-800/80 border border-slate-700/80 px-3.5 py-1.5 rounded-full">
              <img
                src="/logo-guinee.png"
                alt="Sceau Officiel République de Guinée"
                className="w-6 h-6 object-contain rounded-full"
              />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                République de Guinée
              </span>
            </div>

            <div>
              <div className="text-xs uppercase font-extrabold tracking-widest text-[#FCD116]">
                Ministère des Transports
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                AOTUC-TRANSPORT
              </h1>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Plateforme Numérique Intégrée d Organisation, d Immatriculation et de Régulation des Transports Urbains de Conakry.
              </p>
            </div>

            <div className="hidden lg:block space-y-3 pt-2">
              <div className="flex items-start space-x-3 text-xs text-slate-300">
                <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-white">Cryptographie Asymétrique Ed25519</div>
                  <div className="text-[11px] text-slate-400">Badges et licences infalsifiables vérifiables hors ligne.</div>
                </div>
              </div>

              <div className="flex items-start space-x-3 text-xs text-slate-300">
                <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg mt-0.5">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-white">Workflow Tri-Niveaux & Découpage Territorial</div>
                  <div className="text-[11px] text-slate-400">Contrôle hiérarchique étanche par commune et direction.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Login Card */}
          <div className="lg:col-span-7 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Card Header */}
            <div className="p-6 sm:p-8 bg-slate-50/70 border-b border-slate-100 flex items-center space-x-4">
              <img
                src="/logo-guinee.png"
                alt="Logo AOTUC"
                className="w-14 h-14 object-contain rounded-full bg-white p-1 border border-slate-200 shadow-sm flex-shrink-0"
              />
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Connexion Sécurisée
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Veuillez vous authentifier pour accéder à la console de gestion
                </p>
              </div>
            </div>

            {/* Error Alert */}
            {errorMessage && (
              <div className="mx-6 sm:mx-8 mt-6 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-800 text-xs">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="p-6 sm:p-8 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Identifiant Professionnel
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="email@aotuc.test ou +224 6XX XX XX XX"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#CE1126] transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mot de Passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#CE1126] transition font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    title={showPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center space-x-2 text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-[#CE1126] focus:ring-[#CE1126]"
                  />
                  <span>Mémoriser ma session</span>
                </label>
                <span className="text-[11px] text-slate-400">Chiffrement AES-GCM / Argon2</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-[#CE1126] hover:bg-[#b00f20] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-red-500/20 transition disabled:opacity-50"
              >
                {isLoading ? (
                  <span>Authentification en cours...</span>
                ) : (
                  <>
                    <span>Accéder au Système AOTUC</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Accounts Selection */}
            <div className="px-6 sm:px-8 pb-6 pt-3 bg-slate-50/70 border-t border-slate-100">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center justify-between">
                <span>Comptes Démonstrateurs Certifiés (Accès Direct)</span>
                <span className="text-[10px] text-slate-400 font-mono">DevAotuc2026!</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((demo) => (
                  <button
                    key={demo.email}
                    type="button"
                    onClick={() => handleSelectDemoAccount(demo)}
                    className="p-2 text-left bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl transition flex items-center space-x-2.5 group shadow-sm"
                  >
                    <div className="p-1.5 rounded-lg bg-slate-100 group-hover:scale-105 transition">
                      {demo.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {demo.name}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {demo.roleLabel} • {demo.commune.split(' ')[0]}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Legal & Security */}
      <footer className="p-4 text-center text-slate-500 text-[11px] border-t border-slate-800">
        République de Guinée • Ministère des Transports • Agence Organisatrice du Transport Urbain de Conakry (AOTUC) © 2026
      </footer>
    </div>
  );
};

export default LoginView;
