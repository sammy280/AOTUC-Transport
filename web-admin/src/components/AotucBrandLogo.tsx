import React from 'react';
import { AOTUC_BRANDING } from '../config/branding';

interface AotucBrandLogoProps {
  variant?: 'seal' | 'banner' | 'header' | 'compact';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showMotto?: boolean;
  className?: string;
}

export const AotucBrandLogo: React.FC<AotucBrandLogoProps> = ({
  variant = 'header',
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

  const headerSizes = {
    sm: 'h-8',
    md: 'h-11',
    lg: 'h-14',
    xl: 'h-20',
  };

  if (variant === 'banner') {
    return (
      <div className={`rounded-xl overflow-hidden shadow-lg border border-slate-700/50 bg-[#0B1E36] p-1 ${className}`}>
        <img
          src={AOTUC_BRANDING.assets.banner}
          alt={`${AOTUC_BRANDING.fullName} — ${AOTUC_BRANDING.motto}`}
          className="w-full h-auto object-contain select-none"
        />
      </div>
    );
  }

  if (variant === 'header') {
    return (
      <div className={`inline-flex items-center space-x-3 bg-[#0B1E36] px-2.5 py-1.5 rounded-xl shadow-md border border-slate-700/60 ${className}`}>
        <img
          src={AOTUC_BRANDING.assets.headerBrand}
          alt={`${AOTUC_BRANDING.fullName} — ${AOTUC_BRANDING.motto}`}
          className={`${headerSizes[size]} w-auto object-contain select-none`}
        />
        {showMotto && (
          <span className="text-[10px] text-sky-400 italic font-medium hidden md:inline">
            {AOTUC_BRANDING.mottoQuote}
          </span>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center space-x-2 bg-[#0B1E36] px-2 py-1 rounded-lg border border-slate-700/50 ${className}`}>
        <img
          src={AOTUC_BRANDING.assets.seal}
          alt={AOTUC_BRANDING.fullName}
          className="w-7 h-7 object-contain select-none"
        />
        <span className="font-black text-white tracking-tight text-xs">
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
