import React from 'react';
import { AOTUC_BRANDING } from '../config/branding';

interface AotucBrandLogoProps {
  variant?: 'seal' | 'banner' | 'header' | 'compact' | 'dual';
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

  if (variant === 'header' || variant === 'dual') {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        {/* Primary Identity: République de Guinée (Larger) */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          <img
            src={AOTUC_BRANDING.assets.nationalCoatOfArms}
            alt="Armoiries République de Guinée"
            className={`${sealSizes[size]} object-contain filter drop-shadow-xs select-none`}
          />
          <div className="leading-tight">
            <span className="block text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              {AOTUC_BRANDING.countryOfficial}
            </span>
            <span className="block text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
              {AOTUC_BRANDING.ministry}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-7 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

        {/* Secondary Identity: AOTUC */}
        <div className="flex items-center space-x-2">
          <img
            src={AOTUC_BRANDING.assets.seal}
            alt={AOTUC_BRANDING.fullName}
            className="w-8 h-8 object-contain rounded-full shadow-xs bg-white border border-slate-200 dark:border-slate-700 flex-shrink-0 select-none"
          />
          <div className="leading-tight">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                {AOTUC_BRANDING.acronym}
              </span>
              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800">
                Officiel
              </span>
            </div>
            <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-tight hidden sm:block">
              {AOTUC_BRANDING.nameFr}
            </div>
            {showMotto && (
              <div className="text-[9px] text-blue-600 dark:text-sky-400 italic font-medium mt-0.5">
                {AOTUC_BRANDING.mottoQuote}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <img
          src={AOTUC_BRANDING.assets.nationalCoatOfArms}
          alt="République de Guinée"
          className="w-7 h-7 object-contain flex-shrink-0 select-none"
        />
        <span className="text-slate-300 dark:text-slate-600">•</span>
        <img
          src={AOTUC_BRANDING.assets.seal}
          alt={AOTUC_BRANDING.fullName}
          className="w-5 h-5 object-contain rounded-full shadow-2xs bg-white border border-slate-200 dark:border-slate-700 flex-shrink-0 select-none"
        />
        <span className="font-black text-xs text-slate-900 dark:text-white tracking-tight">
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
      className={`${sealSizes[size]} object-contain rounded-full shadow-sm bg-white border border-slate-200 dark:border-slate-700 select-none ${className}`}
    />
  );
};

export default AotucBrandLogo;
