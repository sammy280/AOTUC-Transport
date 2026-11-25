import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Building2,
  ArrowRight,
  QrCode,
  WifiOff,
  User,
} from 'lucide-react';
import { UserContext, RoleType } from '../../types';
import ThemeSelector from '../../components/ThemeSelector';
import DualBranding from '../../components/DualBranding';
import { buildApiUrl, storeAuthToken } from '../../utils/api';
import {
  enrollUserForOfflineAuth,
  authenticateOfflineWithPassword,
  getEnrolledOfflineUsers,
  EnrolledUserSummary,
} from '../../utils/offlineAuthService';

interface LoginViewProps {
  onLoginSuccess: (user: UserContext, token?: string, isOffline?: boolean) => void;
  onOpenPublicVerification?: () => void;
}

const getRoleLabel = (role: RoleType): string => {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Administrateur DSI';
    case 'IT':
      return 'IT — Contrôle Informatique';
    case 'DIRECTOR':
      return 'Directeur Général AOTUC';
    case 'CHEF_SERVICE':
      return 'Chef de Service Territorial';
    case 'AGENT_TERRAIN':
      return 'Agent d Enrôlement Terrain';
    case 'DISTRIBUTEUR':
      return 'Distributeur Billetterie Agréé';
    case 'SYNDICAT':
      return 'Délégué Syndical FNTG';
    case 'AUTHORITY':
      return 'Haute Autorité Ministérielle';
    default:
      return 'Accréditation Validée AOTUC';
  }
};

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onOpenPublicVerification,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [enrolledUsers, setEnrolledUsers] = useState<EnrolledUserSummary[]>([]);
  // Connectivity and Enrolled Accounts Discovery
  useEffect(() => {
    const handleOnline = () => {
      setIsNetworkOnline(true);
    };
    const handleOffline = () => {
      setIsNetworkOnline(false);
      getEnrolledOfflineUsers().then((users) => {
        setEnrolledUsers(users);
        if (users.length > 0) {
          setIdentifier((prev) => prev || users[0].identifier);
        }
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Pre-load locally enrolled accounts (ready for offline transitions)
    getEnrolledOfflineUsers().then((users) => {
      setEnrolledUsers(users);
      // Only auto-fill if device is genuinely offline upon arrival
      if (typeof navigator !== 'undefined' && !navigator.onLine && users.length > 0) {
        setIdentifier((prev) => prev || users[0].identifier);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanIdentifier = identifier.trim();
    const cleanPassword = password.trim();

    if (!cleanIdentifier || !cleanPassword) {
      setErrorMessage(
        'Veuillez saisir votre identifiant professionnel et votre mot de passe.'
      );
      return;
    }

    setIsLoading(true);

    try {
      // 1. If currently offline, directly trigger offline authentication
      if (!isNetworkOnline) {
        const offlineResult = await authenticateOfflineWithPassword(cleanIdentifier, cleanPassword);
        if (offlineResult.success && offlineResult.user) {
          onLoginSuccess(offlineResult.user, undefined, true);
          return;
        }
        setErrorMessage(offlineResult.error || 'Identifiant ou mot de passe hors ligne invalide.');
        return;
      }

      // 2. Online Authentication Attempt
      const response = await fetch(buildApiUrl('/api/v1/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: cleanIdentifier,
          password: cleanPassword,
        }),
      }).catch(() => null);

      if (response) {
        const payload = await response.json().catch(() => ({}));

        if (response.ok && payload.success && payload.data?.accessToken) {
          const apiUser = payload.data.user;
          const accessToken = payload.data.accessToken as string;
          const primaryRole =
            (apiUser?.roles?.[0] as RoleType) || 'AGENT_TERRAIN';

          const loggedUser: UserContext = {
            id: apiUser?.id || 'usr-auth',
            name: `${apiUser?.firstName || 'Utilisateur'} ${
              apiUser?.lastName || 'AOTUC'
            }`.trim(),
            role: primaryRole,
            roleLabel: apiUser?.jobTitle || getRoleLabel(primaryRole),
            communeName:
              apiUser?.commune?.name ||
              apiUser?.communeName ||
              (primaryRole === 'SUPER_ADMIN' || primaryRole === 'IT'
                ? 'Toutes Communes (Global)'
                : 'Direction Générale'),
            communeId: apiUser?.communeId || apiUser?.commune?.id || null,
            email: apiUser?.email || cleanIdentifier,
            phoneNumber: apiUser?.phoneNumber,
            jobTitle: apiUser?.jobTitle || getRoleLabel(primaryRole),
            avatarUrl: apiUser?.avatarUrl || null,
          };

          storeAuthToken(accessToken, rememberMe);
          sessionStorage.setItem('aotuc_user', JSON.stringify(loggedUser));
          if (rememberMe) {
            localStorage.setItem('aotuc_user', JSON.stringify(loggedUser));
          }

          // Phase 3: Seamlessly enroll this device for offline authentication
          try {
            await enrollUserForOfflineAuth(loggedUser, cleanPassword);
          } catch (enrollErr) {
            console.warn('[AOTUC] Offline enrollment warning:', enrollErr);
          }

          onLoginSuccess(loggedUser, accessToken, false);
          return;
        }

        setErrorMessage(
          payload.message || 'Identifiant ou mot de passe invalide. Accès refusé.'
        );
        return;
      }

      // 3. Fallback: Network unreachable during request -> Attempt offline login
      const fallbackOffline = await authenticateOfflineWithPassword(cleanIdentifier, cleanPassword);
      if (fallbackOffline.success && fallbackOffline.user) {
        onLoginSuccess(fallbackOffline.user, undefined, true);
        return;
      } else if (fallbackOffline.error) {
        setErrorMessage(fallbackOffline.error);
        return;
      }

      setErrorMessage(
        'Impossible de joindre le serveur d authentification AOTUC et aucun compte enrôlé ne correspond à ces identifiants.'
      );
    } catch {
      setErrorMessage(
        'Une erreur est survenue lors de la tentative de connexion.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 dark:bg-slate-950 flex flex-col justify-between selection:bg-[#CE1126] selection:text-white transition-colors duration-200">
      {/* Guinean Tricolor Banner Top Header */}
      <div className="h-2 w-full flex shadow-md">
        <div className="w-1/3 bg-[#CE1126]" />
        <div className="w-1/3 bg-[#FCD116]" />
        <div className="w-1/3 bg-[#009460]" />
      </div>

      <div className="flex justify-end px-6 pt-3">
        <ThemeSelector variant="dropdown" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Official Institutional Hero */}
          <div className="lg:col-span-5 text-white space-y-6 text-center lg:text-left">
            <DualBranding variant="hero" />

            <div className="hidden lg:block space-y-3 pt-2">
              <div className="flex items-start space-x-3 text-xs text-slate-300">
                <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-white">
                    Authentification Sécurisée Obligatoire
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Accès strictement réservé aux agents assermentés et habilités.
                  </div>
                </div>
              </div>

              <div className="flex items-start space-x-3 text-xs text-slate-300">
                <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg mt-0.5">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-white">
                    Traçabilité &amp; Découpage Territorial
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Contrôle hiérarchique étanche par commune et direction.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Secure Login Card */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
            {/* Card Header: Official Dual Branding */}
            <DualBranding variant="card" />

            {/* Offline Detection Banner */}
            {!isNetworkOnline && (
              <div className="mx-6 sm:mx-8 mt-6 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl flex items-start space-x-3 text-amber-900 dark:text-amber-200 text-xs shadow-sm">
                <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Mode Hors Ligne Détecté</span>
                  <span className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    Connexion réseau indisponible. L authentification s effectue localement via vos accréditations chiffrées sur ce terminal (PBKDF2-SHA512 600k itérations / WebAuthn).
                  </span>
                </div>
              </div>
            )}

            {/* Enrolled Offline Accounts Quick Select (Strictly shown only when device is offline) */}
            {!isNetworkOnline && enrolledUsers.length > 0 && (
              <div className="mx-6 sm:mx-8 mt-4 p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Profils Enrôlés Hors Ligne</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {enrolledUsers.length} compte(s)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {enrolledUsers.map((u) => {
                    const isSelected = identifier.toLowerCase() === u.identifier.toLowerCase();
                    return (
                      <button
                        key={u.userId}
                        type="button"
                        onClick={() => setIdentifier(u.identifier)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#CE1126] text-white shadow-sm'
                            : 'bg-white dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:border-[#CE1126]'
                        }`}
                      >
                        <User className="w-3 h-3" />
                        <span>{u.displayName}</span>
                        <span
                          className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {u.role}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error Alert */}
            {errorMessage && (
              <div className="mx-6 sm:mx-8 mt-6 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start space-x-3 text-red-800 dark:text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="p-6 sm:p-8 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
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
                    placeholder="Adresse email ou numéro de téléphone mobile"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#CE1126] transition"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
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
                    className="w-full pl-9 pr-10 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#CE1126] transition font-mono"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    title={showPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-[#CE1126] focus:ring-[#CE1126]"
                  />
                  <span>Mémoriser ma session</span>
                </label>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Chiffrement Argon2id / TLS 1.3
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-[#CE1126] hover:bg-[#b00f20] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-red-500/20 transition disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <span>Vérification des accréditations...</span>
                ) : (
                  <>
                    <span>Accéder au Système AOTUC</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {onOpenPublicVerification && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={onOpenPublicVerification}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  >
                    <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Contrôle Public de Validité (Scanner QR)</span>
                  </button>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                    Accès libre pour forces de l ordre, contrôleurs routiers et usagers
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Footer Legal & Security */}
      <footer className="p-4 text-center text-slate-500 text-[11px] border-t border-slate-800 space-y-0.5">
        <div>
          République de Guinée • Ministère des Transports • Autorité Organisatrice des Transports Urbains de Conakry (AOTUC) © 2026
        </div>
        <div className="italic text-slate-400">
          « Pour une Mobilité Urbaine Participative &amp; Durable »
        </div>
      </footer>
    </div>
  );
};

export default LoginView;
