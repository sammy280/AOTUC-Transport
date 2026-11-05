import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = false }) => {
  const { toggleTheme, isDark } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
        isDark
          ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700 shadow-sm'
          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 shadow-sm'
      } ${className}`}
      title={isDark ? 'Basculer en Mode Clair (Jour)' : 'Basculer en Mode Sombre (Nuit)'}
      aria-label={isDark ? 'Mode Clair' : 'Mode Sombre'}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-300 animate-spin-slow transition-transform hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-600 transition-transform hover:-rotate-12" />
      )}
      {showLabel && (
        <span className="hidden md:inline font-medium text-[11px]">
          {isDark ? 'Mode Clair' : 'Mode Sombre'}
        </span>
      )}
    </button>
  );
};

export default ThemeToggle;
