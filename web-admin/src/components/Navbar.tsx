import React, { useState, useRef, useEffect } from 'react';
import { UserContext, NotificationItem } from '../types';
import {
  ShieldCheck,
  UserCheck,
  Bell,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Check,
  Building2,
  Mail,
  Phone,
  ChevronDown,
} from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import ThemeSelector from './ThemeSelector';
import { useTheme } from '../context/ThemeContext';

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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { mode, resolvedTheme, setMode } = useTheme();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen]);

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
            <div className="h-12 flex items-center bg-[#0B1E36] px-2.5 py-1 rounded-xl shadow-md border border-slate-700/60 flex-shrink-0">
              <img
                src="/aotuc-header-brand.png"
                alt="AOTUC — Autorité Organisatrice des Transports Urbains de Conakry"
                className="h-10 w-auto object-contain select-none"
              />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                  AOTUC-TRANSPORT
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800">
                  v2.0 Officiel
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Autorité Organisatrice des Transports Urbains de Conakry</span> • <span className="italic font-medium text-blue-600 dark:text-sky-400">« Pour une Mobilité Urbaine Participative &amp; Durable »</span>
              </p>
            </div>
          </div>

          {/* Right Controls: Role Badge, Theme Selector, Notifications & Profile */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Active Accredited Role Badge */}
            <div className="hidden sm:flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="font-semibold text-slate-900 dark:text-slate-100">{currentUser.roleLabel}</span>
            </div>

            {/* Quick 3-Option Theme Selector (Sun, Moon, Monitor) */}
            <ThemeSelector variant="dropdown" />

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

            {/* User Profile Pill with Appearance Settings Dropdown */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setIsProfileOpen((prev) => !prev)}
                className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-800 hover:opacity-85 transition cursor-pointer text-left"
                title="Mon profil et paramètres d apparence"
                aria-expanded={isProfileOpen}
              >
                <div className="w-8 h-8 rounded-full bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center font-medium text-xs shadow-sm">
                  <UserCheck className="w-4 h-4 text-[#FCD116]" />
                </div>
                <div className="text-left hidden lg:block">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight flex items-center space-x-1">
                    <span>{currentUser.name}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {currentUser.communeName}
                  </div>
                </div>
              </button>

              {/* User Profile & Appearance Settings Popover */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Popover Header */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {currentUser.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {currentUser.name}
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                        {currentUser.roleLabel}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center space-x-1 mt-0.5">
                        <Building2 className="w-3 h-3 flex-shrink-0" />
                        <span>{currentUser.communeName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Profile Details */}
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                    {currentUser.email && (
                      <div className="flex items-center space-x-2 text-[11px]">
                        <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{currentUser.email}</span>
                      </div>
                    )}
                    {currentUser.phoneNumber && (
                      <div className="flex items-center space-x-2 text-[11px]">
                        <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{currentUser.phoneNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Appearance Options Section in User Settings */}
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Apparence du Système
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {resolvedTheme === 'dark' ? 'Actif: Sombre' : 'Actif: Clair'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      Choisissez votre mode d affichage préféré. Ce réglage est mémorisé indépendamment pour votre compte.
                    </p>

                    {/* Segmented 3-button selector */}
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setMode('light')}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          mode === 'light'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-300 dark:ring-slate-700'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                        title="Mode Clair"
                      >
                        <Sun className="w-4 h-4 mb-1 text-amber-500" />
                        <span className="text-[10px]">Clair</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMode('dark')}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          mode === 'dark'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-300 dark:ring-slate-700'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                        title="Mode Sombre"
                      >
                        <Moon className="w-4 h-4 mb-1 text-indigo-400" />
                        <span className="text-[10px]">Sombre</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMode('system')}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          mode === 'system'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-300 dark:ring-slate-700'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                        title="Mode Système Automatique"
                      >
                        <Monitor className="w-4 h-4 mb-1 text-emerald-500" />
                        <span className="text-[10px]">Système</span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 dark:text-slate-500 pt-1">
                      <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      <span>Synchronisé pour ce compte utilisateur</span>
                    </div>
                  </div>

                  {/* Popover Footer: Logout */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">Session AOTUC Sécurisée</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        onLogout();
                      }}
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Déconnexion</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Direct Logout Action Button */}
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
