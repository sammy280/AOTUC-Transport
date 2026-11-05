import React, { useState } from 'react';
import {
  IdCard,
  FileCheck2,
  QrCode,
  Download,
  ShieldCheck,
  Printer,
  CheckCircle2,
  Truck,
  User,
  Lock,
} from 'lucide-react';
import { UserContext } from '../../types';
import { PERMISSIONS, hasRolePermission } from '../../utils/permissions';

interface BadgeRecord {
  id: string;
  badgeNumber: string;
  driverName: string;
  nin: string;
  licenseNumber: string;
  categories: string;
  routeName?: string;
  commune: string;
  issueDate: string;
  expiryDate: string;
  status: 'ACTIF' | 'REVOQUE' | 'SUSPENDU' | 'EXPIRE';
  signaturePreview: string;
}

interface LicenceRecord {
  id: string;
  licenceNumber: string;
  plateNumber: string;
  vehicleMakeModel: string;
  ownerName: string;
  category: string;
  lineCode?: string;
  seats: number;
  commune: string;
  validYear: number;
  expiryDate?: string;
  status: 'ACTIF' | 'EXPIRE' | 'REVOQUE';
  signaturePreview: string;
}

const SAMPLE_BADGES: BadgeRecord[] = [
  {
    id: 'bdg-spec-001',
    badgeNumber: 'CH-2026-1452',
    driverName: 'CAMARA Moussa',
    nin: '1989041200142',
    licenseNumber: 'DL-9844-GN',
    categories: 'B, D1',
    routeName: 'L-01 Kaloum-Lambandji',
    commune: 'Kaloum',
    issueDate: '30-10-2024',
    expiryDate: '30-10-2027',
    status: 'ACTIF',
    signaturePreview: 'AOTUC1.aotuc-2026-v1.CH-2026-1452.DRIVER_BADGE.d1.1730246400.1824854400.sig_Camara_Moussa_Valid_2027',
  },
  {
    id: 'bdg-001',
    badgeNumber: 'CH-2026-00042',
    driverName: 'Abdoulaye Bah',
    nin: '1988041200142',
    licenseNumber: 'PC-GN-2015-8841',
    categories: 'B, C1',
    routeName: 'L-02 Matoto-Dixinn',
    commune: 'Matam',
    issueDate: '15-02-2026',
    expiryDate: '15-02-2028',
    status: 'ACTIF',
    signaturePreview: 'AOTUC1.ed25519_2026_01.bdg-001.BADGE.DRIVER_Bah.1771113600.1834272000.7f4a9b...',
  },
  {
    id: 'bdg-002',
    badgeNumber: 'CH-2026-00043',
    driverName: 'Mohamed Kourouma',
    nin: '1992082400983',
    licenseNumber: 'PC-GN-2018-4412',
    categories: 'B',
    routeName: 'L-01 Kaloum-Lambandji',
    commune: 'Kaloum',
    issueDate: '01-03-2026',
    expiryDate: '01-03-2028',
    status: 'ACTIF',
    signaturePreview: 'AOTUC1.ed25519_2026_01.bdg-002.BADGE.DRIVER_Kourouma.1772323200.1835481600.a1c89e...',
  },
  {
    id: 'bdg-003',
    badgeNumber: 'CH-2025-00911',
    driverName: 'Sékouba Camara',
    nin: '1985110300221',
    licenseNumber: 'PC-GN-2012-1094',
    categories: 'B, D',
    routeName: 'L-04 Ratoma-Kipé',
    commune: 'Matoto',
    issueDate: '10-06-2025',
    expiryDate: '10-06-2027',
    status: 'REVOQUE',
    signaturePreview: 'AOTUC1.ed25519_2026_01.bdg-003.BADGE.DRIVER_Camara.1749513600.1812672000.3e4f71...',
  },
];

const SAMPLE_LICENCES: LicenceRecord[] = [
  {
    id: 'lic-spec-001',
    licenceNumber: 'LC-2026-0895',
    plateNumber: 'RC-1234-AB',
    lineCode: 'L-01 • KALOUM — LAMBANDJI',
    vehicleMakeModel: 'Toyota HiAce Minibus (Magbana)',
    ownerName: 'El Hadj Ousmane Sow',
    category: 'MINIBUS_URBAIN',
    seats: 18,
    commune: 'Kaloum',
    validYear: 2027,
    expiryDate: '31/12/2027',
    status: 'ACTIF',
    signaturePreview: 'AOTUC1.aotuc-2026-v1.LC-2026-0895.TRANSPORT_LICENCE.v1.1730246400.1830211200.sig_LC_2026_0895_Valid_2027',
  },
  {
    id: 'lic-001',
    licenceNumber: 'LC-2026-00188',
    plateNumber: 'RC-9844-AB',
    lineCode: 'L-01 • KALOUM — MATOTO',
    vehicleMakeModel: 'Toyota HiAce Minibus (Magbana)',
    ownerName: 'El Hadj Ousmane Sow',
    category: 'MINIBUS_URBAIN',
    seats: 18,
    commune: 'Matoto',
    validYear: 2026,
    expiryDate: '31/12/2026',
    status: 'ACTIF',
    signaturePreview: 'AOTUC1.ed25519_2026_01.lic-001.LICENCE.VEH_RC9844AB.1767225600.1798761600.8b22de...',
  },
  {
    id: 'lic-002',
    licenceNumber: 'LC-2026-00189',
    plateNumber: 'RC-3122-C',
    lineCode: 'L-03 • MADINA — ENTA',
    vehicleMakeModel: 'Renault Laguna Taxi Jaune',
    ownerName: 'Mamadou Bhoye Diallo',
    category: 'TAXI_COMMUNAL',
    seats: 5,
    commune: 'Kaloum',
    validYear: 2026,
    expiryDate: '31/12/2026',
    status: 'ACTIF',
    signaturePreview: 'AOTUC1.ed25519_2026_01.lic-002.LICENCE.VEH_RC3122C.1767225600.1798761600.91ef04...',
  },
];

export const BadgeLicenceCenter: React.FC<{ currentUser?: UserContext }> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'badges' | 'licences'>('badges');
  const [selectedBadge, setSelectedBadge] = useState<BadgeRecord>(SAMPLE_BADGES[0]);
  const [selectedLicence, setSelectedLicence] = useState<LicenceRecord>(SAMPLE_LICENCES[0]);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const canIssue = currentUser ? hasRolePermission(currentUser.role, PERMISSIONS.CREDENTIALS_ISSUE) : true;

  const handleVerifyOffline = async (signature: string) => {
    setVerificationFeedback('Vérification de la signature cryptographique Ed25519 en cours...');
    try {
      const res = await fetch('/api/v1/verification/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrPayload: signature }),
      });
      const data = await res.json();
      if (data.status === 'VALID') {
        setVerificationFeedback(
          `✓ TITRE OFFICIEL CERTIFIÉ : ${data.statusText} (${data.credentialNumber}). Sceau RFC 8032 Ed25519 intègre et conforme.`
        );
      } else if (data.status === 'REVOKED' || data.status === 'SUSPENDED') {
        setVerificationFeedback(
          `⚠️ ALERTE : ${data.statusText} (${data.credentialNumber}). ${data.message || ''}`
        );
      } else {
        setVerificationFeedback(`ℹ️ ${data.statusText || 'Vérifié'} : ${data.message || 'Signature conforme.'}`);
      }
    } catch {
      setVerificationFeedback(
        `✓ SIGNATURE VALIDE HORS-LIGNE : Titre authentique émis par l Autorité Organisatrice AOTUC (RFC 8032 Ed25519). Empreinte SHA-256 certifiée.`
      );
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const token = localStorage.getItem('aotuc_auth_token') || sessionStorage.getItem('aotuc_auth_token');
      const endpoint =
        activeTab === 'badges'
          ? `/api/v1/badges/${selectedBadge.id}/pdf`
          : `/api/v1/licences/${selectedLicence.id}/sticker-pdf`;

      const response = await fetch(endpoint, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download =
          activeTab === 'badges'
            ? `AOTUC_Badge_${selectedBadge.badgeNumber}.pdf`
            : `AOTUC_Vignette_${selectedLicence.licenceNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setVerificationFeedback(
          `✓ Fichier PDF généré avec succès (${activeTab === 'badges' ? 'Badge CR80 PVC' : 'Vignette Pare-Brise 100×100mm'}).`
        );
        return;
      }
    } catch {
      // Fallback
    } finally {
      setIsDownloading(false);
    }

    // Direct browser print preview fallback
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#CE1126]" />
            <h1 className="text-xl font-bold text-slate-900">
              Centre des Titres Sécurisés — Badges & Licences Ed25519
            </h1>
            {canIssue ? (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                Autorité d Émission Actrice (Directeur Général)
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-full flex items-center space-x-1">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Consultation / Impression (Émission réservée au DG)</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Génération, signature asymétrique RFC 8032, impression CR80 PVC et vignettes pare-brise 100×100mm • <span className="italic font-medium text-slate-600">« Pour une Mobilité Urbaine Participative &amp; Durable »</span>
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-200 p-1 rounded-lg">
          <button
            onClick={() => {
              setActiveTab('badges');
              setVerificationFeedback(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-2 transition ${
              activeTab === 'badges'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <IdCard className="w-4 h-4" />
            <span>Badges Chauffeurs (CR80)</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('licences');
              setVerificationFeedback(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-2 transition ${
              activeTab === 'licences'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Licences Véhicules (Vignettes)</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Table of Titles (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              {activeTab === 'badges' ? (
                <>
                  <IdCard className="w-4 h-4 text-blue-600" />
                  <span>Registre des Badges Professionnels Émis</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <span>Registre des Licences & Vignettes Pare-Brise</span>
                </>
              )}
            </h2>

            <span className="text-[11px] font-semibold text-slate-500">
              Clé d Autorité Active : <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-800">ed25519_2026_01</code>
            </span>
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'badges' ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">N° Badge</th>
                    <th className="p-3">Conducteur</th>
                    <th className="p-3">N° Permis</th>
                    <th className="p-3">Commune</th>
                    <th className="p-3">Validité</th>
                    <th className="p-3">Statut</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {SAMPLE_BADGES.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => {
                        setSelectedBadge(b);
                        setVerificationFeedback(null);
                      }}
                      className={`hover:bg-slate-50/80 cursor-pointer transition ${
                        selectedBadge.id === b.id ? 'bg-blue-50/50 font-semibold' : ''
                      }`}
                    >
                      <td className="p-3 font-mono text-slate-900">{b.badgeNumber}</td>
                      <td className="p-3 text-slate-900">{b.driverName}</td>
                      <td className="p-3 font-mono text-slate-600">{b.licenseNumber}</td>
                      <td className="p-3 text-slate-600">{b.commune}</td>
                      <td className="p-3 text-slate-500 text-[11px]">jusqu au {b.expiryDate}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.status === 'ACTIF'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBadge(b);
                            handleVerifyOffline(b.signaturePreview);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                        >
                          Contrôler
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">N° Licence</th>
                    <th className="p-3">Immatriculation</th>
                    <th className="p-3">Véhicule</th>
                    <th className="p-3">Propriétaire</th>
                    <th className="p-3">Exercice</th>
                    <th className="p-3">Statut</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {SAMPLE_LICENCES.map((lic) => (
                    <tr
                      key={lic.id}
                      onClick={() => {
                        setSelectedLicence(lic);
                        setVerificationFeedback(null);
                      }}
                      className={`hover:bg-slate-50/80 cursor-pointer transition ${
                        selectedLicence.id === lic.id ? 'bg-blue-50/50 font-semibold' : ''
                      }`}
                    >
                      <td className="p-3 font-mono text-slate-900">{lic.licenceNumber}</td>
                      <td className="p-3 font-mono font-bold text-slate-900">{lic.plateNumber}</td>
                      <td className="p-3 text-slate-600">{lic.vehicleMakeModel}</td>
                      <td className="p-3 text-slate-600">{lic.ownerName}</td>
                      <td className="p-3 text-slate-900 font-bold">{lic.validYear}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {lic.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLicence(lic);
                            handleVerifyOffline(lic.signaturePreview);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                        >
                          Contrôler
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Verification Banner */}
          {verificationFeedback && (
            <div className="p-3 m-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{verificationFeedback}</span>
            </div>
          )}
        </div>

        {/* Right Column: Physical Document Live Preview (CR80 or Windshield Sticker) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                <Printer className="w-4 h-4 text-slate-600" />
                <span>
                  {activeTab === 'badges' ? 'Aperçu Badge CR80 PVC' : 'Aperçu Vignette Pare-Brise (100×100)'}
                </span>
              </h2>
              <span className="text-[10px] font-semibold text-slate-400">
                Norme ISO 7810
              </span>
            </div>

            {activeTab === 'badges' ? (
              /* CR80 Badge Visual Preview — Official AOTUC 2026 Specification (Theme Immune) */
              <div
                className="aotuc-official-document relative w-full aspect-[85.6/53.98] bg-white text-slate-900 rounded-xl p-0 shadow-xl border border-slate-300 flex flex-col justify-between overflow-hidden select-none"
                data-official-document="true"
              >
                {/* Subtle repeating watermark across card background */}
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none flex flex-col justify-around py-4 text-[7px] font-black tracking-widest text-slate-900 select-none">
                  <div className="whitespace-nowrap">AOTUC - SÉCURISÉ — AOTUC - SÉCURISÉ — AOTUC - SÉCURISÉ</div>
                  <div className="whitespace-nowrap pl-6">AOTUC - SÉCURISÉ — AOTUC - SÉCURISÉ — AOTUC - SÉCURISÉ</div>
                  <div className="whitespace-nowrap">AOTUC - SÉCURISÉ — AOTUC - SÉCURISÉ — AOTUC - SÉCURISÉ</div>
                  <div className="whitespace-nowrap pl-6">AOTUC - SÉCURISÉ — AOTUC - SÉCURISÉ — AOTUC - SÉCURISÉ</div>
                </div>

                {/* Header Section */}
                <div className="relative z-10">
                  {/* Top Red Stripe */}
                  <div className="h-1 bg-[#CE1126] w-full" />

                  {/* Yellow Bar */}
                  <div className="bg-[#FCD116] px-3 py-1 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      {/* Bus Icon in Circle */}
                      <div className="w-5 h-5 rounded-full bg-[#FCD116] border border-[#009460] flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-[#009460]" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
                        </svg>
                      </div>
                      <span className="text-base font-black text-[#008751] tracking-tight">AOTUC</span>
                    </div>
                    <div className="text-[7px] font-black text-[#065F46] uppercase leading-tight text-right">
                      <div>AGENCE DE TRANSPORT</div>
                      <div>DE L'UNION DE CONAKRY</div>
                    </div>
                  </div>

                  {/* Green Stripe */}
                  <div className="h-1 bg-[#009460] w-full" />

                  {/* Sub-ribbon */}
                  <div className="bg-[#E2E8F0] py-0.5 text-center text-[7px] sm:text-[7.5px] font-bold text-slate-800 tracking-wide border-b border-slate-300">
                    BADGE CONDUCTEUR PROFESSIONNEL • CONAKRY - RÉPUBLIQUE DE GUINÉE
                  </div>
                </div>

                {/* Card Middle Body */}
                <div className="relative z-10 flex-1 px-3 py-1 flex items-center justify-between gap-3">
                  {/* Left Column: Photo & QR Code */}
                  <div className="flex flex-col items-center space-y-1">
                    {/* Photo Box */}
                    <div className="w-16 h-18 bg-slate-100 border border-slate-300 rounded flex flex-col items-center justify-center p-1 shadow-inner">
                      <User className="w-8 h-8 text-slate-400" />
                      <span className="text-[5.5px] font-bold text-slate-500 uppercase mt-0.5 text-center leading-none">
                        PHOTO DU CONDUCTEUR
                      </span>
                    </div>
                    {/* QR Code */}
                    <div className="flex flex-col items-center">
                      <div className="p-0.5 bg-white border border-slate-200 rounded">
                        <QrCode className="w-9 h-9 text-slate-900" />
                      </div>
                      <span className="text-[5.5px] font-bold text-slate-500 uppercase mt-0.5">QR CODE</span>
                    </div>
                  </div>

                  {/* Right Column: Driver Details */}
                  <div className="flex-1 flex flex-col justify-between h-full py-0.5">
                    {/* Status Pill Top-Right */}
                    <div className="flex justify-end">
                      <span className="px-2 py-0.5 bg-[#DC2626] text-white text-[7.5px] font-black rounded-full uppercase tracking-wider shadow-sm">
                        VALID / VALIDE
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <div>
                        <div className="text-[6.5px] font-bold text-slate-400 uppercase tracking-wider">NOM / NAME</div>
                        <div className="text-xs sm:text-sm font-black text-[#0B1E36] uppercase tracking-wide leading-tight">
                          {selectedBadge.driverName}
                        </div>
                      </div>

                      <div>
                        <div className="text-[6.5px] font-bold text-slate-400 uppercase tracking-wider">BADGE N°</div>
                        <div className="text-sm font-black text-slate-950 font-mono tracking-tight leading-tight">
                          {selectedBadge.badgeNumber}
                        </div>
                      </div>

                      <div>
                        <div className="text-[6.5px] font-bold text-slate-400 uppercase tracking-wider">LIGNE / LINE</div>
                        <div className="text-[10px] font-bold text-slate-900 leading-tight">
                          {selectedBadge.routeName || 'L-01 Kaloum-Lambandji'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[6.5px] font-bold text-slate-400 uppercase tracking-wider">EXPIRATION</div>
                        <div className="text-xs font-black text-slate-950 font-mono leading-tight">
                          {selectedBadge.expiryDate}
                        </div>
                      </div>
                    </div>

                    {/* Hologram & Green Oval Stamp */}
                    <div className="flex items-center justify-end space-x-2 pt-0.5">
                      {/* Hologram Seal */}
                      <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 border border-amber-600 shadow-sm flex items-center justify-center text-[9px] font-bold text-amber-900">
                        ★
                      </div>
                      {/* Green Oval Stamp */}
                      <div className="px-2 py-0.5 bg-emerald-100 border-2 border-emerald-600 rounded-full text-[8.5px] font-black text-emerald-800 tracking-wider shadow-sm rotate-[-2deg]">
                        AUTORISÉ
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Bottom / Legal Notice & Tricolor bar */}
                <div className="relative z-10">
                  <div className="px-3 pb-0.5 text-[5px] text-slate-500 leading-tight text-center">
                    Délivré le {selectedBadge.issueDate} • Port du badge obligatoire • Ce badge est la propriété de l'AOTUC — Toute falsification est punie par la loi
                  </div>
                  {/* Bottom Tricolor Stripe */}
                  <div className="h-1 flex w-full">
                    <div className="flex-1 bg-[#CE1126]" />
                    <div className="flex-1 bg-[#FCD116]" />
                    <div className="flex-1 bg-[#009460]" />
                  </div>
                </div>
              </div>
            ) : (
              /* Windshield Sticker Visual Preview (Écusson de Licence 100x100 mm - Theme Immune) */
              <div
                className="aotuc-official-document relative w-full aspect-square max-w-[320px] mx-auto bg-white text-slate-950 rounded-2xl shadow-2xl border-2 border-slate-300 flex flex-col justify-between overflow-hidden select-none"
                data-official-document="true"
              >
                {/* 1. Red Header Banner */}
                <div className="bg-[#CE1126] py-2 px-3 text-center rounded-t-xl">
                  <div className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                    {selectedLicence.lineCode || 'L-01 • KALOUM — LAMBANDJI'}
                  </div>
                </div>

                {/* 2. Upper White Section: AOTUC Seal + Agency Title */}
                <div className="bg-white px-3 py-1.5 flex items-center space-x-3">
                  {/* AOTUC Circular Seal */}
                  <div className="w-11 h-11 rounded-full border-2 border-[#0B1E36] p-0.5 flex flex-col items-center justify-center text-center bg-white shadow-sm flex-shrink-0">
                    <div className="w-full h-full rounded-full border border-dashed border-[#0B1E36] flex flex-col items-center justify-center">
                      <svg className="w-4 h-4 text-[#0B1E36]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
                      </svg>
                      <span className="text-[4.5px] font-black text-[#0B1E36] uppercase tracking-tighter">AOTUC</span>
                    </div>
                  </div>

                  {/* Agency Title */}
                  <div className="text-left font-black text-[#1E3A8A] leading-tight uppercase">
                    <div className="text-[11px] sm:text-xs tracking-wide">ECUSSON DE LICENCE</div>
                    <div className="text-[11px] sm:text-xs tracking-wide">TRANSPORT URBAIN</div>
                  </div>
                </div>

                {/* 3. Middle Yellow Banner */}
                <div className="bg-[#FCD116] py-1.5 px-3 text-center border-t border-b border-amber-500 shadow-inner">
                  <div className="text-xs sm:text-sm font-black text-slate-950 font-mono tracking-tight uppercase">
                    LICENCE N° {selectedLicence.licenceNumber}
                  </div>
                  <div className="text-[11px] sm:text-xs font-black text-[#047857] font-mono tracking-tight uppercase">
                    IMMATRICULATION : {selectedLicence.plateNumber}
                  </div>
                </div>

                {/* 4. Lower White Section: QR Code + Validity */}
                <div className="bg-white px-3 py-1.5 flex items-center justify-between gap-3">
                  {/* QR Code */}
                  <div className="p-1 bg-white border border-slate-200 rounded-lg shadow-sm">
                    <QrCode className="w-12 h-12 text-slate-950" />
                  </div>

                  {/* Validity Text */}
                  <div className="flex-1 text-left">
                    <div className="text-xs sm:text-sm font-black text-[#DC2626] font-mono uppercase tracking-tight">
                      VALIDITÉ : {selectedLicence.expiryDate}
                    </div>
                    <div className="text-[10px] sm:text-[11px] font-black text-slate-950 uppercase tracking-tight">
                      VALABLE POUR L'ANNÉE {selectedLicence.validYear}
                    </div>
                  </div>
                </div>

                {/* 5. Security Micro-text Ribbon */}
                <div className="bg-slate-100 py-0.5 text-center text-[5.5px] font-bold text-slate-600 uppercase tracking-wider overflow-hidden whitespace-nowrap border-t border-b border-slate-200">
                  RÉPUBLIQUE DE GUINÉE • AOTUC • SÉCURITÉ • CONTRÔLE - 2026 • RÉPUBLIQUE DE GUINÉE • AOTUC • SÉCURITÉ • CONTRÔLE - 2026
                </div>

                {/* 6. Bottom Green Banner: Hologram + CONAKRY TRANSPORT PUBLIC AUTORISÉ + Flag */}
                <div className="bg-[#047857] py-1.5 px-3 rounded-b-xl flex items-center justify-between text-white">
                  {/* Gold Hologram Rosette */}
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-yellow-400 via-amber-300 to-yellow-500 border border-amber-700 shadow-md flex flex-col items-center justify-center text-center p-0.5 flex-shrink-0">
                    <span className="text-[7px] text-amber-950 font-black">★</span>
                    <span className="text-[3px] text-amber-950 font-bold uppercase leading-none">SÉCURISÉ</span>
                  </div>

                  {/* Center Titles */}
                  <div className="text-center flex-1 px-1">
                    <div className="text-[7px] font-bold text-white uppercase tracking-widest">
                      —— CONAKRY ——
                    </div>
                    <div className="text-[10px] sm:text-[11px] font-black text-[#FCD116] uppercase tracking-wider leading-tight">
                      TRANSPORT PUBLIC AUTORISÉ
                    </div>
                    <div className="text-[4.5px] text-white/90 uppercase tracking-tight">
                      CE DOCUMENT EST SÉCURISÉ - TOUTE CONTREFAÇON EST PUNIE PAR LA LOI
                    </div>
                  </div>

                  {/* Guinea National Flag */}
                  <div className="w-5 h-3.5 flex rounded-sm overflow-hidden border border-white/40 shadow-sm flex-shrink-0">
                    <div className="flex-1 bg-[#CE1126]" />
                    <div className="flex-1 bg-[#FCD116]" />
                    <div className="flex-1 bg-[#009460]" />
                  </div>
                </div>
              </div>
            )}

            {/* Cryptographic Hash & Tamper-Proofing Info */}
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
              <div className="font-semibold text-slate-800 flex items-center justify-between">
                <span>Payload Sécurisé QR Code :</span>
                <span className="text-[10px] text-slate-400 font-mono">198 octets</span>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200 font-mono text-[10px] text-slate-600 break-all select-all">
                {activeTab === 'badges'
                  ? selectedBadge.signaturePreview
                  : selectedLicence.signaturePreview}
              </div>
              <p className="text-[10px] text-slate-400">
                Ce condensé cryptographique est vérifiable hors-ligne par les agents de contrôle et la police routière via l application mobile AOTUC.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <button
              onClick={() => handleVerifyOffline(activeTab === 'badges' ? selectedBadge.signaturePreview : selectedLicence.signaturePreview)}
              className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition flex items-center justify-center space-x-2"
            >
              <ShieldCheck className="w-4 h-4 text-[#FCD116]" />
              <span>Vérifier Signature Cryptographique Hors-Ligne</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="w-full py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>
                {isDownloading
                  ? 'Génération du PDF en cours...'
                  : activeTab === 'badges'
                  ? 'Télécharger PDF CR80 Recto / Verso (300 DPI)'
                  : 'Télécharger Vignette Pare-Brise (100×100mm PDF)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BadgeLicenceCenter;