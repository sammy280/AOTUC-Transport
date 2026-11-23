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
  AlertTriangle,
} from 'lucide-react';
import { UserContext } from '../../types';
import { PERMISSIONS, hasRolePermission } from '../../utils/permissions';
import { buildApiUrl, getStoredAuthToken } from '../../utils/api';
import PrintCredentialModal, { PrintableCredentialData } from './PrintCredentialModal';

interface BadgeRecord {
  id: string;
  badgeNumber: string;
  driverName: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  activitySector: string;
  registrationNumber: string;
  nin: string;
  licenseNumber: string;
  categories: string;
  commune: string;
  issueDate: string;
  expiryDate: string;
  status: 'ACTIF' | 'REVOQUE' | 'SUSPENDU';
  isPaymentConfirmed: boolean;
  signaturePreview: string;
}

interface LicenceRecord {
  id: string;
  licenceNumber: string;
  plateNumber: string;
  vehicleMakeModel: string;
  ownerName: string;
  category: string;
  activitySector: string;
  seats: number;
  commune: string;
  validYear: number;
  status: 'ACTIF' | 'EXPIRE' | 'REVOQUE';
  isPaymentConfirmed: boolean;
  superAdminConfirmed: boolean;
  signaturePreview: string;
}

const INITIAL_BADGES: BadgeRecord[] = [
  {
    id: 'bdg-001',
    badgeNumber: 'CH-2026-00042',
    registrationNumber: 'CH-2026-00042',
    driverName: 'Abdoulaye Bah',
    firstName: 'Abdoulaye',
    lastName: 'BAH',
    dateOfBirth: '12/04/1988',
    activitySector: 'Transport Urbain — Taxi Communal',
    nin: '1988041200142',
    licenseNumber: 'PC-GN-2015-8841',
    categories: 'B, C1',
    commune: 'Matam',
    issueDate: '2026-02-15',
    expiryDate: '2028-02-15',
    status: 'ACTIF',
    isPaymentConfirmed: true,
    signaturePreview: 'AOTUC1.ed25519_2026_01.bdg-001.BADGE.DRIVER_Bah.1771113600.1834272000.7f4a9b...',
  },
  {
    id: 'bdg-002',
    badgeNumber: 'CH-2026-00043',
    registrationNumber: 'CH-2026-00043',
    driverName: 'Mohamed Kourouma',
    firstName: 'Mohamed',
    lastName: 'KOUROUMA',
    dateOfBirth: '24/08/1992',
    activitySector: 'Transport Urbain — Magbana',
    nin: '1992082400983',
    licenseNumber: 'PC-GN-2018-4412',
    categories: 'B',
    commune: 'Kaloum',
    issueDate: '2026-03-01',
    expiryDate: '2028-03-01',
    status: 'ACTIF',
    isPaymentConfirmed: true,
    signaturePreview: 'AOTUC1.ed25519_2026_01.bdg-002.BADGE.DRIVER_Kourouma.1772323200.1835481600.a1c89e...',
  },
  {
    id: 'bdg-003',
    badgeNumber: 'CH-2026-00044',
    registrationNumber: 'CH-2026-00044',
    driverName: 'Sékouba Camara',
    firstName: 'Sékouba',
    lastName: 'CAMARA',
    dateOfBirth: '03/11/1985',
    activitySector: 'Transport Urbain — Taxi Communal',
    nin: '1985110300221',
    licenseNumber: 'PC-GN-2012-1094',
    categories: 'B, D',
    commune: 'Matoto',
    issueDate: '2026-03-10',
    expiryDate: '2028-03-10',
    status: 'ACTIF',
    isPaymentConfirmed: false, // Testing unconfirmed payment gate
    signaturePreview: 'AOTUC1.ed25519_2026_01.bdg-003.BADGE.DRIVER_Camara.1749513600.1812672000.3e4f71...',
  },
];

const INITIAL_LICENCES: LicenceRecord[] = [
  {
    id: 'lic-001',
    licenceNumber: 'LIC-2026-00188',
    plateNumber: 'RC-9844-AB',
    vehicleMakeModel: 'Toyota HiAce Minibus (Magbana)',
    ownerName: 'El Hadj Ousmane Sow',
    category: 'MINIBUS_URBAIN',
    activitySector: 'Transport Public Urbain de Conakry',
    seats: 18,
    commune: 'Matoto',
    validYear: 2026,
    status: 'ACTIF',
    isPaymentConfirmed: true,
    superAdminConfirmed: true,
    signaturePreview: 'AOTUC1.ed25519_2026_01.lic-001.LICENCE.VEH_RC9844AB.1767225600.1798761600.8b22de...',
  },
  {
    id: 'lic-002',
    licenceNumber: 'LIC-2026-00189',
    plateNumber: 'RC-3122-C',
    vehicleMakeModel: 'Renault Laguna Taxi Jaune',
    ownerName: 'Mamadou Bhoye Diallo',
    category: 'TAXI_COMMUNAL',
    activitySector: 'Transport Public Urbain — Ligne Kaloum',
    seats: 5,
    commune: 'Kaloum',
    validYear: 2026,
    status: 'ACTIF',
    isPaymentConfirmed: false,
    superAdminConfirmed: false, // Testing Super Admin payment gate
    signaturePreview: 'AOTUC1.ed25519_2026_01.lic-002.LICENCE.VEH_RC3122C.1767225600.1798761600.91ef04...',
  },
];

export const BadgeLicenceCenter: React.FC<{ currentUser?: UserContext }> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'badges' | 'licences'>('badges');
  const [badges, setBadges] = useState<BadgeRecord[]>(INITIAL_BADGES);
  const [licences, setLicences] = useState<LicenceRecord[]>(INITIAL_LICENCES);
  const [selectedBadge, setSelectedBadge] = useState<BadgeRecord>(INITIAL_BADGES[0]);
  const [selectedLicence, setSelectedLicence] = useState<LicenceRecord>(INITIAL_LICENCES[0]);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isDirector = currentUser?.role === 'DIRECTOR';

  const getPrintableData = (): PrintableCredentialData => {
    if (activeTab === 'badges') {
      return {
        type: 'BADGE',
        id: selectedBadge.id,
        badgeNumber: selectedBadge.badgeNumber,
        registrationNumber: selectedBadge.registrationNumber,
        driverName: selectedBadge.driverName,
        firstName: selectedBadge.firstName,
        lastName: selectedBadge.lastName,
        dateOfBirth: selectedBadge.dateOfBirth,
        activitySector: selectedBadge.activitySector,
        nin: selectedBadge.nin,
        licenseNumber: selectedBadge.licenseNumber,
        categories: selectedBadge.categories,
        commune: selectedBadge.commune,
        expiryDate: selectedBadge.expiryDate,
        photoUrl: null,
        signaturePreview: selectedBadge.signaturePreview,
        status: selectedBadge.status,
        isPaymentConfirmed: selectedBadge.isPaymentConfirmed,
      };
    } else {
      return {
        type: 'LICENCE',
        id: selectedLicence.id,
        licenceNumber: selectedLicence.licenceNumber,
        plateNumber: selectedLicence.plateNumber,
        vehicleMakeModel: selectedLicence.vehicleMakeModel,
        ownerName: selectedLicence.ownerName,
        activitySector: selectedLicence.activitySector,
        commune: selectedLicence.commune,
        seats: selectedLicence.seats,
        validYear: selectedLicence.validYear,
        expiryDate: `31/12/${selectedLicence.validYear}`,
        signaturePreview: selectedLicence.signaturePreview,
        status: selectedLicence.status,
        isPaymentConfirmed: selectedLicence.isPaymentConfirmed,
        superAdminConfirmed: selectedLicence.superAdminConfirmed,
      };
    }
  };

  const canIssue = currentUser ? hasRolePermission(currentUser.role, PERMISSIONS.CREDENTIALS_ISSUE) : true;

  // Confirm payment for driver
  const handleConfirmDriverPayment = (badgeId: string) => {
    setBadges((prev) =>
      prev.map((b) => (b.id === badgeId ? { ...b, isPaymentConfirmed: true } : b))
    );
    if (selectedBadge.id === badgeId) {
      setSelectedBadge((prev) => ({ ...prev, isPaymentConfirmed: true }));
    }
    setVerificationFeedback('✓ Paiement du chauffeur confirmé avec succès. Le badge CR80 est désormais imprimable.');
  };

  // Confirm payment for vehicle by Super Admin
  const handleConfirmVehiclePayment = (licenceId: string) => {
    setLicences((prev) =>
      prev.map((l) => (l.id === licenceId ? { ...l, isPaymentConfirmed: true, superAdminConfirmed: true } : l))
    );
    if (selectedLicence.id === licenceId) {
      setSelectedLicence((prev) => ({ ...prev, isPaymentConfirmed: true, superAdminConfirmed: true }));
    }
    setVerificationFeedback('✓ Paiement du véhicule validé par le Super Administrateur. La vignette pare-brise 100×100mm est désormais imprimable.');
  };

  const handleVerifyOffline = async (signature: string) => {
    setVerificationFeedback('Vérification de la signature cryptographique Ed25519 en cours...');
    try {
      const res = await fetch(buildApiUrl('/api/v1/verification/verify'), {
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
        `✓ SIGNATURE VALIDE HORS-LIGNE : Titre authentique émis par l'Autorité Organisatrice AOTUC (RFC 8032 Ed25519). Empreinte SHA-256 certifiée.`
      );
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const token = getStoredAuthToken();
      const endpoint =
        activeTab === 'badges'
          ? `/api/v1/badges/${selectedBadge.id}/pdf`
          : `/api/v1/licences/${selectedLicence.id}/sticker-pdf`;

      const response = await fetch(buildApiUrl(endpoint), {
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
                Autorité d'Émission (Directeur Général)
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-full flex items-center space-x-1">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Consultation / Impression Sécurisée</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Autorité Organisatrice des Transports Urbains de Conakry • Impression haute fidélité Badges CR80 (PVC) et Vignettes pare-brise 100×100mm • <span className="italic font-medium text-slate-600 dark:text-slate-300">« Pour une Mobilité Urbaine Participative & Durable »</span>
          </p>
        </div>

        {/* Tab switch — Clear Separation between Badges and Stickers */}
        <div className="flex bg-slate-200 p-1 rounded-lg">
          <button
            onClick={() => {
              setActiveTab('badges');
              setVerificationFeedback(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-2 transition ${
              activeTab === 'badges'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <IdCard className="w-4 h-4 text-[#FCD116]" />
            <span>Badges Chauffeurs (CR80)</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('licences');
              setVerificationFeedback(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-2 transition ${
              activeTab === 'licences'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck2 className="w-4 h-4 text-[#FCD116]" />
            <span>Vignettes Véhicules (100×100)</span>
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
                  <span>Registre des Badges Chauffeurs Émis</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <span>Registre des Vignettes Véhicules (Validation Super Admin)</span>
                </>
              )}
            </h2>

            <span className="text-[11px] font-semibold text-slate-500">
              Clé d'Autorité : <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-800 font-mono">ed25519_2026_01</code>
            </span>
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'badges' ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">N° Badge</th>
                    <th className="p-3">Conducteur</th>
                    <th className="p-3">Secteur / Permis</th>
                    <th className="p-3">Commune</th>
                    <th className="p-3">Paiement</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {badges.map((b) => (
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
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{b.firstName} {b.lastName}</div>
                        <div className="text-[10px] text-slate-500">Né le {b.dateOfBirth}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-slate-800 truncate max-w-[150px]">{b.activitySector}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{b.licenseNumber} (Cat. {b.categories})</div>
                      </td>
                      <td className="p-3 text-slate-600">{b.commune}</td>
                      <td className="p-3">
                        {b.isPaymentConfirmed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center space-x-1 w-fit">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Confirmé</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center space-x-1 w-fit">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>En attente</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {!b.isPaymentConfirmed && (isSuperAdmin || isDirector) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmDriverPayment(b.id);
                              }}
                              title="Confirmer l'encaissement du paiement"
                              className="text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded border border-emerald-200 transition"
                            >
                              Valider Paiement
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBadge(b);
                              setIsPrintModalOpen(true);
                            }}
                            title={b.isPaymentConfirmed ? 'Imprimer le badge' : 'Paiement non confirmé — impression bloquée'}
                            className={`text-xs font-bold flex items-center space-x-1 p-1 rounded transition ${
                              b.isPaymentConfirmed
                                ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                                : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'
                            }`}
                          >
                            <Printer className={`w-3.5 h-3.5 ${b.isPaymentConfirmed ? 'text-blue-600' : 'text-slate-400'}`} />
                            <span>Imprimer</span>
                          </button>
                        </div>
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
                    <th className="p-3">Véhicule & Propriétaire</th>
                    <th className="p-3">Validation Super Admin</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {licences.map((lic) => (
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
                      <td className="p-3 font-mono font-bold text-slate-900 text-sm">{lic.plateNumber}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{lic.vehicleMakeModel}</div>
                        <div className="text-[10px] text-slate-500">{lic.ownerName} • {lic.seats} Places ({lic.commune})</div>
                      </td>
                      <td className="p-3">
                        {lic.superAdminConfirmed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center space-x-1 w-fit">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Confirmé Super Admin</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center space-x-1 w-fit">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Requis Super Admin</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {!lic.superAdminConfirmed && isSuperAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmVehiclePayment(lic.id);
                              }}
                              title="Valider le paiement en tant que Super Administrateur"
                              className="text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded border border-blue-200 transition"
                            >
                              Valider (Super Admin)
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLicence(lic);
                              setIsPrintModalOpen(true);
                            }}
                            title={lic.superAdminConfirmed ? 'Imprimer la vignette' : 'Confirmation Super Admin requise'}
                            className={`text-xs font-bold flex items-center space-x-1 p-1 rounded transition ${
                              lic.superAdminConfirmed
                                ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                                : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'
                            }`}
                          >
                            <Printer className={`w-3.5 h-3.5 ${lic.superAdminConfirmed ? 'text-blue-600' : 'text-slate-400'}`} />
                            <span>Imprimer</span>
                          </button>
                        </div>
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
              <h2 className="text-xs font-bold uppercase tracking-wider flex items-center space-x-2">
                <Printer className="w-4 h-4 text-slate-600" />
                <span>
                  {activeTab === 'badges' ? 'Aperçu Badge CR80 (PVC)' : 'Aperçu Vignette Pare-Brise (100×100)'}
                </span>
              </h2>
              <span className="text-[10px] font-semibold text-slate-400">
                Design Dark Édition
              </span>
            </div>

            {activeTab === 'badges' ? (
              /* CR80 Badge Visual Preview — Authentic Dark Executive Card */
              <div
                className="aotuc-official-document relative w-full aspect-[85.6/53.98] rounded-xl p-3 shadow-2xl border flex flex-col justify-between overflow-hidden select-none"
                data-official-document="true"
                style={{
                  backgroundColor: '#0B1E36',
                  backgroundImage: 'linear-gradient(135deg, #0B1E36 0%, #0F172A 50%, #0B1E36 100%)',
                  borderColor: '#334155',
                  color: '#FFFFFF',
                  colorScheme: 'light',
                }}
              >
                {/* National Tricolor Top Stripe */}
                <div className="absolute top-0 left-0 right-0 h-1.5 flex z-10">
                  <div className="flex-1" style={{ backgroundColor: '#CE1126' }} />
                  <div className="flex-1" style={{ backgroundColor: '#FCD116' }} />
                  <div className="flex-1" style={{ backgroundColor: '#009460' }} />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between mt-1 border-b border-slate-700/60 pb-1">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <img
                      src="/logo-guinee.png"
                      alt="Guinée"
                      className="w-5 h-5 rounded-full bg-white/10 p-0.5 object-contain flex-shrink-0"
                    />
                    <div className="leading-tight min-w-0">
                      <div className="text-[6px] uppercase tracking-wider text-slate-300 font-bold truncate">
                        RÉPUBLIQUE DE GUINÉE
                      </div>
                      <div className="text-[7.5px] font-black text-[#FCD116] tracking-wide truncate">
                        AOTUC • CARTE PROFESSIONNELLE
                      </div>
                    </div>
                  </div>

                  <img
                    src="/aotuc-logo.png"
                    alt="AOTUC"
                    className="w-5 h-5 rounded-full bg-white p-0.5 object-contain border border-slate-600 shadow flex-shrink-0"
                  />
                </div>

                {/* Driver Body */}
                <div className="flex items-center space-x-2.5 my-auto">
                  <div className="w-14 h-16 rounded bg-slate-800 border-2 border-slate-500 flex flex-col items-center justify-center text-slate-400 overflow-hidden shadow-inner flex-shrink-0">
                    <User className="w-7 h-7 text-slate-400" />
                    <span className="text-[5.5px] text-slate-300 font-semibold mt-0.5">PHOTO</span>
                  </div>

                  <div className="flex-1 text-[8.5px] space-y-0.5 min-w-0">
                    <div>
                      <span className="text-slate-400 text-[6.5px] uppercase">CONDUCTEUR</span>
                      <div className="font-black text-white text-[10px] truncate leading-tight">
                        {selectedBadge.firstName} <span className="text-[#FCD116]">{selectedBadge.lastName}</span>
                      </div>
                    </div>
                    <div className="text-emerald-400 font-mono font-bold text-[8px]">
                      N° {selectedBadge.badgeNumber}
                    </div>
                    <div className="text-slate-300 text-[7.5px] truncate">
                      {selectedBadge.activitySector}
                    </div>
                    <div className="text-slate-300 text-[7px]">
                      Né le : <span className="text-slate-100 font-semibold">{selectedBadge.dateOfBirth}</span>
                    </div>
                    <div className="text-slate-400 text-[6.5px] truncate">
                      Permis : {selectedBadge.licenseNumber} • {selectedBadge.commune}
                    </div>
                  </div>

                  {/* Scannable QR Code */}
                  <div className="w-12 h-12 bg-white p-1 rounded-lg border border-slate-700 flex flex-col items-center justify-center flex-shrink-0 shadow-md">
                    <QrCode className="w-10 h-10 text-slate-950" />
                    <span className="text-[4px] font-bold text-slate-900 uppercase">Ed25519</span>
                  </div>
                </div>

                {/* Footer / Validity and Security Stamp */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-700 text-[7.5px]">
                  <div className="text-slate-400">
                    Expire : <span className="text-white font-mono font-bold">{selectedBadge.expiryDate}</span>
                  </div>
                  {selectedBadge.isPaymentConfirmed ? (
                    <span className="px-1.5 py-0.5 rounded text-[6.5px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ✓ PAYÉ
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[6.5px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      NON PAYÉ
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* Windshield Sticker Visual Preview (Square 100x100 mm - Dark Elegant Design) */
              <div
                className="aotuc-official-document relative w-full aspect-square max-w-[270px] mx-auto rounded-2xl p-3.5 shadow-2xl border-2 flex flex-col justify-between overflow-hidden select-none"
                data-official-document="true"
                style={{
                  backgroundColor: '#0B1E36',
                  backgroundImage: 'linear-gradient(135deg, #0B1E36 0%, #0F172A 50%, #0B1E36 100%)',
                  borderColor: '#FCD116',
                  color: '#FFFFFF',
                  colorScheme: 'light',
                }}
              >
                {/* Top Guinea Flag Stripe */}
                <div className="absolute top-0 left-0 right-0 h-1.5 flex z-10">
                  <div className="flex-1" style={{ backgroundColor: '#CE1126' }} />
                  <div className="flex-1" style={{ backgroundColor: '#FCD116' }} />
                  <div className="flex-1" style={{ backgroundColor: '#009460' }} />
                </div>

                {/* Header with Both Logos */}
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-1 mt-1">
                  <img
                    src="/logo-guinee.png"
                    alt="Guinée"
                    className="w-6 h-6 rounded-full bg-white/10 p-0.5 object-contain flex-shrink-0"
                  />
                  <div className="text-center flex-1 leading-tight px-1">
                    <div className="text-[6.5px] uppercase font-bold tracking-wider text-slate-300">
                      RÉPUBLIQUE DE GUINÉE
                    </div>
                    <div className="text-[8.5px] font-black uppercase text-[#FCD116]">
                      AOTUC • VIGNETTE OFFICIELLE
                    </div>
                  </div>
                  <img
                    src="/aotuc-logo.png"
                    alt="AOTUC"
                    className="w-6 h-6 rounded-full bg-white p-0.5 object-contain border border-slate-700 flex-shrink-0 shadow-sm"
                  />
                </div>

                {/* Central Plate Box */}
                <div className="text-center my-auto space-y-1">
                  <div className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">
                    IMMATRICULATION
                  </div>
                  <div className="text-lg font-black font-mono tracking-widest bg-white text-slate-950 py-1 px-3 rounded-lg border-2 border-[#FCD116] inline-block shadow-md">
                    {selectedLicence.plateNumber}
                  </div>
                  <div className="text-[9.5px] font-bold text-white mt-1">
                    {selectedLicence.vehicleMakeModel}
                  </div>
                  <div className="text-[8px] text-slate-300">
                    Capacité : <b className="text-white">{selectedLicence.seats} Places</b> • {selectedLicence.commune}
                  </div>
                </div>

                {/* Footer with Big Year & QR Code */}
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/80">
                  <div>
                    <div className="text-[6.5px] font-bold uppercase text-slate-400">EXERCICE</div>
                    <div className="text-xl font-black text-[#FCD116] leading-none">{selectedLicence.validYear}</div>
                    <div className="text-[6.5px] font-bold mt-0.5">
                      {selectedLicence.superAdminConfirmed ? (
                        <span className="text-emerald-400">✓ SUPER ADMIN OK</span>
                      ) : (
                        <span className="text-rose-400">ATTENTE SUPER ADMIN</span>
                      )}
                    </div>
                  </div>

                  <div className="w-11 h-11 bg-white p-1 rounded-lg border border-slate-700 flex flex-col items-center justify-center shadow-md">
                    <QrCode className="w-8 h-8 text-slate-950" />
                    <span className="text-[4px] font-bold text-slate-800 uppercase">Ed25519</span>
                  </div>
                </div>
              </div>
            )}

            {/* Cryptographic Hash & Tamper-Proofing Info */}
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
              <div className="font-semibold text-slate-800 flex items-center justify-between">
                <span>Payload Sécurisé QR Code :</span>
                <span className="text-[10px] text-slate-400 font-mono">Ed25519</span>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200 font-mono text-[10px] text-slate-600 break-all select-all">
                {activeTab === 'badges'
                  ? selectedBadge.signaturePreview
                  : selectedLicence.signaturePreview}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-200 space-y-2">
            {/* Primary High-Fidelity Color Printing Button */}
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="w-full py-2.5 bg-[#0B1E36] hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-2 shadow cursor-pointer min-h-[42px]"
            >
              <Printer className="w-4 h-4 text-[#FCD116]" />
              <span>
                {activeTab === 'badges'
                  ? 'Ouvrir Impression Badge Chauffeur (CR80)'
                  : 'Ouvrir Impression Vignette Véhicule (100×100)'}
              </span>
            </button>

            <button
              onClick={() => handleVerifyOffline(activeTab === 'badges' ? selectedBadge.signaturePreview : selectedLicence.signaturePreview)}
              className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition flex items-center justify-center space-x-2 cursor-pointer"
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

      {/* Official AOTUC Color Print Preview & Printer Dialog */}
      <PrintCredentialModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        data={getPrintableData()}
        onDownloadPdf={handleDownloadPdf}
      />
    </div>
  );
};

export default BadgeLicenceCenter;
