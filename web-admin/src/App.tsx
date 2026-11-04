import React, { useState } from 'react';
import { UserContext, RoleType } from './types';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import DashboardOverview from './features/dashboard/DashboardOverview';
import ValidationQueue from './features/validation/ValidationQueue';
import NetworkMapView from './features/mapping/NetworkMapView';
import BadgeLicenceCenter from './features/badges/BadgeLicenceCenter';
import TicketingLedgerView from './features/ticketing/TicketingLedgerView';
import RegistrationDesk from './features/enrolment/RegistrationDesk';
import AuditSecurityLogView from './features/audit/AuditSecurityLogView';

export const App: React.FC = () => {
  // Configurable user context simulating the 6 RBAC roles
  const [currentUser, setCurrentUser] = useState<UserContext>({
    id: 'usr-001',
    name: 'Mamadou Camara',
    role: 'DIRECTOR',
    roleLabel: 'Directeur Général AOTUC',
    communeName: 'Direction Générale (Conakry)',
    communeId: null,
  });

  const [currentTab, setCurrentTab] = useState<string>('dashboard');

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
        });
        break;
      case 'DIRECTOR':
        setCurrentUser({
          id: 'dir-001',
          name: 'Mamadou Camara',
          role: 'DIRECTOR',
          roleLabel: 'Directeur Général AOTUC',
          communeName: 'Direction Générale',
          communeId: null,
        });
        break;
      case 'CHEF_SERVICE':
        setCurrentUser({
          id: 'chf-001',
          name: 'Fanta Soumah',
          role: 'CHEF_SERVICE',
          roleLabel: 'Chef de Service Territorial',
          communeName: 'Matoto',
          communeId: 'cm-matoto',
        });
        break;
      case 'AGENT_TERRAIN':
        setCurrentUser({
          id: 'agt-001',
          name: 'Sekou Conte',
          role: 'AGENT_TERRAIN',
          roleLabel: 'Agent d Enrôlement Terrain',
          communeName: 'Matoto',
          communeId: 'cm-matoto',
        });
        break;
      case 'SYNDICAT':
        setCurrentUser({
          id: 'syn-001',
          name: 'Amadou Diallo',
          role: 'SYNDICAT',
          roleLabel: 'Délégué Syndical FNTG',
          communeName: 'Fédération Syndicale',
          communeId: null,
        });
        break;
      case 'DISTRIBUTEUR':
        setCurrentUser({
          id: 'dst-001',
          name: 'Ousmane Sylla',
          role: 'DISTRIBUTEUR',
          roleLabel: 'Distributeur Agréé Billetterie',
          communeName: 'Kaloum',
          communeId: 'cm-kaloum',
        });
        break;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar currentUser={currentUser} onSwitchRole={handleSwitchRole} />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          pendingCount={46}
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
    </div>
  );
};

export default App;
