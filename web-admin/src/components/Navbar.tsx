import React, { useState } from 'react';
import { UserContext, NotificationItem } from '../types';
import { ShieldCheck, UserCheck, Bell, LogOut } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import ThemeToggle from './ThemeToggle';

interface NavbarProps {
  currentUser: UserContext;
  notifications: NotificationItem[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onSelectNotification: (item: NotificationItem) => void;
  onTriggerTestNotification: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onSelectNotification,
  onTriggerTestNotification,
  onLogout,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
      {/* Guinean Tricolor National Banner */}
      <div className="h-1.5 w-full flex">
        <div className="w-1/3 bg-[#CE1126]" title="Rouge - Travail et sacrifice" />
        <div className="w-1/3 bg-[#FCD116]" title="Jaune - Justice et soleil" />
        <div className="w-1/3 bg-[#009460]" title="Vert - Solidarité et terre" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand & Organization Title */}
          <div className="flex items-center space-x-3">
            <img
              src="/logo-guinee.png"
              alt="République de Guinée - Ministère des Transports"
              className="w-11 h-11 object-contain rounded-full shadow-sm bg-white p-0.5 border border-slate-200 dark:border-slate-700 flex-shrink-0"
            />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  AOTUC-TRANSPORT
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800">
                  v2.0 Officiel
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Ministère des Transports • République de Guinée • AOTUC
              </p>
            </div>
          </div>

          {/* Right Controls: Role Badge, Theme Toggle, Notifications & Profile */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Active Accredited Role Badge */}
            <div className="hidden sm:flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="font-semibold text-slate-900 dark:text-slate-100">{currentUser.roleLabel}</span>
            </div>

            {/* Dark / Light Mode Switcher */}
            <ThemeToggle showLabel={false} />

            {/* Notifications Dropdown Anchor */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className={`p-2 rounded-full relative transition cursor-pointer ${
                  isDropdownOpen
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white ring-2 ring-slate-300 dark:ring-slate-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Notifications système AOTUC"
                aria-expanded={isDropdownOpen}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#CE1126] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <NotificationDropdown
                isOpen={isDropdownOpen}
                onClose={() => setIsDropdownOpen(false)}
                notifications={notifications}
                onMarkAsRead={onMarkAsRead}
                onMarkAllAsRead={onMarkAllAsRead}
                onClearAll={onClearAll}
                onSelectNotification={onSelectNotification}
                onTriggerTestNotification={onTriggerTestNotification}
              />
            </div>

            {/* User Profile Pill */}
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 rounded-full bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center font-medium text-xs">
                <UserCheck className="w-4 h-4 text-[#FCD116]" />
              </div>
              <div className="text-left hidden lg:block">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {currentUser.communeName}
                </div>
              </div>
            </div>

            {/* Logout Action Button */}
            <button
              onClick={onLogout}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900/50 rounded-lg transition cursor-pointer"
              title="Se déconnecter de la session AOTUC"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
