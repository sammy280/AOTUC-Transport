import React, { useState } from 'react';
import {
  UserContext,
  NotificationItem,
  ToastMessage,
  NotificationCategory,
  NotificationPriority,
} from './types';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import DashboardOverview from './features/dashboard/DashboardOverview';
import ValidationQueue from './features/validation/ValidationQueue';
import NetworkMapView from './features/mapping/NetworkMapView';
import BadgeLicenceCenter from './features/badges/BadgeLicenceCenter';
import TicketingLedgerView from './features/ticketing/TicketingLedgerView';
import RegistrationDesk from './features/enrolment/RegistrationDesk';
import AuditSecurityLogView from './features/audit/AuditSecurityLogView';
import UserManagementView from './features/users/UserManagementView';
import FieldOperationsView from './features/field/FieldOperationsView';
import UnionManagementView from './features/unions/UnionManagementView';
import AuthorityManagementView from './features/authorities/AuthorityManagementView';
import ITManagementView from './features/it/ITManagementView';
import ToastContainer from './components/ToastContainer';
import LoginView from './features/auth/LoginView';
import AccessDenied from './components/AccessDenied';
import PublicVerificationView from './features/verification/PublicVerificationView';
import { isTabAllowed, getDefaultTab } from './utils/permissions';
import { buildApiUrl, getStoredAuthToken, storeAuthToken } from './utils/api';
import { useTheme } from './context/ThemeContext';
import { isCurrentSessionOffline, clearActiveOfflineSession } from './utils/offlineAuthService';

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    category: 'VALIDATION',
    priority: 'WARNING',
    title: 'Dossier en attente d approbation Niveau 3',
    message: 'Le dossier DOS-2026-00441 (Thierno Mamadou Bah) a été validé au Niveau 2 par le Chef de Service et attend votre décret final.',
    timestamp: 'Il y a 4 min',
    isRead: false,
    linkTab: 'validation',
  },
  {
    id: 'notif-2',
    category: 'SECURITY',
    priority: 'CRITICAL',
    title: 'Alerte Anti-Fraude : Auto-approbation bloquée',
    message: 'Un agent communal a tenté de valider son propre dossier d enrôlement à Matoto. Blocage strict 403 enregistré dans le journal d intégrité.',
    timestamp: 'Il y a 18 min',
    isRead: false,
    linkTab: 'audit',
  },
  {
    id: 'notif-3',
    category: 'SMS',
    priority: 'INFO',
    title: 'SMS Orange Guinée délivré au conducteur',
    message: 'Notification de mise à disposition du badge transmise avec succès au +224 622 11 22 33 (Réf: SMS-8419201).',
    timestamp: 'Il y a 35 min',
    isRead: false,
  },
  {
    id: 'notif-4',
    category: 'TICKETING',
    priority: 'SUCCESS',
    title: 'Encaissement Mobile Money reçu (20 000 GNF)',
    message: 'Vente de 10 tickets urbains via Orange Money (Réf OM-GN-98412) au guichet Kaloum. Écriture en partie double générée.',
    timestamp: 'Il y a 1h',
    isRead: true,
    linkTab: 'ticketing',
  },
];

export const App: React.FC = () => {
  const { setUser } = useTheme();

  // Strict Security Gate: The user MUST authenticate with a real JWT token to access the system
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const hasToken = getStoredAuthToken() !== null;
    const hasSession =
      sessionStorage.getItem('aotuc_session_active') === 'true' ||
      Boolean(localStorage.getItem('aotuc_user'));
    return hasSession && hasToken;
  });

  const [isOfflineSession, setIsOfflineSession] = useState<boolean>(() => {
    return isCurrentSessionOffline();
  });

  // Public QR Code Verification Portal check (no login required for roadside checks)
  const [showPublicVerification, setShowPublicVerification] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return window.location.pathname.startsWith('/verify') || params.has('verify') || params.has('code');
  });

  const [verifyInitialCode] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('verify') || params.get('code') || '';
  });

  const [currentUser, setCurrentUser] = useState<UserContext>(() => {
    const saved = sessionStorage.getItem('aotuc_user') || localStorage.getItem('aotuc_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      id: 'usr-001',
      name: 'Mamadou Camara',
      role: 'DIRECTOR',
      roleLabel: 'Directeur Général AOTUC',
      communeName: 'Direction Générale (Conakry)',
      communeId: null,
      email: 'directeur@aotuc.test',
      phoneNumber: '+224 620 00 00 02',
    };
  });

  // Keep ThemeContext synchronized with the authenticated user and refresh profile (including avatarUrl) from PostgreSQL
  React.useEffect(() => {
    if (isAuthenticated && currentUser?.id) {
      setUser(currentUser.id);
      const token = getStoredAuthToken();
      if (token) {
        fetch(buildApiUrl('/api/v1/auth/me'), {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((body) => {
            const apiUser = body?.data?.user || body?.data;
            if (apiUser && apiUser.id) {
              setCurrentUser((prev) => {
                const updated: UserContext = {
                  ...prev,
                  id: apiUser.id,
                  name: `${apiUser.firstName || ''} ${apiUser.lastName || ''}`.trim() || prev.name,
                  email: apiUser.email || prev.email,
                  phoneNumber: apiUser.phoneNumber || prev.phoneNumber,
                  jobTitle: apiUser.jobTitle || prev.jobTitle,
                  avatarUrl: apiUser.avatarUrl ?? prev.avatarUrl ?? null,
                };
                sessionStorage.setItem('aotuc_user', JSON.stringify(updated));
                if (localStorage.getItem('aotuc_user')) {
                  localStorage.setItem('aotuc_user', JSON.stringify(updated));
                }
                return updated;
              });
            }
          })
          .catch(() => {});
      }
    } else {
      setUser(null);
    }
  }, [isAuthenticated, currentUser?.id, setUser]);

  const handleUpdateCurrentUser = (patch: Partial<UserContext>) => {
    setCurrentUser((prev) => {
      const updated = { ...prev, ...patch };
      sessionStorage.setItem('aotuc_user', JSON.stringify(updated));
      if (localStorage.getItem('aotuc_user')) {
        localStorage.setItem('aotuc_user', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const [currentTab, setCurrentTab] = useState<string>(() => {
    return getDefaultTab(currentUser.role);
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (type: ToastMessage['type'], title: string, message: string) => {
    const newToast: ToastMessage = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      title,
      message,
    };
    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after 4.5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 4500);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLoginSuccess = (user: UserContext, token?: string, isOffline?: boolean) => {
    const offlineMode = isOffline !== undefined ? isOffline : isCurrentSessionOffline();
    setIsOfflineSession(offlineMode);
    sessionStorage.setItem('aotuc_session_active', 'true');
    sessionStorage.setItem('aotuc_user', JSON.stringify(user));
    if (offlineMode) {
      sessionStorage.setItem('aotuc_is_offline_session', 'true');
    } else {
      sessionStorage.removeItem('aotuc_is_offline_session');
    }
    if (token) {
      storeAuthToken(token);
    }
    setCurrentUser(user);
    setUser(user.id);
    setIsAuthenticated(true);
    setCurrentTab(getDefaultTab(user.role, offlineMode));
    if (offlineMode) {
      showToast(
        'warning',
        'Session Hors Ligne Active',
        `Authentification locale validée pour ${user.name}. Accès restreint à l'enrôlement et aux opérations de terrain.`
      );
    } else {
      showToast('success', 'Authentification Réussie', `Bienvenue ${user.name} (${user.roleLabel}).`);
    }
  };

  const handleLogout = () => {
    clearActiveOfflineSession();
    sessionStorage.removeItem('aotuc_session_active');
    sessionStorage.removeItem('aotuc_user');
    sessionStorage.removeItem('aotuc_auth_token');
    sessionStorage.removeItem('aotuc_is_offline_session');
    localStorage.removeItem('aotuc_auth_token');
    localStorage.removeItem('aotuc_user');
    setIsOfflineSession(false);
    setUser(null);
    setIsAuthenticated(false);
    showToast('info', 'Session Clôturée', 'Vous avez été déconnecté avec succès du système AOTUC.');
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    showToast('success', 'Notifications', 'Toutes les alertes ont été marquées comme lues.');
  };

  const handleClearAll = () => {
    setNotifications([]);
    showToast('info', 'Notifications', 'Historique des notifications effacé.');
  };

  const handleSelectNotification = (item: NotificationItem) => {
    if (item.linkTab) {
      if (isTabAllowed(currentUser.role, item.linkTab)) {
        setCurrentTab(item.linkTab);
        showToast('info', 'Navigation AOTUC', `Ouverture du module "${item.title}".`);
      } else {
        showToast(
          'warning',
          'Accès Restreint',
          `Votre rôle (${currentUser.roleLabel}) ne vous autorise pas à ouvrir le module "${item.linkTab}".`
        );
      }
    }
  };

  const handleTriggerTestNotification = () => {
    const samples: Array<{
      category: NotificationCategory;
      priority: NotificationPriority;
      title: string;
      message: string;
      linkTab?: 'validation' | 'ticketing' | 'audit' | 'badges';
    }> = [
      {
        category: 'VALIDATION',
        priority: 'SUCCESS',
        title: 'Nouveau dossier enrôlé à Kaloum',
        message: 'L agent Sekou Conte vient de soumettre le dossier conducteur DOS-2026-00445 pour visa.',
        linkTab: 'validation',
      },
      {
        category: 'TICKETING',
        priority: 'INFO',
        title: 'Allocation de carnet de tickets',
        message: 'Le lot de carnets LOT-2026-0002 (1 000 tickets) a été alloué au point de vente Madina.',
        linkTab: 'ticketing',
      },
      {
        category: 'SECURITY',
        priority: 'CRITICAL',
        title: 'Contrôle routier : Permis suspendu détecté',
        message: 'L application mobile d inspection routière a identifié le badge CH-2026-00019 déclaré suspendu.',
        linkTab: 'audit',
      },
      {
        category: 'SMS',
        priority: 'SUCCESS',
        title: 'Passerelle SMS MTN Guinée active',
        message: 'Accusé de réception 100% délivré pour les alertes de convocation aux guichets AOTUC.',
      },
    ];

    const randomItem = samples[Math.floor(Math.random() * samples.length)];
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      category: randomItem.category,
      priority: randomItem.priority,
      title: randomItem.title,
      message: randomItem.message,
      timestamp: 'À l instant',
      isRead: false,
      linkTab: randomItem.linkTab,
    };

    setNotifications((prev) => [newNotif, ...prev]);
    showToast(
      randomItem.priority === 'CRITICAL' || randomItem.priority === 'WARNING'
        ? 'warning'
        : 'success',
      randomItem.title,
      randomItem.message
    );
  };

  // If public verification was requested (via URL or button), show public verification screen
  if (showPublicVerification) {
    return (
      <PublicVerificationView
        initialCode={verifyInitialCode}
        onGoToLogin={() => setShowPublicVerification(false)}
      />
    );
  }

  // If user is not authenticated, render Login Page
  if (!isAuthenticated) {
    return (
      <>
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          onOpenPublicVerification={() => setShowPublicVerification(true)}
        />
        <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      </>
    );
  }

  // Check if current tab is permitted for the authenticated user's role and offline status
  const isCurrentTabPermitted = isTabAllowed(currentUser.role, currentTab, isOfflineSession);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Navbar
        currentUser={currentUser}
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onClearAll={handleClearAll}
        onSelectNotification={handleSelectNotification}
        onTriggerTestNotification={handleTriggerTestNotification}
        onLogout={handleLogout}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        isOfflineSession={isOfflineSession}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto min-w-0 overflow-x-hidden">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            if (!isTabAllowed(currentUser.role, tab, isOfflineSession)) {
              showToast('error', 'Module Indisponible Hors Ligne', 'Ce module requiert une connexion active au serveur AOTUC.');
              return;
            }
            setCurrentTab(tab);
            setIsMobileMenuOpen(false);
          }}
          pendingCount={notifications.filter((n) => !n.isRead && n.category === 'VALIDATION').length || 46}
          currentUser={currentUser}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
          isOfflineSession={isOfflineSession}
        />

        <main className="flex-1 p-3 sm:p-5 md:p-6 overflow-y-auto overflow-x-hidden min-w-0">
          {!isCurrentTabPermitted ? (
            <AccessDenied
              currentUser={currentUser}
              attemptedTab={currentTab}
              onNavigateHome={() => setCurrentTab(getDefaultTab(currentUser.role, isOfflineSession))}
            />
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <DashboardOverview
                  currentUser={currentUser}
                  onOpenValidationQueue={() => setCurrentTab('validation')}
                  onNavigateTab={setCurrentTab}
                />
              )}

              {currentTab === 'it-console' && (
                <ITManagementView currentUser={currentUser} />
              )}

              {currentTab === 'field' && (
                <FieldOperationsView currentUser={currentUser} />
              )}

              {currentTab === 'users' && (
                <UserManagementView
                  currentUser={currentUser}
                  onUpdateCurrentUser={handleUpdateCurrentUser}
                />
              )}

              {currentTab === 'validation' && (
                <ValidationQueue currentUser={currentUser} />
              )}

              {currentTab === 'enrolment' && (
                <RegistrationDesk currentUser={currentUser} />
              )}

              {currentTab === 'unions' && (
                <UnionManagementView currentUser={currentUser} />
              )}

              {currentTab === 'authorities' && (
                <AuthorityManagementView currentUser={currentUser} />
              )}

              {currentTab === 'mapping' && (
                <NetworkMapView />
              )}

              {(currentTab === 'badges' || currentTab === 'licences') && (
                <BadgeLicenceCenter currentUser={currentUser} />
              )}

              {currentTab === 'ticketing' && (
                <TicketingLedgerView currentUser={currentUser} />
              )}

              {currentTab === 'audit' && (
                <AuditSecurityLogView currentUser={currentUser} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Global Toast Alerts */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
};

export default App;
