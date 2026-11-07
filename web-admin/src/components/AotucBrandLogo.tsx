import React from 'react';
import { AOTUC_BRANDING } from '../config/branding';

interface AotucBrandLogoProps {
  variant?: 'seal' | 'banner' | 'header' | 'compact';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showMotto?: boolean;
  className?: string;
}

export const AotucBrandLogo: React.FC<AotucBrandLogoProps> = ({
  variant = 'seal',
  size = 'md',
  showMotto = false,
  className = '',
}) => {
  const sealSizes = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  if (variant === 'banner') {
    return (
      <div className={`rounded-xl overflow-hidden shadow-lg border border-slate-700/50 bg-[#0B1E36] ${className}`}>
        <img
          src={AOTUC_BRANDING.assets.banner}
          alt={`${AOTUC_BRANDING.fullName} — ${AOTUC_BRANDING.motto}`}
          className="w-full h-auto object-cover select-none"
        />
      </div>
    );
  }

  if (variant === 'header') {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <img
          src={AOTUC_BRANDING.assets.seal}
          alt={AOTUC_BRANDING.fullName}
          className={`${sealSizes[size]} object-contain rounded-full shadow-sm bg-white p-0.5 border border-slate-200 dark:border-slate-700 flex-shrink-0 select-none`}
        />
        <div className="leading-tight">
          <div className="flex items-center space-x-2">
            <span className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              {AOTUC_BRANDING.acronym}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800">
              Officiel
            </span>
          </div>
          <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-tight hidden sm:block">
            {AOTUC_BRANDING.nameFr}
          </div>
          {showMotto && (
            <div className="text-[10px] text-blue-600 dark:text-sky-400 italic font-medium mt-0.5">
              {AOTUC_BRANDING.mottoQuote}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <img
          src={AOTUC_BRANDING.assets.seal}
          alt={AOTUC_BRANDING.fullName}
          className={`${sealSizes[size]} object-contain rounded-full shadow-sm bg-white p-0.5 border border-slate-200 dark:border-slate-700 flex-shrink-0 select-none`}
        />
        <span className="font-black text-slate-900 dark:text-white tracking-tight">
          {AOTUC_BRANDING.acronym}
        </span>
      </div>
    );
  }

  // Default: round seal
  return (
    <img
      src={AOTUC_BRANDING.assets.seal}
      alt={AOTUC_BRANDING.fullName}
      className={`${sealSizes[size]} object-contain rounded-full shadow-sm bg-white p-0.5 border border-slate-200 dark:border-slate-700 select-none ${className}`}
    />
  );
};

export default AotucBrandLogo;
