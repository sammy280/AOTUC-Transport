import React from 'react';
import { AOTUC_BRANDING } from '../config/branding';

export type DualBrandingVariant =
  | 'navbar'
  | 'sidebar'
  | 'hero'
  | 'card'
  | 'public-header'
  | 'compact';

interface DualBrandingProps {
  variant?: DualBrandingVariant;
  className?: string;
  showMotto?: boolean;
}

/**
 * Shared Dual Branding Component for AOTUC-TRANSPORT
 *
 * Implements the official institutional visual hierarchy:
 * 1. Primary Institutional Identity: RÉPUBLIQUE DE GUINÉE (Coat of arms & name significantly larger)
 * 2. Platform Identity: AOTUC-TRANSPORT (AOTUC Logo & platform designation clearly visible)
 */
export const DualBranding: React.FC<DualBrandingProps> = ({
  variant = 'navbar',
  className = '',
  showMotto = false,
}) => {
  // ---------------------------------------------------------------------------
  // 1. NAVBAR VARIANT (Top Header on ALL Logged-In Administrative Pages)
  // ---------------------------------------------------------------------------
  if (variant === 'navbar') {
    return (
      <div className={`flex items-center space-x-2.5 sm:space-x-3.5 min-w-0 ${className}`}>
        {/* Primary Identity: République de Guinée (Significantly larger emblem) */}
        <div className="flex items-center space-x-2 sm:space-x-2.5 flex-shrink-0">
          <img
            src={AOTUC_BRANDING.assets.nationalCoatOfArms}
            alt="Armoiries Officielles de la République de Guinée"
            className="w-10 h-10 sm:w-12 sm:h-12 object-contain filter drop-shadow-xs select-none"
          />
          <div className="leading-tight select-none">
            <span className="block text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              {AOTUC_BRANDING.countryOfficial}
            </span>
            <span className="block text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
              {AOTUC_BRANDING.ministry}
            </span>
          </div>
        </div>

        {/* Institutional Divider (Desktop) */}
        <div className="hidden sm:block h-8 w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

        {/* Secondary Identity: AOTUC-TRANSPORT Platform */}
        <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
          <img
            src={AOTUC_BRANDING.assets.logo}
            alt="Logo Officiel AOTUC"
            className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-full shadow-xs bg-white p-0.5 border border-slate-200 dark:border-slate-700 flex-shrink-0 select-none"
          />
          <div className="min-w-0 leading-tight">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight truncate">
                AOTUC-TRANSPORT
              </span>
              <span className="hidden md:inline-flex px-1.5 py-0.2 text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800">
                v2.0
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 hidden lg:block truncate max-w-xs xl:max-w-md">
              {AOTUC_BRANDING.nameFr}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. SIDEBAR VARIANT (Top of Sidebar & Mobile Drawer)
  // ---------------------------------------------------------------------------
  if (variant === 'sidebar') {
    return (
      <div className={`p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-2.5 ${className}`}>
        {/* Tricolor Accent Pill */}
        <div className="h-1 w-full flex rounded-full overflow-hidden">
          <div className="w-1/3 bg-[#CE1126]" />
          <div className="w-1/3 bg-[#FCD116]" />
          <div className="w-1/3 bg-[#009460]" />
        </div>

        {/* Primary Identity: République de Guinée (Large emblem) */}
        <div className="flex items-center space-x-2.5">
          <img
            src={AOTUC_BRANDING.assets.nationalCoatOfArms}
            alt="Armoiries République de Guinée"
            className="w-11 h-11 object-contain filter drop-shadow-xs flex-shrink-0 select-none"
          />
          <div className="leading-tight min-w-0">
            <span className="block text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider truncate">
              {AOTUC_BRANDING.countryOfficial}
            </span>
            <span className="block text-[9.5px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-tight truncate">
              {AOTUC_BRANDING.ministry}
            </span>
          </div>
        </div>

        {/* Secondary Identity: AOTUC Platform */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 flex items-center space-x-2">
          <img
            src={AOTUC_BRANDING.assets.logo}
            alt="Logo AOTUC"
            className="w-7 h-7 object-contain rounded-full bg-white p-0.5 border border-slate-200 dark:border-slate-700 shadow-2xs flex-shrink-0"
          />
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate leading-tight">
              AOTUC-TRANSPORT
            </span>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 block truncate">
              Mobilité Urbaine Conakry
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 3. HERO VARIANT (Login Screen Left Institutional Column)
  // ---------------------------------------------------------------------------
  if (variant === 'hero') {
    return (
      <div className={`space-y-6 text-center lg:text-left ${className}`}>
        {/* Primary Emblem & Institutional Title */}
        <div className="flex flex-col items-center lg:items-start space-y-3">
          <img
            src={AOTUC_BRANDING.assets.nationalCoatOfArms}
            alt="Armoiries Officielles de la République de Guinée"
            className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 object-contain filter drop-shadow-lg select-none"
          />
          <div className="space-y-1">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-[#FCD116] block">
              {AOTUC_BRANDING.countryMotto}
            </span>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white uppercase">
              {AOTUC_BRANDING.countryOfficial}
            </h1>
            <div className="text-xs sm:text-sm font-bold text-slate-300 uppercase tracking-wider">
              {AOTUC_BRANDING.ministry}
            </div>
          </div>
        </div>

        {/* Secondary Platform Identity Lockup */}
        <div className="inline-flex items-center space-x-3 bg-slate-800/90 dark:bg-slate-800/90 border border-slate-700 px-4 py-2.5 rounded-2xl shadow-md">
          <img
            src={AOTUC_BRANDING.assets.logo}
            alt="Logo AOTUC"
            className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-full bg-white p-0.5 border border-slate-600 shadow-xs flex-shrink-0"
          />
          <div className="text-left">
            <span className="text-xs sm:text-sm font-black text-white block tracking-tight">
              AOTUC-TRANSPORT
            </span>
            <span className="text-[10px] text-slate-400 block font-medium leading-tight">
              Autorité Organisatrice des Transports Urbains de Conakry
            </span>
          </div>
        </div>

        {/* Official Platform Slogan */}
        <div>
          <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold italic">
            {AOTUC_BRANDING.mottoQuote}
          </div>
          <p className="text-xs text-slate-400 mt-2.5 leading-relaxed max-w-md mx-auto lg:mx-0">
            {AOTUC_BRANDING.description}
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 4. CARD VARIANT (Login Screen Right Box Header)
  // ---------------------------------------------------------------------------
  if (variant === 'card') {
    return (
      <div className={`p-5 sm:p-7 bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 ${className}`}>
        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
          {/* Primary Guinea Emblem (Larger) */}
          <img
            src={AOTUC_BRANDING.assets.nationalCoatOfArms}
            alt="Armoiries République de Guinée"
            className="w-13 h-13 sm:w-15 sm:h-15 object-contain filter drop-shadow-xs flex-shrink-0 select-none"
          />

          {/* Institutional Divider */}
          <div className="h-10 w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

          {/* Secondary AOTUC Logo */}
          <img
            src={AOTUC_BRANDING.assets.logo}
            alt="Logo AOTUC"
            className="w-10 h-10 sm:w-11 sm:h-11 object-contain rounded-full bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shadow-xs flex-shrink-0"
          />

          {/* Typography */}
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              {AOTUC_BRANDING.countryOfficial}
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
              Portail d Accès Sécurisé
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              AOTUC-TRANSPORT • Console de Gestion
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 5. PUBLIC-HEADER VARIANT (Public QR Verification & Status Pages)
  // ---------------------------------------------------------------------------
  if (variant === 'public-header') {
    return (
      <div className={`flex items-center space-x-3 sm:space-x-4 ${className}`}>
        {/* Primary Identity: République de Guinée (Larger) */}
        <img
          src={AOTUC_BRANDING.assets.nationalCoatOfArms}
          alt="Armoiries Officielles de la République de Guinée"
          className="w-12 h-12 sm:w-14 sm:h-14 object-contain filter drop-shadow-xs flex-shrink-0 select-none"
        />

        {/* Divider */}
        <div className="h-9 w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

        {/* Secondary Identity: AOTUC */}
        <img
          src={AOTUC_BRANDING.assets.logo}
          alt="Logo Officiel AOTUC"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-contain p-0.5 border border-slate-200 dark:border-slate-700 shadow-xs bg-white flex-shrink-0"
        />

        {/* Header Titles */}
        <div className="leading-tight">
          <div className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-slate-600 dark:text-slate-300">
            {AOTUC_BRANDING.countryOfficial} • {AOTUC_BRANDING.ministryOfficial}
          </div>
          <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight">
            AOTUC-TRANSPORT • {AOTUC_BRANDING.nameFr}
          </h1>
          {showMotto && (
            <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 italic font-medium">
              {AOTUC_BRANDING.mottoQuote}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 6. COMPACT VARIANT (For modal headers, cards, or tight spaces)
  // ---------------------------------------------------------------------------
  return (
    <div className={`inline-flex items-center space-x-2.5 ${className}`}>
      <img
        src={AOTUC_BRANDING.assets.nationalCoatOfArms}
        alt="République de Guinée"
        className="w-7 h-7 object-contain flex-shrink-0"
      />
      <span className="text-xs font-black text-slate-900 dark:text-white tracking-wider uppercase">
        {AOTUC_BRANDING.countryOfficial}
      </span>
      <span className="text-slate-300 dark:text-slate-600">•</span>
      <img
        src={AOTUC_BRANDING.assets.logo}
        alt="AOTUC"
        className="w-5 h-5 rounded-full object-contain bg-white p-0.2 border border-slate-200 dark:border-slate-700"
      />
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tracking-tight">
        AOTUC
      </span>
    </div>
  );
};

export default DualBranding;
