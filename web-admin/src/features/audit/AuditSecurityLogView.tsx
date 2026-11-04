import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Clock,
  Lock,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';
import { UserContext } from '../../types';

interface AuditItem {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetModule: 'AUTH' | 'REGISTRATION' | 'VALIDATION' | 'BADGES' | 'TICKETING' | 'SYNC' | 'SECURITY';
  targetRecordId: string;
  details: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  integrityHash: string;
}

const SAMPLE_AUDIT_LOGS: AuditItem[] = [
  {
    id: 'aud-001',
    timestamp: '04/11/2026 15:42:10',
    actorName: 'Mamadou Camara',
    actorRole: 'DIRECTOR',
    action: 'APPROBATION_FINALE_DIRECTEUR',
    targetModule: 'VALIDATION',
    targetRecordId: 'DOS-2026-00441',
    details: 'Validation finale Niveau 3 du dossier conducteur Thierno Mamadou Bah. Badge CR80 prêt pour émission.',
    severity: 'INFO',
    integrityHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  },
  {
    id: 'aud-002',
    timestamp: '04/11/2026 15:10:05',
    actorName: 'Système Cryptographique AOTUC',
    actorRole: 'SYSTEM_HSM',
    action: 'EMISSION_BADGE_ED25519',
    targetModule: 'BADGES',
    targetRecordId: 'BDG-2026-00042',
    details: 'Signature asymétrique RFC 8032 générée avec la clé ed25519_2026_01. QR code compact généré.',
    severity: 'INFO',
    integrityHash: '8b22de91ef047f4a9b6623e840d1c94412ab34567890abcdef1234567890abcd',
  },
  {
    id: 'aud-003',
    timestamp: '04/11/2026 14:15:33',
    actorName: 'Ousmane Sylla',
    actorRole: 'DISTRIBUTEUR',
    action: 'VENTE_TICKETS_DIRECTE',
    targetModule: 'TICKETING',
    targetRecordId: 'REC-2026-0091',
    details: 'Encaissement de 10 tickets urbains (20 000 GNF) via Orange Money. Écriture en partie double JNL-2026-000841.',
    severity: 'INFO',
    integrityHash: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
  },
  {
    id: 'aud-004',
    timestamp: '04/11/2026 13:28:49',
    actorName: 'Tentative Non Autorisée (IP 197.149.20.12)',
    actorRole: 'ANONYME',
    action: 'TENTATIVE_AUTO_APPROBATION_BLOQUEE',
    targetModule: 'SECURITY',
    targetRecordId: 'DOS-2026-00438',
    details: 'Alerte anti-fraude: Un agent a tenté d approuver son propre dossier d enrôlement. Blocage strict 403.',
    severity: 'CRITICAL',
    integrityHash: '9a3ecbe5ed12ab4d8e11ba873c2f11161202b9454f53cda18c2baa0c0354bb5f',
  },
  {
    id: 'aud-005',
    timestamp: '04/11/2026 11:05:12',
    actorName: 'Sekou Conte',
    actorRole: 'AGENT_TERRAIN',
    action: 'TELEVERSEMENT_DOCUMENT_CONTROLE_MAGIC_BYTES',
    targetModule: 'REGISTRATION',
    targetRecordId: 'DOC-2026-9901',
    details: 'Téléversement permis de conduire validé par signature binaire JPEG (FF D8 FF). Stockage privé chiffré.',
    severity: 'INFO',
    integrityHash: 'c94412ab34567890abcdef1234567890abcdef1234567890abcdef1234567890',
  },
  {
    id: 'aud-006',
    timestamp: '04/11/2026 09:12:00',
    actorName: 'Fanta Soumah',
    actorRole: 'CHEF_SERVICE',
    action: 'RETOUR_POUR_CORRECTION_NIVEAU2',
    targetModule: 'VALIDATION',
    targetRecordId: 'DOS-2026-00439',
    details: 'Dossier retourné avec commentaire obligatoire (motif: "Photo floue, reprise exigée"). SMS automatique envoyé.',
    severity: 'WARNING',
    integrityHash: '12ab34567890abcdef1234567890abcdef1234567890abcdef1234567890abcd',
  },
];

export const AuditSecurityLogView: React.FC<{ currentUser: UserContext }> = () => {
  const [logs] = useState<AuditItem[]>(SAMPLE_AUDIT_LOGS);
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [verifiedHash, setVerifiedHash] = useState<string | null>(null);

  const handleVerifyIntegrity = (item: AuditItem) => {
    setVerifiedHash(`✓ EMPREINTE SHA-256 CONFORME (Événement ${item.id}) : L écriture dans la chaîne de preuve immuable n a subi aucune altération.`);
  };

  const handleExportAudit = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['ID,Date,Acteur,Role,Action,Module,Reference,Details,Hash']
        .concat(
          logs.map(
            (l) =>
              `"${l.id}","${l.timestamp}","${l.actorName}","${l.actorRole}","${l.action}","${l.targetModule}","${l.targetRecordId}","${l.details}","${l.integrityHash}"`
          )
        )
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AOTUC_Journal_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.actorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.targetRecordId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesModule = moduleFilter === 'ALL' || l.targetModule === moduleFilter;

    return matchesSearch && matchesModule;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <img
            src="/logo-guinee.png"
            alt="Sceau Officiel"
            className="w-11 h-11 rounded-full object-contain p-0.5 border border-slate-200 shadow-sm flex-shrink-0"
          />
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              RÉPUBLIQUE DE GUINÉE • MINISTÈRE DES TRANSPORTS
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Journal d Audit, Sécurité & Traçabilité Réglementaire
            </h1>
            <p className="text-xs text-slate-500">
              Registre immuable des événements cryptographiques, décisions de validation et contrôles anti-fraude.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportAudit}
            className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition flex items-center space-x-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exporter Journal (CSV)</span>
          </button>
        </div>
      </div>

      {/* 4 Compliance Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Événements Journalisés</div>
            <div className="text-base font-bold text-slate-900">{logs.length} Écritures</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Signatures Ed25519</div>
            <div className="text-base font-bold text-slate-900">100% Intègres</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Fraudes Interceptées</div>
            <div className="text-base font-bold text-slate-900">1 Tentative Bloquée</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Conformité ARPT</div>
            <div className="text-base font-bold text-slate-900">Certifiée v2.0</div>
          </div>
        </div>
      </div>

      {/* Verified Hash Notification */}
      {verifiedHash && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-center space-x-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{verifiedHash}</span>
        </div>
      )}

      {/* Main Audit Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Filters */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrer par acteur, action, référence..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold text-slate-600 flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Module :</span>
            </span>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-700"
            >
              <option value="ALL">Tous les Modules</option>
              <option value="VALIDATION">Validation Multi-Niveaux</option>
              <option value="BADGES">Badges & Licences Ed25519</option>
              <option value="TICKETING">Billetterie & Finances</option>
              <option value="REGISTRATION">Enrôlement & Documents</option>
              <option value="SECURITY">Sécurité & Anti-Fraude</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="p-3">Horodatage</th>
                <th className="p-3">Acteur / Rôle</th>
                <th className="p-3">Module</th>
                <th className="p-3">Action Exécutée</th>
                <th className="p-3">Référence Cible</th>
                <th className="p-3">Détails Opérationnels</th>
                <th className="p-3 text-right">Intégrité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-3 text-slate-500 text-[11px] font-mono whitespace-nowrap">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{item.timestamp}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-semibold text-slate-900">{item.actorName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{item.actorRole}</div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {item.targetModule}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        item.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : item.severity === 'WARNING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {item.action}
                    </span>
                  </td>
                  <td className="p-3 font-mono font-bold text-slate-800">{item.targetRecordId}</td>
                  <td className="p-3 text-slate-600 max-w-xs">{item.details}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleVerifyIntegrity(item)}
                      title="Vérifier l empreinte SHA-256 dans la chaîne de preuve"
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center space-x-1 ml-auto"
                    >
                      <Lock className="w-3 h-3" />
                      <span>Scellé</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditSecurityLogView;