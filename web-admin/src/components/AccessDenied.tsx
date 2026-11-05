import React from 'react';
import { ShieldAlert, ArrowLeft, Lock, Building2, UserCheck } from 'lucide-react';
import { UserContext } from '../types';

interface AccessDeniedProps {
  currentUser: UserContext;
  attemptedTab?: string;
  onNavigateHome: () => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  currentUser,
  attemptedTab,
  onNavigateHome,
}) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-red-200 dark:border-red-900/40 overflow-hidden transition-colors duration-200">
        {/* Tricolor Header Strip */}
        <div className="h-2 w-full flex">
          <div className="w-1/3 bg-[#CE1126]" />
          <div className="w-1/3 bg-[#FCD116]" />
          <div className="w-1/3 bg-[#009460]" />
        </div>

        <div className="p-8 text-center space-y-6">
          <div className="inline-flex p-4 bg-red-50 dark:bg-red-950/40 text-[#CE1126] dark:text-red-400 rounded-2xl border border-red-200 dark:border-red-900/60">
            <ShieldAlert className="w-12 h-12 stroke-[1.75]" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 text-[11px] font-bold uppercase tracking-wider rounded-full">
              <Lock className="w-3.5 h-3.5" />
              <span>Contrôle d Accès RBAC • HTTP 403 Forbidden</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Accès Restreint — Habilitation Insuffisante
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              La politique de sécurité stricte de l AOTUC interdit l accès au module{' '}
              {attemptedTab ? <strong className="text-slate-800 dark:text-slate-200 font-mono font-semibold">"{attemptedTab}"</strong> : 'demandé'}{' '}
              pour votre niveau d accréditation opérationnelle.
            </p>
          </div>

          {/* User Accreditation Snapshot */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-left text-xs space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Profil de Session Connecté
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-2">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Utilisateur Actif</span>
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{currentUser.name}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-500 dark:text-slate-400">Rôle Officiel</span>
              <span className="font-bold text-[#CE1126] dark:text-red-400">{currentUser.roleLabel}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-2">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Périmètre Territorial</span>
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{currentUser.communeName}</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={onNavigateHome}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer border dark:border-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retourner à mon Espace Habilité</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-center text-[10px] text-slate-400 dark:text-slate-500">
          Toute tentative non autorisée de contournement est tracée dans le journal d intégrité SHA-256 AOTUC.
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
