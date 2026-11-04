import React, { useState } from 'react';
import { UserContext, RoleType } from './types';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import DashboardOverview from './features/dashboard/DashboardOverview';
import ValidationQueue from './features/validation/ValidationQueue';
import NetworkMapView from './features/mapping/NetworkMapView';
import BadgeLicenceCenter from './features/badges/BadgeLicenceCenter';
import TicketingLedgerView from './features/ticketing/TicketingLedgerView';

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

          {currentTab === 'mapping' && (
            <NetworkMapView />
          )}

          {(currentTab === 'badges' || currentTab === 'licences') && (
            <BadgeLicenceCenter currentUser={currentUser} />
          )}

          {currentTab === 'ticketing' && (
            <TicketingLedgerView currentUser={currentUser} />
          )}

          {currentTab !== 'dashboard' &&
            currentTab !== 'validation' &&
            currentTab !== 'mapping' &&
            currentTab !== 'badges' &&
            currentTab !== 'licences' &&
            currentTab !== 'ticketing' && (
              <div className="p-8 bg-white border border-slate-200 rounded-xl text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 font-bold">
                  AOTUC
                </div>
                <h2 className="text-base font-bold text-slate-800">
                  Module en Cours d Implémentation : {currentTab.toUpperCase()}
                </h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Ce module sera branché au fur et à mesure des jalons backend validés (Billetterie & Finances au Jalon 7, Messagerie & Alertes au Jalon 8).
                </p>
                <button
                  onClick={() => setCurrentTab('dashboard')}
                  className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition"
                >
                  Retour au Tableau de Bord
                </button>
              </div>
            )}
        </main>
      </div>
    </div>
  );
};

export default App;
