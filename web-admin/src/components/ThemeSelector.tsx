import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme, ThemeMode } from '../context/ThemeContext';

interface ThemeSelectorProps {
  className?: string;
  variant?: 'dropdown' | 'segmented';
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  className = '',
  variant = 'dropdown',
}) => {
  const { mode, resolvedTheme, setMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const options: Array<{
    mode: ThemeMode;
    label: string;
    description: string;
    icon: typeof Sun;
  }> = [
    {
      mode: 'light',
      label: 'Clair',
      description: 'Interface lumineuse standard AOTUC',
      icon: Sun,
    },
    {
      mode: 'dark',
      label: 'Sombre',
      description: 'Interface sombre à contraste reposant',
      icon: Moon,
    },
    {
      mode: 'system',
      label: 'Système',
      description: 'Suit automatiquement les réglages de votre appareil',
      icon: Monitor,
    },
  ];

  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex items-center p-1 bg-slate-200/80 dark:bg-slate-800 rounded-xl border border-slate-300/60 dark:border-slate-700 ${className}`}
      >
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = mode === opt.mode;

          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => setMode(opt.mode)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isSelected
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={opt.description}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Current icon to display on toggle button
  const CurrentIcon =
    mode === 'system'
      ? Monitor
      : resolvedTheme === 'dark'
      ? Moon
      : Sun;

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center space-x-2 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold transition cursor-pointer shadow-sm"
        title="Changer le thème d affichage (Clair, Sombre, Système)"
        aria-expanded={isOpen}
      >
        <CurrentIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <span className="hidden md:inline capitalize text-[11px]">
          {mode === 'system' ? 'Système' : mode === 'dark' ? 'Sombre' : 'Clair'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Apparence & Thème Visuel
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              Préférence mémorisée individuellement pour votre profil
            </div>
          </div>

          <div className="p-1 space-y-1">
            {options.map((opt) => {
              const Icon = opt.icon;
              const isSelected = mode === opt.mode;

              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => {
                    setMode(opt.mode);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start justify-between p-2.5 rounded-xl text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white font-medium'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div
                      className={`p-2 rounded-lg mt-0.5 ${
                        isSelected
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center space-x-1.5">
                        <span>{opt.label}</span>
                        {opt.mode === 'system' && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-normal">
                            Auto
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {opt.description}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="text-emerald-600 dark:text-emerald-400 pt-1 pr-1">
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>Rendu actuel :</span>
            <span className="font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              {resolvedTheme === 'dark' ? '🌙 Sombre' : '☀️ Clair'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;
