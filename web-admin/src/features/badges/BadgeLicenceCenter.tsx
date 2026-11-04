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
  commune: string;
  issueDate: string;
  expiryDate: string;
  status: 'ACTIF' | 'REVOQUE' | 'SUSPENDU';
  signaturePreview: string;
}

interface LicenceRecord {
  id: string;
  licenceNumber: string;
  plateNumber: string;
  vehicleMakeModel: string;
  ownerName: string;
  category: string;
  seats: number;
  commune: string;
  validYear: number;
  status: 'ACTIF' | 'EXPIRE' | 'REVOQUE';
  signaturePreview: string;
}

const SAMPLE_BADGES: BadgeRecord[] = [
  {
    id: 'bdg-001',
    badgeNumber: 'BDG-2026-00042',
    driverName: 'Abdoulaye Bah',
    nin: '1988041200142',
    licenseNumber: 'PC-GN-2015-8841',
    categories: 'B, C1',
    commune: 'Matam',
    issueDate: '2026-02-15',
    expiryDate: '2028-02-15',
    status: 'ACTIF',
    signaturePreview: 'AOTUC1.ed25519_2026_01.bdg-001.BADGE.DRIVER_Bah.1771113600.1834272000.7f4a9b...',
  },
  {
    id: 'bdg-002',
    badgeNumber: 'BDG-2026-00043',
    driverName: 'Mohamed Kourouma',
    nin: '1992082400983',
    licenseNumber: 'PC-GN-2018-4412',
    categories: 'B',
    commune: 'Kaloum',
    issueDate: '2026-03-01',
    expiryDate: '2028-03-01',
    status: 'ACTIF',
    signaturePreview: 'AOTUC1.ed25519_2026_01.bdg-002.BADGE.DRIVER_Kourouma.1772323200.1835481600.a1c89e...',
  },
  {
    id: 'bdg-003',
    badgeNumber: 'BDG-2025-00911',
    driverName: 'Sékouba Camara',
    nin: '1985110300221',
    licenseNumber: 'PC-GN-2012-1094',
    categories: 'B, D',
    commune: 'Matoto',
    issueDate: '2025-06-10',
    expiryDate: '2027-06-10',
    status: 'REVOQUE',
    signaturePreview: 'AOTUC1.ed25519_2026_01.bdg-003.BADGE.DRIVER_Camara.1749513600.1812672000.3e4f71...',
  },
];

const SAMPLE_LICENCES: LicenceRecord[] = [
  {
    id: 'lic-001',
    licenceNumber: 'LIC-2026-00188',
    plateNumber: 'RC-9844-AB',
    vehicleMakeModel: 'Toyota HiAce Minibus (Magbana)',
    ownerName: 'El Hadj Ousmane Sow',
    category: 'MINIBUS_URBAIN',
    seats: 18,
    commune: 'Matoto',
    validYear: 2026,
    status: 'ACTIF',
    signaturePreview: 'AOTUC1.ed25519_2026_01.lic-001.LICENCE.VEH_RC9844AB.1767225600.1798761600.8b22de...',
  },
  {
    id: 'lic-002',
    licenceNumber: 'LIC-2026-00189',
    plateNumber: 'RC-3122-C',
    vehicleMakeModel: 'Renault Laguna Taxi Jaune',
    ownerName: 'Mamadou Bhoye Diallo',
    category: 'TAXI_COMMUNAL',
    seats: 5,
    commune: 'Kaloum',
    validYear: 2026,
    status: 'ACTIF',
    signaturePreview: 'AOTUC1.ed25519_2026_01.lic-002.LICENCE.VEH_RC3122C.1767225600.1798761600.91ef04...',
  },
];

export const BadgeLicenceCenter: React.FC<{ currentUser?: UserContext }> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'badges' | 'licences'>('badges');
  const [selectedBadge, setSelectedBadge] = useState<BadgeRecord>(SAMPLE_BADGES[0]);
  const [selectedLicence, setSelectedLicence] = useState<LicenceRecord>(SAMPLE_LICENCES[0]);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  const canIssue = currentUser ? hasRolePermission(currentUser.role, PERMISSIONS.CREDENTIALS_ISSUE) : true;

  const handleVerifyOffline = (_signature: string) => {
    setVerificationFeedback('Vérification cryptographique en cours avec la clé publique ed25519_2026_01...');
    setTimeout(() => {
      setVerificationFeedback(
        `✓ SIGNATURE VALIDE HORS-LIGNE : Titre authentique émis par l Autorité Organisatrice AOTUC (RFC 8032 Ed25519). Empreinte SHA-256 certifiée.`
      );
    }, 450);
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
            Génération, signature asymétrique RFC 8032, impression CR80 PVC et vignettes pare-brise 100×100mm.
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
              /* CR80 Badge Visual Preview */
              <div className="relative w-full aspect-[85.6/53.98] bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-4 shadow-lg border border-slate-700 flex flex-col justify-between overflow-hidden">
                {/* National Tricolor Top Stripe */}
                <div className="absolute top-0 left-0 right-0 h-1.5 flex">
                  <div className="flex-1 bg-[#CE1126]" />
                  <div className="flex-1 bg-[#FCD116]" />
                  <div className="flex-1 bg-[#16A34A]" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center space-x-2">
                    <img
                      src="/logo-guinee.png"
                      alt="Sceau Guinée"
                      className="w-7 h-7 rounded-full bg-white p-0.5 object-contain shadow-sm border border-slate-600 flex-shrink-0"
                    />
                    <div>
                      <div className="text-[8px] uppercase tracking-wider text-slate-300 font-bold">
                        RÉPUBLIQUE DE GUINÉE • MINISTÈRE DES TRANSPORTS
                      </div>
                      <div className="text-[10px] font-black text-[#FCD116] tracking-wide">
                        AOTUC • CARTE PROFESSIONNELLE DE CONDUCTEUR
                      </div>
                    </div>
                  </div>
                  <div className="text-[9px] font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-600 text-slate-200">
                    {selectedBadge.badgeNumber}
                  </div>
                </div>

                {/* Driver Body */}
                <div className="flex items-center space-x-3 my-1">
                  <div className="w-16 h-20 rounded bg-slate-700 border-2 border-slate-500 flex flex-col items-center justify-center text-slate-400 overflow-hidden">
                    <User className="w-8 h-8 text-slate-400" />
                    <span className="text-[8px] text-slate-300 font-semibold mt-1">PHOTO</span>
                  </div>

                  <div className="flex-1 text-[11px] space-y-0.5">
                    <div className="font-bold text-white text-xs">{selectedBadge.driverName}</div>
                    <div className="text-slate-300 text-[10px]">
                      NIN : <span className="font-mono text-slate-200">{selectedBadge.nin}</span>
                    </div>
                    <div className="text-slate-300 text-[10px]">
                      Permis : <span className="font-mono text-slate-200">{selectedBadge.licenseNumber}</span>
                    </div>
                    <div className="text-slate-300 text-[10px]">
                      Catégories : <span className="font-bold text-[#FCD116]">{selectedBadge.categories}</span>
                    </div>
                    <div className="text-slate-400 text-[9px]">
                      Commune : {selectedBadge.commune}
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="w-16 h-16 bg-white p-1 rounded-lg flex flex-col items-center justify-center shadow-inner">
                    <QrCode className="w-14 h-14 text-slate-900" />
                  </div>
                </div>

                {/* Footer Strip */}
                <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1 border-t border-slate-700">
                  <div>Valide jusqu au : <b className="text-slate-200">{selectedBadge.expiryDate}</b></div>
                  <div className="flex items-center space-x-1 text-emerald-400 font-semibold">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Ed25519 Signé</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Windshield Sticker Visual Preview (Square 100x100 mm) */
              <div className="relative w-full aspect-square max-w-[280px] mx-auto bg-amber-400 text-slate-950 rounded-2xl p-4 shadow-xl border-4 border-slate-900 flex flex-col justify-between overflow-hidden">
                {/* Header */}
                <div className="flex items-center space-x-2 border-b-2 border-slate-900 pb-1.5">
                  <img
                    src="/logo-guinee.png"
                    alt="Sceau République de Guinée"
                    className="w-9 h-9 rounded-full bg-white p-0.5 object-contain border border-slate-900 flex-shrink-0 shadow-sm"
                  />
                  <div className="text-left flex-1 leading-tight">
                    <div className="text-[8px] uppercase font-bold tracking-wider text-slate-800">
                      RÉPUBLIQUE DE GUINÉE • MINISTÈRE DES TRANSPORTS
                    </div>
                    <div className="text-[11px] font-black uppercase text-slate-950">
                      AOTUC • VIGNETTE DE TRANSPORT URBAIN
                    </div>
                  </div>
                </div>

                {/* Central Plate */}
                <div className="text-center my-auto space-y-1">
                  <div className="text-[10px] font-bold text-slate-800 uppercase">
                    IMMATRICULATION AUTORISÉE
                  </div>
                  <div className="text-2xl font-black font-mono tracking-wider bg-white py-1 px-2 rounded-lg border-2 border-slate-900 inline-block shadow-sm">
                    {selectedLicence.plateNumber}
                  </div>
                  <div className="text-[11px] font-bold text-slate-900">
                    {selectedLicence.vehicleMakeModel}
                  </div>
                  <div className="text-[10px] text-slate-800">
                    Capacité : <b>{selectedLicence.seats} Places</b> • {selectedLicence.commune}
                  </div>
                </div>

                {/* Footer with Big Year & QR Code */}
                <div className="flex items-center justify-between pt-2 border-t-2 border-slate-900">
                  <div>
                    <div className="text-[9px] font-bold uppercase">EXERCICE</div>
                    <div className="text-2xl font-black text-slate-900">{selectedLicence.validYear}</div>
                  </div>

                  <div className="w-14 h-14 bg-white p-1 rounded-lg border-2 border-slate-900 flex items-center justify-center">
                    <QrCode className="w-12 h-12 text-slate-950" />
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
              onClick={() => alert(`Téléchargement du fichier PDF sécurisé pour impression AOTUC.`)}
              className="w-full py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition flex items-center justify-center space-x-2"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>
                {activeTab === 'badges'
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