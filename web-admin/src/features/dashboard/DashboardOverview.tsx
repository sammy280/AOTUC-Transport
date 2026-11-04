import React from 'react';
import { Users, Car, IdCard, Clock, CheckCircle2, ArrowUpRight } from 'lucide-react';

interface DashboardOverviewProps {
  onOpenValidationQueue: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onOpenValidationQueue }) => {
  const stats = [
    {
      title: 'Chauffeurs Enrôlés',
      value: '1 428',
      subtitle: '+34 cette semaine',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100',
    },
    {
      title: 'Véhicules Contrôlés',
      value: '982',
      subtitle: 'Taxis (64%), Magbanas (36%)',
      icon: Car,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-100',
    },
    {
      title: 'Badges CR80 Actifs',
      value: '1 210',
      subtitle: 'Signés cryptographiquement Ed25519',
      icon: IdCard,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-100',
    },
    {
      title: 'En Attente de Validation',
      value: '46',
      subtitle: 'Niveau 2 (32) • Niveau 3 (14)',
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-100',
      action: onOpenValidationQueue,
    },
  ];

  const communeData = [
    { name: 'Matoto', count: 540, percentage: 38, color: 'bg-emerald-500' },
    { name: 'Ratoma', count: 412, percentage: 29, color: 'bg-blue-500' },
    { name: 'Dixinn', count: 185, percentage: 13, color: 'bg-indigo-500' },
    { name: 'Matam', count: 162, percentage: 11, color: 'bg-amber-500' },
    { name: 'Kaloum', count: 114, percentage: 8, color: 'bg-purple-500' },
    { name: 'Kassa', count: 15, percentage: 1, color: 'bg-slate-400' },
  ];

  const recentAudits = [
    {
      action: 'APPROBATION_FINALE_DIRECTEUR',
      detail: 'Dossier chauffeur CH-2026-00412 validé',
      actor: 'Mamadou Camara (Directeur)',
      time: 'Il y a 12 min',
      badge: 'bg-emerald-100 text-emerald-800',
    },
    {
      action: 'TRANSMISSION_NIVEAU_3',
      detail: 'Dossier véhicule RC-4192-A transmis par Chef Service',
      actor: 'Fanta Soumah (Chef Service Matoto)',
      time: 'Il y a 34 min',
      badge: 'bg-blue-100 text-blue-800',
    },
    {
      action: 'RETOUR_POUR_CORRECTION',
      detail: 'Permis de conduire flou : retourné pour reprise',
      actor: 'Alpha Barry (Chef Service Kaloum)',
      time: 'Il y a 1h 10min',
      badge: 'bg-amber-100 text-amber-800',
    },
    {
      action: 'ENROLEMENT_AGENT_TERRAIN',
      detail: 'Nouveau chauffeur soumis au rond-point Cosa',
      actor: 'Sekou Conte (Agent Terrain)',
      time: 'Il y a 2h',
      badge: 'bg-slate-100 text-slate-800',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Tableau de Bord Exécutif AOTUC
          </h1>
          <p className="text-xs text-slate-500">
            Supervision opérationnelle centralisée du transport urbain dans l agglomération de Conakry.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenValidationQueue}
            className="flex items-center space-x-2 bg-[#CE1126] hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition"
          >
            <span>Traiter les Dossiers en Attente</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              onClick={stat.action}
              className={`p-4 rounded-xl border ${stat.borderColor} bg-white shadow-sm flex flex-col justify-between transition ${
                stat.action ? 'cursor-pointer hover:border-amber-400 hover:shadow-md' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{stat.title}</span>
                <div className={`p-2 rounded-lg ${stat.bgColor} ${stat.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{stat.subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid: Validation Funnel & Commune Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Multi-Level Validation Funnel (2 Cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Entonnoir d Examen Administratif</h2>
              <p className="text-xs text-slate-500">Processus de certification hiérarchique à 3 niveaux</p>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Conforme Arrêté AOTUC
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            {/* Level 1 */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Niveau 1 : Terrain</div>
              <div className="text-sm font-bold text-slate-900 mt-1">Agents Enrôleurs</div>
              <div className="text-2xl font-extrabold text-blue-600 mt-2">100%</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Saisie mobile, capture biométrique & vérification des pièces physiques.
              </p>
            </div>

            {/* Level 2 */}
            <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-lg">
              <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Niveau 2 : Commune</div>
              <div className="text-sm font-bold text-slate-900 mt-1">Chefs de Service</div>
              <div className="text-2xl font-extrabold text-amber-600 mt-2">32 en cours</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Examen territorial, conformité permis, contrôle anti-doublon.
              </p>
            </div>

            {/* Level 3 */}
            <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-lg">
              <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Niveau 3 : Direction</div>
              <div className="text-sm font-bold text-slate-900 mt-1">Directeur Général</div>
              <div className="text-2xl font-extrabold text-emerald-600 mt-2">1 210 validés</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Agrément officiel et ordonnance de signature QR cryptographique.
              </p>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start space-x-3 text-xs text-blue-900">
            <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Règle de sécurité active :</span> Aucun titre de transport (Badge CR80 ou Sticker pare-brise) ne peut être émis tant que le Niveau 3 n est pas atteint. Le contournement de niveau est techniquement impossible.
            </div>
          </div>
        </div>

        {/* Right Column: Communes Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Activité par Commune</h2>
            <p className="text-xs text-slate-500">Volume de transporteurs certifiés</p>
          </div>

          <div className="space-y-3">
            {communeData.map((c, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700">{c.name}</span>
                  <span className="text-slate-500 font-semibold">{c.count} ({c.percentage}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`${c.color} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${c.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Security & Audit Logs Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Journal d Audit Opérationnel (Temps Réel)</h2>
            <p className="text-xs text-slate-500">Dernières transactions administratives enregistrées</p>
          </div>
          <span className="text-xs text-slate-400">Horodatage UTC conforme RFC 5424</span>
        </div>

        <div className="divide-y divide-slate-100">
          {recentAudits.map((item, idx) => (
            <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.badge}`}>
                  {item.action}
                </span>
                <span className="font-medium text-slate-800">{item.detail}</span>
              </div>
              <div className="flex items-center space-x-4 text-slate-500 text-[11px]">
                <span>{item.actor}</span>
                <span>•</span>
                <span className="text-slate-400">{item.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
