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
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  pendingCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, pendingCount }) => {
  const menuItems = [
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
    { id: 'audit', label: 'Journal d Audit & Sécurité', icon: ShieldAlert },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4.5rem)] p-4 flex flex-col justify-between">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Modules Opérationnels
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#FCD116]' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && (
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    isActive
                      ? 'bg-[#CE1126] text-white'
                      : 'bg-amber-100 text-amber-900 border border-amber-200'
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
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 space-y-1.5">
        <div className="flex items-center space-x-2">
          <img
            src="/logo-guinee.png"
            alt="Sceau Officiel République de Guinée"
            className="w-6 h-6 rounded-full object-contain"
          />
          <div className="font-semibold text-slate-700 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>API Backend Connectée</span>
          </div>
        </div>
        <div>PostGIS 18 • Node v22 LTS</div>
        <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200">
          Système officiel AOTUC v2.0
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
