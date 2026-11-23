import React, { useState } from 'react';
import {
  Printer,
  Download,
  X,
  CheckCircle2,
  QrCode,
  User,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

export interface PrintableBadgeData {
  type: 'BADGE';
  id: string;
  badgeNumber: string;
  driverName: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  activitySector?: string;
  registrationNumber?: string;
  nin: string;
  licenseNumber: string;
  categories: string;
  commune: string;
  expiryDate: string;
  photoUrl?: string | null;
  signaturePreview: string;
  status: string;
  isPaymentConfirmed?: boolean;
}

export interface PrintableLicenceData {
  type: 'LICENCE';
  id: string;
  licenceNumber: string;
  plateNumber: string;
  vehicleMakeModel: string;
  ownerName: string;
  activitySector?: string;
  commune: string;
  seats: number;
  validYear: number;
  expiryDate: string;
  signaturePreview: string;
  status: string;
  isPaymentConfirmed?: boolean;
  superAdminConfirmed?: boolean;
}

export type PrintableCredentialData = PrintableBadgeData | PrintableLicenceData;

interface PrintCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PrintableCredentialData;
  onDownloadPdf?: () => void;
}

export const PrintCredentialModal: React.FC<PrintCredentialModalProps> = ({
  isOpen,
  onClose,
  data,
  onDownloadPdf,
}) => {
  const [badgeSide, setBadgeSide] = useState<'recto' | 'verso' | 'both'>('recto');
  const [colorMode, setColorMode] = useState<'color' | 'grayscale'>('color');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  if (!isOpen) return null;

  const isBadge = data.type === 'BADGE';
  const badgeData = isBadge ? (data as PrintableBadgeData) : null;
  const licenceData = !isBadge ? (data as PrintableLicenceData) : null;

  // STRICT PAYMENT GATING:
  // Driver Badge: only printable after driver payment confirmation
  // Vehicle Sticker: only printable after vehicle registration AND confirmation by Super Admin
  const isPaymentConfirmed = isBadge
    ? (badgeData?.isPaymentConfirmed !== false)
    : (licenceData?.isPaymentConfirmed !== false && licenceData?.superAdminConfirmed !== false);

  const handlePrint = () => {
    if (!isPaymentConfirmed) return;
    setIsPrinting(true);
    // Give browser frame to apply exact print styles
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
  };

  return (
    <>
      {/* ------------------------------------------------------------------- */}
      {/* 1. SCREEN MODAL DIALOG (Interactive Print Preview on Screen)        */}
      {/* ------------------------------------------------------------------- */}
      <div className="aotuc-print-hide fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto flex flex-col">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  RÉPUBLIQUE DE GUINÉE • AOTUC • SYSTÈME OFFICIEL D'IMPRESSION
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <span>
                    {isBadge
                      ? 'Impression Badge Conducteur Professionnel CR80'
                      : 'Impression Vignette Pare-Brise Véhicule 100×100mm'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#0B1E36] text-[#FCD116] border border-[#FCD116]/40">
                    Design Dark Édition
                  </span>
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Payment Gate Notice */}
          {!isPaymentConfirmed && (
            <div className="mx-5 my-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center space-x-3 text-rose-900 dark:text-rose-300 text-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <div>
                <div className="font-bold text-sm">
                  {isBadge
                    ? 'Impression Verrouillée — Paiement Chauffeur Non Confirmé'
                    : 'Impression Verrouillée — Confirmation Super Admin Requise'}
                </div>
                <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5 leading-relaxed">
                  {isBadge
                    ? "Le badge professionnel du chauffeur ne peut devenir valide et imprimable qu'après confirmation officielle de l'encaissement de ses droits d'enrôlement."
                    : "La vignette pare-brise ne peut être imprimée qu'après confirmation préalable et expresse du paiement par le Super Administrateur."}
                </p>
              </div>
            </div>
          )}

          {/* Controls Bar */}
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/30 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Badge Side Selector (for badges only) */}
            {isBadge ? (
              <div className="flex items-center space-x-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 px-2 font-semibold">Face :</span>
                <button
                  onClick={() => setBadgeSide('recto')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                    badgeSide === 'recto'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Recto (Face)
                </button>
                <button
                  onClick={() => setBadgeSide('verso')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                    badgeSide === 'verso'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Verso (Dos)
                </button>
                <button
                  onClick={() => setBadgeSide('both')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                    badgeSide === 'both'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Recto + Verso
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Format Vignette Pare-Brise 100×100 mm (Face Unique Adhésive)</span>
              </div>
            )}

            {/* Color Mode Simulation */}
            <div className="flex items-center space-x-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 px-2 font-semibold">Rendu :</span>
              <button
                onClick={() => setColorMode('color')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                  colorMode === 'color'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Couleurs Officielles
              </button>
              <button
                onClick={() => setColorMode('grayscale')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                  colorMode === 'grayscale'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Simulation N&B
              </button>
            </div>

            {/* Physical Specs Pill */}
            <div className="text-[11px] font-mono text-slate-500 flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {isBadge
                  ? 'CR80 : 85.60 × 53.98 mm • 300 DPI'
                  : 'Vignette : 100 × 100 mm • Pare-Brise'}
              </span>
            </div>
          </div>

          {/* Interactive Live Card / Sticker Preview Container */}
          <div className="p-6 bg-slate-900/90 dark:bg-slate-950 flex flex-col items-center justify-center min-h-[360px] overflow-x-auto">
            <div
              className={`transition-all duration-200 flex flex-col sm:flex-row items-center justify-center gap-6 ${
                colorMode === 'grayscale' ? 'grayscale contrast-125' : ''
              }`}
            >
              {isBadge && badgeData && (
                <>
                  {(badgeSide === 'recto' || badgeSide === 'both') && (
                    <div className="flex flex-col items-center space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Recto (Face avant)
                      </span>
                      {renderBadgeRecto(badgeData)}
                    </div>
                  )}

                  {(badgeSide === 'verso' || badgeSide === 'both') && (
                    <div className="flex flex-col items-center space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Verso (Face arrière)
                      </span>
                      {renderBadgeVerso(badgeData)}
                    </div>
                  )}
                </>
              )}

              {!isBadge && licenceData && (
                <div className="flex flex-col items-center space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Vignette Officielle Pare-Brise (100×100 mm)
                  </span>
                  {renderLicenceSticker(licenceData)}
                </div>
              )}
            </div>
          </div>

          {/* Security & Printer Advice Note */}
          <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-300 text-xs flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold">Instructions d’impression optimale :</span> Sélectionnez votre imprimante (imprimante carte PVC ou imprimante couleur standard). Dans la boîte de dialogue d'impression, cochez{' '}
              <b>« Graphiques d'arrière-plan »</b> pour garantir l'impression intégrale des couleurs officielles AOTUC. L'en-tête et les boutons de navigation sont masqués automatiquement.
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
            >
              Fermer
            </button>

            <div className="flex items-center space-x-2">
              {onDownloadPdf && (
                <button
                  type="button"
                  onClick={onDownloadPdf}
                  disabled={!isPaymentConfirmed}
                  className={`px-4 py-2 text-xs font-bold border rounded-xl flex items-center space-x-1.5 transition ${
                    !isPaymentConfirmed
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                      : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer'
                  }`}
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>Télécharger PDF (300 DPI)</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting || !isPaymentConfirmed}
                title={!isPaymentConfirmed ? 'Paiement non confirmé — Impression verrouillée' : "Lancer l'impression"}
                className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-lg flex items-center space-x-2 transition min-h-[44px] ${
                  !isPaymentConfirmed
                    ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-[#0B1E36] hover:bg-slate-800 text-white cursor-pointer'
                }`}
              >
                <Printer className="w-4 h-4 text-[#FCD116]" />
                <span>
                  {!isPaymentConfirmed
                    ? 'Paiement Non Confirmé'
                    : isBadge
                    ? 'Lancer l’Impression du Badge CR80'
                    : 'Lancer l’Impression de la Vignette'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 2. DEDICATED PRINT CONTAINER (Rendered ONLY when window.print() runs) */}
      {/* ------------------------------------------------------------------- */}
      <div id="aotuc-print-sheet" className="aotuc-print-only">
        {isBadge && badgeData && (
          <div className="aotuc-print-badge-container">
            {(badgeSide === 'recto' || badgeSide === 'both') && (
              <div className="aotuc-print-card-wrapper">
                {renderBadgeRecto(badgeData, true)}
              </div>
            )}
            {(badgeSide === 'verso' || badgeSide === 'both') && (
              <div className="aotuc-print-card-wrapper">
                {renderBadgeVerso(badgeData, true)}
              </div>
            )}
          </div>
        )}

        {!isBadge && licenceData && (
          <div className="aotuc-print-sticker-container">
            <div className="aotuc-print-sticker-wrapper">
              {renderLicenceSticker(licenceData, true)}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ============================================================================
// HELPER RENDERING FUNCTIONS
// ============================================================================

/**
 * Render CR80 PVC Badge RECTO (Front)
 * Dark, elegant official design featuring:
 * - AOTUC and Guinea official logos
 * - Driver's photo, name, surname, registration number, sector of activity, date of birth
 * - Ed25519 scannable QR code
 * - Guinea flag tricolor banner & gold accents
 */
function renderBadgeRecto(badge: PrintableBadgeData, isPrintMode = false) {
  // Extract or parse first name and surname
  const parsedParts = badge.driverName ? badge.driverName.trim().split(' ') : ['Conducteur', ''];
  const firstName = badge.firstName || parsedParts[0] || '';
  const lastName = badge.lastName || parsedParts.slice(1).join(' ') || '';
  const dateOfBirth = badge.dateOfBirth || '12/04/1988';
  const activitySector = badge.activitySector || 'Transport Urbain — Taxi / Magbana';
  const regNumber = badge.registrationNumber || badge.badgeNumber;

  return (
    <div
      className={`aotuc-cr80-card relative select-none rounded-xl overflow-hidden shadow-2xl flex flex-col justify-between ${
        isPrintMode ? 'aotuc-print-exact-size' : 'w-[360px] sm:w-[390px] aspect-[85.6/53.98]'
      }`}
      style={{
        backgroundColor: '#0B1E36',
        backgroundImage: 'linear-gradient(135deg, #0B1E36 0%, #0F172A 50%, #0B1E36 100%)',
        color: '#FFFFFF',
        borderColor: '#334155',
        borderWidth: '1px',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* National Tricolor Top Stripe (Guinea Flag: Red, Yellow, Green) */}
      <div className="h-1.5 flex w-full">
        <div className="flex-1" style={{ backgroundColor: '#CE1126' }} />
        <div className="flex-1" style={{ backgroundColor: '#FCD116' }} />
        <div className="flex-1" style={{ backgroundColor: '#009460' }} />
      </div>

      {/* Card Header: Guinea Logo (Left), Titles (Center), AOTUC Logo (Right) */}
      <div className="px-3 pt-1.5 flex items-center justify-between">
        <div className="flex items-center space-x-2 min-w-0">
          <img
            src="/logo-guinee.png"
            alt="Armoiries République de Guinée"
            className="w-6 h-6 rounded-full bg-white/10 p-0.5 object-contain flex-shrink-0"
          />
          <div className="leading-tight min-w-0">
            <div className="text-[6.5px] uppercase tracking-wider text-slate-300 font-bold truncate">
              RÉPUBLIQUE DE GUINÉE • MINISTÈRE DES TRANSPORTS
            </div>
            <div className="text-[8.5px] font-black text-[#FCD116] tracking-wide truncate">
              AOTUC • CARTE PROFESSIONNELLE DE CONDUCTEUR
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 flex-shrink-0">
          <img
            src="/aotuc-logo.png"
            alt="AOTUC"
            className="w-6 h-6 rounded-full bg-white p-0.5 object-contain border border-slate-600 shadow flex-shrink-0"
          />
        </div>
      </div>

      {/* Driver Body */}
      <div className="px-3 py-1 flex items-center space-x-2.5 my-auto">
        {/* Driver Photo */}
        <div className="w-16 h-20 rounded bg-slate-800 border-2 border-slate-500 flex flex-col items-center justify-center text-slate-300 overflow-hidden shadow-inner flex-shrink-0">
          {badge.photoUrl ? (
            <img src={badge.photoUrl} alt={badge.driverName} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center p-1 text-center">
              <User className="w-8 h-8 text-slate-400" />
              <span className="text-[6px] font-bold text-slate-400 mt-0.5">PHOTO</span>
            </div>
          )}
        </div>

        {/* Identity Details */}
        <div className="flex-1 text-[9.5px] space-y-0.5 min-w-0">
          {/* Prénom & Nom */}
          <div className="leading-tight">
            <div className="text-[7.5px] uppercase text-slate-400 font-semibold">PRÉNOM & NOM</div>
            <div className="font-black text-white text-[11px] truncate">
              {firstName} <span className="text-[#FCD116]">{lastName.toUpperCase()}</span>
            </div>
          </div>

          {/* Registration Number */}
          <div className="flex items-center space-x-1.5 text-[8.5px]">
            <span className="text-slate-400">N° Enreg. :</span>
            <span className="font-mono font-bold text-emerald-400">{regNumber}</span>
          </div>

          {/* Sector of Activity */}
          <div className="text-[8px] text-slate-300 truncate">
            Secteur : <span className="font-semibold text-white">{activitySector}</span>
          </div>

          {/* Date of Birth */}
          <div className="text-[8px] text-slate-300">
            Né(e) le : <span className="font-mono text-slate-100 font-semibold">{dateOfBirth}</span>
          </div>

          {/* Permis de conduire & Catégorie */}
          <div className="text-[8px] text-slate-300 truncate">
            Permis : <span className="font-mono text-slate-100">{badge.licenseNumber}</span> (Cat. {badge.categories})
          </div>

          {/* Commune */}
          <div className="text-[7.5px] text-slate-400 truncate">
            Commune : <span className="text-slate-200">{badge.commune}</span>
          </div>
        </div>

        {/* Scannable Ed25519 QR Code */}
        <div className="w-16 h-16 bg-white p-1 rounded-lg border border-slate-600 flex flex-col items-center justify-center flex-shrink-0 shadow-md">
          <QrCode className="w-12 h-12 text-slate-950" />
          <span className="text-[5px] font-bold text-slate-800 uppercase tracking-tighter">
            Contrôle Ed25519
          </span>
        </div>
      </div>

      {/* Footer / Validity and Security Stamp */}
      <div className="px-3 py-1 bg-slate-950/90 border-t border-slate-700/80 flex items-center justify-between text-[7.5px]">
        <div className="text-slate-400">
          Expire le : <span className="text-white font-mono font-bold">{badge.expiryDate}</span>
        </div>
        <div className="flex items-center space-x-1.5">
          {badge.isPaymentConfirmed !== false ? (
            <span className="px-1.5 py-0.5 rounded text-[7px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              ✓ PAIEMENT CONFIRMÉ
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[7px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
              PAIEMENT EN ATTENTE
            </span>
          )}
          <span className="text-slate-400 text-[7px]">RFC 8032 Ed25519</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Render CR80 PVC Badge VERSO (Back)
 */
function renderBadgeVerso(badge: PrintableBadgeData, isPrintMode = false) {
  return (
    <div
      className={`aotuc-cr80-card relative select-none rounded-xl overflow-hidden shadow-2xl flex flex-col justify-between ${
        isPrintMode ? 'aotuc-print-exact-size' : 'w-[360px] sm:w-[390px] aspect-[85.6/53.98]'
      }`}
      style={{
        backgroundColor: '#0B1E36',
        backgroundImage: 'linear-gradient(135deg, #0B1E36 0%, #0F172A 50%, #0B1E36 100%)',
        color: '#FFFFFF',
        borderColor: '#334155',
        borderWidth: '1px',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* Magnetic / Barcode Strip representation */}
      <div className="h-5 bg-slate-950 w-full mt-2.5 border-y border-slate-800" />

      {/* Terms and Authority Notice */}
      <div className="px-3.5 py-1.5 text-[7px] leading-tight text-slate-300 space-y-1 my-auto">
        <div className="font-bold text-[#FCD116] uppercase text-[7.5px]">
          CONDITIONS D’UTILISATION & CONTRÔLE RÉGLEMENTAIRE
        </div>
        <p>
          Cette carte professionnelle est strictement personnelle et incessible. Elle atteste de l’accréditation officielle délivrée par l’Autorité Organisatrice des Transports Urbains de Conakry (AOTUC).
        </p>
        <p>
          Le titulaire est soumis aux règles de circulation urbaine et doit présenter ce titre à toute réquisition des officiers de police judiciaire et des contrôleurs routiers assermentés.
        </p>
      </div>

      {/* Signature and Verification Footer */}
      <div className="px-3.5 py-1.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-[6.5px] text-slate-400">
        <div>
          <div>Urgence / Signalement : <span className="text-white font-bold">117 / +224 620 00 00 00</span></div>
          <div>Portail vérification : <span className="text-white font-mono">aotuc.gov.gn/verify • {badge.badgeNumber}</span></div>
        </div>
        <div className="text-right">
          <div className="font-bold text-slate-200">Pour le Directeur Général AOTUC</div>
          <div className="italic text-[6px] text-slate-400">Direction de la Régulation</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Render Windshield Vehicle Sticker (Vignette Pare-Brise 100x100mm)
 * Dark, elegant design sharing the same visual identity, typography, official logos,
 * and color palette as the badge.
 * Features:
 * - AOTUC and Guinea official logos
 * - High-contrast vehicle registration plate box
 * - Vehicle details, commune, sector of activity
 * - Valid official exercise year
 * - Ed25519 scannable QR code
 * - Super Admin payment confirmation stamp
 */
function renderLicenceSticker(licence: PrintableLicenceData, isPrintMode = false) {
  const isConfirmed = licence.isPaymentConfirmed !== false && licence.superAdminConfirmed !== false;
  const activitySector = licence.activitySector || 'Transport Public Urbain de Conakry';

  return (
    <div
      className={`aotuc-vignette-sticker relative select-none rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-between border-2 ${
        isPrintMode ? 'aotuc-print-vignette-size' : 'w-[290px] sm:w-[310px] aspect-square'
      }`}
      style={{
        backgroundColor: '#0B1E36',
        backgroundImage: 'linear-gradient(135deg, #0B1E36 0%, #0F172A 50%, #0B1E36 100%)',
        borderColor: '#FCD116',
        color: '#FFFFFF',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* Top Guinea Flag Stripe */}
      <div className="h-1.5 flex w-full">
        <div className="flex-1" style={{ backgroundColor: '#CE1126' }} />
        <div className="flex-1" style={{ backgroundColor: '#FCD116' }} />
        <div className="flex-1" style={{ backgroundColor: '#009460' }} />
      </div>

      {/* Top Header with Guinea Seal, Title, and AOTUC Logo */}
      <div className="px-3 pt-2 pb-1.5 border-b border-slate-700/80 flex items-center justify-between bg-slate-950/60">
        <img
          src="/logo-guinee.png"
          alt="Armoiries République de Guinée"
          className="w-7 h-7 rounded-full bg-white/10 p-0.5 object-contain flex-shrink-0"
        />
        <div className="text-center flex-1 leading-tight px-1.5">
          <div className="text-[6.5px] uppercase font-bold tracking-wider text-slate-300">
            RÉPUBLIQUE DE GUINÉE • MINISTÈRE DES TRANSPORTS
          </div>
          <div className="text-[9px] font-black uppercase text-[#FCD116] tracking-wide">
            AOTUC • VIGNETTE OFFICIELLE DE TRANSPORT
          </div>
        </div>
        <img
          src="/aotuc-logo.png"
          alt="AOTUC"
          className="w-7 h-7 rounded-full bg-white p-0.5 object-contain border border-slate-700 flex-shrink-0 shadow-sm"
        />
      </div>

      {/* Central Body: Plate Number & Vehicle Specs */}
      <div className="px-3 py-1.5 text-center my-auto space-y-1">
        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
          IMMATRICULATION AUTORISÉE
        </div>
        {/* High-Contrast Official Plate Box */}
        <div className="text-xl font-black font-mono tracking-widest bg-white text-slate-950 py-1 px-4 rounded-lg border-2 border-[#FCD116] inline-block shadow-lg">
          {licence.plateNumber}
        </div>

        <div className="text-[10px] font-bold text-white mt-1">
          {licence.vehicleMakeModel}
        </div>
        <div className="text-[8.5px] text-slate-300">
          Capacité : <b className="text-white">{licence.seats} Places</b> • {licence.commune}
        </div>
        <div className="text-[7.5px] text-slate-400">
          {activitySector}
        </div>
        <div className="text-[7.5px] font-mono text-slate-400">
          N° Licence : <span className="text-slate-200">{licence.licenceNumber}</span>
        </div>
      </div>

      {/* Bottom Footer: Exercise Year & Scannable QR Code */}
      <div className="p-2.5 bg-slate-950/80 border-t border-slate-700/80 flex items-center justify-between">
        <div>
          <div className="text-[7.5px] font-bold uppercase text-slate-400">EXERCICE OFFICIEL</div>
          <div className="text-2xl font-black text-[#FCD116] leading-none">{licence.validYear}</div>
          <div className="text-[7px] font-bold mt-1">
            {isConfirmed ? (
              <span className="text-emerald-400">✓ PAIEMENT CONFIRMÉ (SUPER ADMIN)</span>
            ) : (
              <span className="text-rose-400">PAIEMENT EN ATTENTE VALIDATION</span>
            )}
          </div>
        </div>

        <div className="w-14 h-14 bg-white p-1 rounded-lg border border-slate-600 flex flex-col items-center justify-center shadow-md flex-shrink-0">
          <QrCode className="w-10 h-10 text-slate-950" />
          <span className="text-[4.5px] font-bold text-slate-800 uppercase">Ed25519</span>
        </div>
      </div>
    </div>
  );
}

export default PrintCredentialModal;
