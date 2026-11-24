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
  Compass,
  Building2,
  ShieldCheck,
  X,
  LogOut,
} from 'lucide-react';
import { UserContext } from '../types';
import { isTabAllowed } from '../utils/permissions';
import DualBranding from './DualBranding';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  pendingCount: number;
  currentUser: UserContext;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onLogout?: () => void;
  isOfflineSession?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingCount,
  currentUser,
  isOpenMobile = false,
  onCloseMobile,
  onLogout,
  isOfflineSession = false,
}) => {
  const allMenuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'field', label: 'Opérations de Terrain', icon: Compass },
    {
      id: 'validation',
      label: 'Validation Multi-Niveaux',
      icon: ClipboardCheck,
      badge: pendingCount > 0 ? pendingCount : null,
    },
    { id: 'enrolment', label: 'Registre & Enrôlement', icon: UserPlus },
    { id: 'unions', label: 'Syndicats & Organisations', icon: Building2 },
    { id: 'authorities', label: 'Autorités Administratives', icon: ShieldCheck },
    { id: 'badges', label: 'Badges Chauffeurs (CR80)', icon: IdCard },
    { id: 'licences', label: 'Licences & Stickers', icon: FileCheck2 },
    { id: 'mapping', label: 'Réseau & Carte Conakry', icon: MapPin },
    { id: 'ticketing', label: 'Billetterie & Finances', icon: Ticket },
    { id: 'users', label: 'Gestion Utilisateurs (DSI)', icon: UserCog },
    { id: 'audit', label: 'Journal d Audit & Sécurité', icon: ShieldAlert },
  ];

  // Least-Privilege Filtering: Only display navigation tabs authorized for user's role and offline state
  const visibleMenuItems = allMenuItems.filter((item) =>
    isTabAllowed(currentUser.role, item.id, isOfflineSession)
  );

  return (
    <>
      {/* --------------------------------------------------------------------- */}
      {/* 1. DESKTOP PERMANENT SIDEBAR (Visible on lg+ screens)                  */}
      {/* --------------------------------------------------------------------- */}
      <aside className="hidden lg:flex w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 min-h-[calc(100vh-4.5rem)] p-4 flex-col justify-between transition-colors duration-200 flex-shrink-0">
        <div className="space-y-1">
          {/* Official Dual Branding (Republic of Guinea primary + AOTUC platform) */}
          <DualBranding variant="sidebar" className="mb-3" />

          {isOfflineSession && (
            <div className="mb-3 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-400 text-xs flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
              <div>
                <span className="font-bold block">Session Hors Ligne</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-500">Enrôlement local uniquement</span>
              </div>
            </div>
          )}
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

        {/* Desktop Footer Info Box */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] text-slate-500 dark:text-slate-400 space-y-2">
          <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-200 dark:border-slate-700">
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500 shadow-sm flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {currentUser.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold truncate">
                {currentUser.roleLabel}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-1.5">
              <img
                src="/logo-guinee.png"
                alt="République de Guinée"
                className="w-5 h-5 object-contain"
              />
              <img
                src="/aotuc-logo.png"
                alt="AOTUC"
                className="w-4 h-4 rounded-full object-contain bg-white p-0.2 border border-slate-200 dark:border-slate-700"
              />
              <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">GUINÉE • AOTUC</span>
            </div>
            <div className="font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-1 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span>RBAC Actif</span>
            </div>
          </div>
          <div className="text-[9.5px] text-slate-400 dark:text-slate-500 italic leading-tight text-center">
            « Pour une Mobilité Urbaine Participative &amp; Durable »
          </div>
        </div>
      </aside>

      {/* --------------------------------------------------------------------- */}
      {/* 2. MOBILE RESPONSIVE DRAWER & OVERLAY (Visible on < lg screens)       */}
      {/* --------------------------------------------------------------------- */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity duration-200"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-slate-900 shadow-2xl flex flex-col justify-between p-4 overflow-y-auto lg:hidden transform transition-transform duration-200 ease-in-out border-r border-slate-200 dark:border-slate-800 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
        <div className="space-y-3">
          {/* Mobile Drawer Header with Close Button */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Menu Principal
            </span>
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
              aria-label="Fermer le menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Official Dual Branding in Mobile Drawer */}
          <DualBranding variant="sidebar" />

          <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Modules Opérationnels
          </div>

          {/* Touch-Friendly Menu Buttons (min-h-[44px]) */}
          <div className="space-y-1">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile?.();
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition cursor-pointer min-h-[44px] ${
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
        </div>

        {/* Mobile Drawer Footer with User Credentials & One-Tap Logout */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center space-x-2.5 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shadow-sm flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {currentUser.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-800 dark:text-slate-100 truncate text-xs">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold truncate">
                {currentUser.roleLabel}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {currentUser.communeName || 'Direction Générale (Conakry)'}
              </div>
            </div>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={() => {
                onCloseMobile?.();
                onLogout();
              }}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-400 rounded-xl text-xs font-bold transition min-h-[44px] cursor-pointer border border-rose-200 dark:border-rose-900"
            >
              <LogOut className="w-4 h-4" />
              <span>Se Déconnecter</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
