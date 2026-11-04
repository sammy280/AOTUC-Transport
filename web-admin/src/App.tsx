import React, { useState } from 'react';
import {
  UserContext,
  RoleType,
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
import ToastContainer from './components/ToastContainer';
import LoginView from './features/auth/LoginView';

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
  // Strict Security Gate: The user MUST authenticate to access the system
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('aotuc_session_active') === 'true';
  });

  const [currentUser, setCurrentUser] = useState<UserContext>(() => {
    const saved = sessionStorage.getItem('aotuc_user');
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

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
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

  const handleLoginSuccess = (user: UserContext) => {
    sessionStorage.setItem('aotuc_session_active', 'true');
    sessionStorage.setItem('aotuc_user', JSON.stringify(user));
    setCurrentUser(user);
    setIsAuthenticated(true);
    showToast('success', 'Authentification Réussie', `Bienvenue ${user.name} (${user.roleLabel}).`);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('aotuc_session_active');
    sessionStorage.removeItem('aotuc_user');
    localStorage.removeItem('aotuc_auth_token');
    localStorage.removeItem('aotuc_user');
    setIsAuthenticated(false);
    showToast('info', 'Session Clôturée', 'Vous avez été déconnecté avec succès du système AOTUC.');
  };

  const handleSwitchRole = (role: RoleType) => {
    switch (role) {
      case 'SUPER_ADMIN':
        setCurrentUser({
          id: 'adm-001',
          name: 'Ibrahima Diallo',
          role: 'SUPER_ADMIN',
          roleLabel: 'Super Administrateur DSI',
          communeName: 'Toutes Communes',
          communeId: null,
          email: 'superadmin@aotuc.test',
          phoneNumber: '+224 620 00 00 01',
        });
        showToast('info', 'Changement de Rôle', 'Session basculée sur Super Administrateur (DSI).');
        break;
      case 'DIRECTOR':
        setCurrentUser({
          id: 'dir-001',
          name: 'Mamadou Camara',
          role: 'DIRECTOR',
          roleLabel: 'Directeur Général AOTUC',
          communeName: 'Direction Générale',
          communeId: null,
          email: 'directeur@aotuc.test',
          phoneNumber: '+224 620 00 00 02',
        });
        showToast('info', 'Changement de Rôle', 'Session basculée sur Directeur Général AOTUC (Niveau 3).');
        break;
      case 'CHEF_SERVICE':
        setCurrentUser({
          id: 'chf-001',
          name: 'Fanta Soumah',
          role: 'CHEF_SERVICE',
          roleLabel: 'Chef de Service Territorial',
          communeName: 'Matoto',
          communeId: 'cm-matoto',
          email: 'chef.matoto@aotuc.test',
          phoneNumber: '+224 620 00 00 03',
        });
        showToast('info', 'Changement de Rôle', 'Session basculée sur Chef de Service Matoto (Niveau 2).');
        break;
      case 'AGENT_TERRAIN':
        setCurrentUser({
          id: 'agt-001',
          name: 'Sekou Conte',
          role: 'AGENT_TERRAIN',
          roleLabel: 'Agent d Enrôlement Terrain',
          communeName: 'Matoto',
          communeId: 'cm-matoto',
          email: 'agent.matoto@aotuc.test',
          phoneNumber: '+224 620 00 00 05',
        });
        showToast('info', 'Changement de Rôle', 'Session basculée sur Agent d Enrôlement Terrain.');
        break;
      case 'SYNDICAT':
        setCurrentUser({
          id: 'syn-001',
          name: 'Amadou Diallo',
          role: 'SYNDICAT',
          roleLabel: 'Délégué Syndical FNTG',
          communeName: 'Fédération Syndicale',
          communeId: null,
          email: 'syndicat.fntg@aotuc.test',
          phoneNumber: '+224 620 00 00 07',
        });
        showToast('info', 'Changement de Rôle', 'Session basculée sur Délégué Syndical (Lecture).');
        break;
      case 'DISTRIBUTEUR':
        setCurrentUser({
          id: 'dst-001',
          name: 'Ousmane Sylla',
          role: 'DISTRIBUTEUR',
          roleLabel: 'Distributeur Agréé Billetterie',
          communeName: 'Kaloum',
          communeId: 'cm-kaloum',
          email: 'distributeur.kaloum@aotuc.test',
          phoneNumber: '+224 620 00 00 06',
        });
        showToast('info', 'Changement de Rôle', 'Session basculée sur Distributeur Billetterie.');
        break;
    }
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
      setCurrentTab(item.linkTab);
      showToast('info', 'Navigation AOTUC', `Ouverture du module "${item.title}".`);
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

  // If user is not authenticated, render Login Page
  if (!isAuthenticated) {
    return (
      <>
        <LoginView onLoginSuccess={handleLoginSuccess} />
        <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        currentUser={currentUser}
        onSwitchRole={handleSwitchRole}
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onClearAll={handleClearAll}
        onSelectNotification={handleSelectNotification}
        onTriggerTestNotification={handleTriggerTestNotification}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          pendingCount={notifications.filter((n) => !n.isRead && n.category === 'VALIDATION').length || 46}
        />

        <main className="flex-1 p-6 overflow-y-auto">
          {currentTab === 'dashboard' && (
            <DashboardOverview onOpenValidationQueue={() => setCurrentTab('validation')} />
          )}

          {currentTab === 'validation' && (
            <ValidationQueue currentUser={currentUser} />
          )}

          {currentTab === 'enrolment' && (
            <RegistrationDesk currentUser={currentUser} />
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
        </main>
      </div>

      {/* Global Toast Alerts */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
};

export default App;
