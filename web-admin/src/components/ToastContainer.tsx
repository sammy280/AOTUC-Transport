import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastMessage } from '../types';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  const getToastIcon = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />;
    }
  };

  const getBorderColor = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return 'border-emerald-500 bg-emerald-50/90 dark:bg-slate-900 text-emerald-950 dark:text-emerald-300 border-t border-r border-b dark:border-slate-800';
      case 'warning':
        return 'border-amber-500 bg-amber-50/90 dark:bg-slate-900 text-amber-950 dark:text-amber-300 border-t border-r border-b dark:border-slate-800';
      case 'error':
        return 'border-red-500 bg-red-50/90 dark:bg-slate-900 text-red-950 dark:text-red-300 border-t border-r border-b dark:border-slate-800';
      case 'info':
      default:
        return 'border-blue-500 bg-blue-50/90 dark:bg-slate-900 text-blue-950 dark:text-blue-300 border-t border-r border-b dark:border-slate-800';
    }
  };

  return (
    <aside aria-label="Notifications système" className="fixed bottom-5 right-5 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start space-x-3 p-4 rounded-xl border-l-4 shadow-xl backdrop-blur-sm bg-white dark:bg-slate-900 transition-all transform animate-in slide-in-from-bottom-3 duration-200 ${getBorderColor(
            toast.type
          )}`}
        >
          {getToastIcon(toast.type)}

          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold leading-tight text-slate-900 dark:text-white">{toast.title}</h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">{toast.message}</p>
          </div>

          <button
            onClick={() => onDismiss(toast.id)}
            className="text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 p-1 -mr-1 -mt-1 rounded hover:bg-slate-200/50 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Masquer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </aside>
  );
};

export default ToastContainer;
