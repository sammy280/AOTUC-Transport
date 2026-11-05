import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Trash2,
  ShieldAlert,
  FileCheck,
  Banknote,
  Smartphone,
  ExternalLink,
  Sparkles,
  Info,
  X,
} from 'lucide-react';
import { NotificationItem, NotificationCategory } from '../types';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onSelectNotification: (item: NotificationItem) => void;
  onTriggerTestNotification: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onSelectNotification,
  onTriggerTestNotification,
}) => {
  const [activeFilter, setActiveFilter] = useState<'ALL' | NotificationCategory>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === 'ALL') return true;
    return item.category === activeFilter;
  });

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'VALIDATION':
        return <FileCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'SECURITY':
        return <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'TICKETING':
        return <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'SMS':
        return <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      default:
        return <Info className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  const getCategoryBadge = (category: NotificationCategory) => {
    switch (category) {
      case 'VALIDATION':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Validation
          </span>
        );
      case 'SECURITY':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            Sécurité
          </span>
        );
      case 'TICKETING':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Billetterie
          </span>
        );
      case 'SMS':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            SMS
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Info
          </span>
        );
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 w-96 sm:w-[440px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {/* Guinean Tricolor accent strip */}
      <div className="h-1 w-full flex">
        <div className="w-1/3 bg-[#CE1126]" />
        <div className="w-1/3 bg-[#FCD116]" />
        <div className="w-1/3 bg-[#009460]" />
      </div>

      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-red-100 dark:bg-red-950/60 rounded-lg text-[#CE1126] dark:text-red-400">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notifications Système</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-bold bg-[#CE1126] text-white rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Flux d alertes en temps réel & événements AOTUC</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          title="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs & Quick Actions */}
      <div className="px-3 pt-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs bg-white dark:bg-slate-900">
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              activeFilter === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-slate-800 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Toutes ({notifications.length})
          </button>
          <button
            onClick={() => setActiveFilter('VALIDATION')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              activeFilter === 'VALIDATION'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Validations
          </button>
          <button
            onClick={() => setActiveFilter('SECURITY')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              activeFilter === 'SECURITY'
                ? 'bg-red-600 text-white font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Sécurité
          </button>
          <button
            onClick={() => setActiveFilter('TICKETING')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              activeFilter === 'TICKETING'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Billetterie
          </button>
          <button
            onClick={() => setActiveFilter('SMS')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              activeFilter === 'SMS'
                ? 'bg-amber-600 text-white font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            SMS
          </button>
        </div>

        <div className="flex items-center space-x-1 pl-2 border-l border-slate-200 dark:border-slate-800">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="p-1.5 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition cursor-pointer"
              title="Tout marquer comme lu"
            >
              <CheckCheck className="w-3.5 h-3.5" />
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={onClearAll}
              className="p-1.5 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/50 transition cursor-pointer"
              title="Vider la liste"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Notification Items List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {filteredNotifications.length === 0 ? (
          <div className="py-10 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-2">
              <Bell className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Aucune notification</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Toutes les alertes de cette catégorie ont été traitées ou vidées.
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                onMarkAsRead(item.id);
                if (item.linkTab) {
                  onSelectNotification(item);
                  onClose();
                }
              }}
              className={`p-3.5 flex items-start space-x-3 cursor-pointer transition ${
                !item.isRead
                  ? 'bg-blue-50/40 dark:bg-blue-950/30 hover:bg-blue-50/70 dark:hover:bg-blue-950/50'
                  : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              {/* Icon badge */}
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 flex-shrink-0 mt-0.5">
                {getCategoryIcon(item.category)}
              </div>

              {/* Notification Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    {getCategoryBadge(item.category)}
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 flex-shrink-0 animate-pulse" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{item.timestamp}</span>
                </div>

                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                  {item.title}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                  {item.message}
                </p>

                {item.linkTab && (
                  <div className="mt-2 flex items-center text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 space-x-1">
                    <span>Accéder au module</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer with Simulator Trigger */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <button
          onClick={onTriggerTestNotification}
          className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 flex items-center space-x-1 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Simuler une alerte en direct</span>
        </button>

        <span className="text-[10px] text-slate-400 dark:text-slate-500">AOTUC Socket Hub & SMS</span>
      </div>
    </div>
  );
};

export default NotificationDropdown;
