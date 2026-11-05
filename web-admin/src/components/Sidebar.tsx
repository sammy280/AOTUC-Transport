import React from 'react';
import {
  LayoutDashboard,
  UserPlus,
  ClipboardCheck,
  IdCard,
  FileCheck2,
  MapPin,
  Ticket,
  ShieldAlert,
  UserCog,
} from 'lucide-react';
import { UserContext } from '../types';
import { isTabAllowed } from '../utils/permissions';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  pendingCount: number;
  currentUser: UserContext;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingCount,
  currentUser,
}) => {
  const allMenuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    {
      id: 'validation',
      label: 'Validation Multi-Niveaux',
      icon: ClipboardCheck,
      badge: pendingCount > 0 ? pendingCount : null,
    },
    { id: 'enrolment', label: 'Registre & Enrôlement', icon: UserPlus },
    { id: 'badges', label: 'Badges Chauffeurs (CR80)', icon: IdCard },
    { id: 'licences', label: 'Licences & Stickers', icon: FileCheck2 },
    { id: 'mapping', label: 'Réseau & Carte Conakry', icon: MapPin },
    { id: 'ticketing', label: 'Billetterie & Finances', icon: Ticket },
    { id: 'users', label: 'Gestion Utilisateurs (DSI)', icon: UserCog },
    { id: 'audit', label: 'Journal d Audit & Sécurité', icon: ShieldAlert },
  ];

  // Least-Privilege Filtering: Only display navigation tabs authorized for user's role
  const visibleMenuItems = allMenuItems.filter((item) =>
    isTabAllowed(currentUser.role, item.id)
  );

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 min-h-[calc(100vh-4.5rem)] p-4 flex flex-col justify-between transition-colors duration-200">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Modules Opérationnels Habilités
        </div>
        {visibleMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white dark:border dark:border-slate-700 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#FCD116]' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && (
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    isActive
                      ? 'bg-[#CE1126] text-white'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info Box */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5">
        <div className="flex items-center space-x-2">
          <img
            src="/logo-guinee.png"
            alt="Sceau Officiel République de Guinée"
            className="w-6 h-6 rounded-full object-contain"
          />
          <div className="font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>Contrôle RBAC Actif</span>
          </div>
        </div>
        <div className="text-slate-600 dark:text-slate-300">{currentUser.roleLabel}</div>
        <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-700 leading-tight">
          <div className="font-semibold text-slate-500 dark:text-slate-400">Système officiel AOTUC v2.0</div>
          <div className="italic text-[9.5px] text-slate-400 dark:text-slate-500 mt-0.5">« Pour une Mobilité Urbaine Participative & Durable »</div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
