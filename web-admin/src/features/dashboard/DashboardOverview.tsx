import React from 'react';
import {
  Users,
  Car,
  IdCard,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Shield,
  Server,
  Activity,
  AlertTriangle,
  Receipt,
  Wallet,
  Ticket,
  UserPlus,
  Send,
} from 'lucide-react';
import { UserContext } from '../../types';
import ConakryMapWidget from '../mapping/ConakryMapWidget';
import DirectorAuthoritiesWidget from './DirectorAuthoritiesWidget';

interface DashboardOverviewProps {
  currentUser: UserContext;
  onOpenValidationQueue: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  currentUser,
  onOpenValidationQueue,
  onNavigateTab,
}) => {
  // Navigation helper
  const navigateTo = (tab: string) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    } else if (tab === 'validation') {
      onOpenValidationQueue();
    }
  };

  // --------------------------------------------------------------------------
  // ROLE 2: SUPER ADMINISTRATOR (DSI) DASHBOARD
  // --------------------------------------------------------------------------
  if (currentUser.role === 'SUPER_ADMIN') {
    const dsiStats = [
      {
        title: 'Comptes Utilisateurs Actifs',
        value: '7 / 7',
        subtitle: '100% accrédités RBAC',
        icon: Users,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
      },
      {
        title: 'Santé des Composants API',
        value: 'Optimal (6/6)',
        subtitle: 'PostGIS, Ed25519, SMS, Revocation',
        icon: Server,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
      },
      {
        title: 'Intégrité Cryptographique',
        value: 'SHA-256 Intègre',
        subtitle: 'Empreintes inaltérables certifiées',
        icon: Shield,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
      },
      {
        title: 'Tentatives & Incidents Bloqués',
        value: '0 Brèche',
        subtitle: '401/403 enregistrés au journal',
        icon: Activity,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
      },
    ];

    const technicalServices = [
      { name: 'Passerelle API Express v2.0', status: 'Actif • 100% Uptime', port: 'Port 5000' },
      { name: 'Moteur de Base de Données PostGIS 18', status: 'Connecté • Schéma Sync', port: 'PostgreSQL' },
      { name: 'Moteur Asymétrique RFC 8032 Ed25519', status: 'Clé active: aotuc-2026-v1', port: 'Backend KMS' },
      { name: 'Registre Invalidation Sessions (Revocation)', status: 'Surveillance Temps Réel', port: 'In-Memory Gate' },
      { name: 'Passerelle SMS Orange & MTN Guinée', status: 'Opérationnelle', port: 'SMPP / HTTPS' },
      { name: 'Grand Livre & Hash Intégrité SHA-256', status: 'Append-Only Verrouillé', port: 'Table Audit' },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <img
              src="/logo-guinee.png"
              alt="Armoiries République de Guinée"
              className="w-12 h-12 rounded-full object-contain p-0.5 border border-slate-200 shadow-sm flex-shrink-0"
            />
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                DIRECTION DES SYSTÈMES D INFORMATION (DSI) • SUPERVISION TECHNIQUE
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Console d Administration Système & Sécurité
              </h1>
              <p className="text-xs text-slate-500">
                Gestion des comptes, surveillance des signatures cryptographiques et audit de conformité.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={() => navigateTo('users')}
              className="w-full sm:w-auto justify-center flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer min-h-[44px]"
            >
              <span>Gérer les Utilisateurs</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4 DSI Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {dsiStats.map((st, idx) => {
            const Icon = st.icon;
            return (
              <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">{st.title}</span>
                  <div className={`p-2 rounded-lg ${st.bgColor} ${st.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl font-black text-slate-900">{st.value}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{st.subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Conakry Interactive GIS Map Widget for Admin */}
        <ConakryMapWidget
          currentUser={currentUser}
          height="380px"
          onOpenFullMap={() => navigateTo('mapping')}
          title="Supervision SIG Réseau & Infrastructure — Conakry"
          subtitle="Visualisation géospatiale des couloirs de transport urbain et des 20 stations régulées sur les 13 communes."
        />

        {/* Technical Services Status */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Services Techniques & Infrastructure AOTUC</h2>
              <p className="text-xs text-slate-500">État temps réel des démons et des passerelles d intégrité</p>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span>Système Intègre</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {technicalServices.map((svc, idx) => (
              <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="font-bold text-xs text-slate-900">{svc.name}</div>
                <div className="text-[11px] text-emerald-600 font-semibold">{svc.status}</div>
                <div className="text-[10px] text-slate-400 font-mono">{svc.port}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // ROLE 3: HEAD OF SERVICE (L2 - MATOTO) DASHBOARD
  // --------------------------------------------------------------------------
  if (currentUser.role === 'CHEF_SERVICE') {
    const matotoStats = [
      {
        title: 'Chauffeurs Commune Matoto',
        value: '540',
        subtitle: '38% du parc urbain total',
        icon: Users,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
      },
      {
        title: 'Véhicules Immatriculés',
        value: '380',
        subtitle: 'Magbanas & Taxis communaux',
        icon: Car,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
      },
      {
        title: 'En Attente Avis Niveau 2',
        value: '32 Dossiers',
        subtitle: 'Soumis par agents de terrain',
        icon: Clock,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        action: onOpenValidationQueue,
      },
      {
        title: 'Dossiers Renvoyés pour Correction',
        value: '5',
        subtitle: 'Notifications SMS transmises',
        icon: AlertTriangle,
        color: 'text-rose-600',
        bgColor: 'bg-rose-50',
      },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <img
              src="/logo-guinee.png"
              alt="Logo"
              className="w-12 h-12 rounded-full object-contain p-0.5 border border-slate-200 shadow-sm flex-shrink-0"
            />
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                PÉRIMÈTRE OPÉRATIONNEL TERRITORIAL • NIVEAU 2
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Tableau de Bord — Chef de Service ({currentUser.communeName})
              </h1>
              <p className="text-xs text-slate-500">
                Instruction hiérarchique, contrôle anti-fraude et transmission des dossiers au Directeur Général.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenValidationQueue}
            className="w-full sm:w-auto justify-center flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer min-h-[44px]"
          >
            <Send className="w-4 h-4" />
            <span>Instruire les Dossiers Matoto (N2)</span>
          </button>
        </div>

        {/* 4 Matoto Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {matotoStats.map((st, idx) => {
            const Icon = st.icon;
            return (
              <div
                key={idx}
                onClick={st.action}
                className={`p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between ${
                  st.action ? 'cursor-pointer hover:border-blue-400' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">{st.title}</span>
                  <div className={`p-2 rounded-lg ${st.bgColor} ${st.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl font-black text-slate-900">{st.value}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{st.subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Conakry Interactive GIS Map Widget for Chef de Service (scoped) */}
        <ConakryMapWidget
          currentUser={currentUser}
          height="360px"
          onOpenFullMap={() => navigateTo('mapping')}
          initialCommune={currentUser.communeName || 'Matoto'}
          title={`Cartographie Réseau & Arrêts Régulés — ${currentUser.communeName || 'Matoto'}`}
          subtitle="Implantation des arrêts, couloirs urbains et circulation dans le périmètre communal."
        />

        {/* Territorial Scope Card */}
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3 text-xs text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Découpage Territorial Garanti :</span> Votre compte est configuré pour examiner exclusivement les dossiers émis dans la commune de Matoto. Toute tentative d examen d un dossier de Kaloum ou d une autre commune est automatiquement bloquée par le middleware de sécurité (HTTP 403).
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // ROLE 4: FIELD AGENT (L1 - MATOTO) DASHBOARD
  // --------------------------------------------------------------------------
  if (currentUser.role === 'AGENT_TERRAIN') {
    const agentStats = [
      {
        title: 'Mes Enrôlements Soumis',
        value: '18 Dossiers',
        subtitle: 'Chauffeurs enregistrés',
        icon: UserPlus,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
      },
      {
        title: 'En Cours d Instruction L2',
        value: '4 Dossiers',
        subtitle: 'En attente avis Chef Matoto',
        icon: Clock,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
      },
      {
        title: 'Nécessitant Correction',
        value: '1 Dossier',
        subtitle: 'Prêt pour resoumission',
        icon: AlertTriangle,
        color: 'text-rose-600',
        bgColor: 'bg-rose-50',
      },
      {
        title: 'Badges Validés & Prêts',
        value: '13 Titres',
        subtitle: 'Disponibles pour délivrance',
        icon: IdCard,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
      },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <img
              src="/logo-guinee.png"
              alt="Logo"
              className="w-12 h-12 rounded-full object-contain p-0.5 border border-slate-200 shadow-sm flex-shrink-0"
            />
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                GUICHET D ENRÔLEMENT TERRAIN • NIVEAU 1
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Espace Opérationnel Agent — {currentUser.name}
              </h1>
              <p className="text-xs text-slate-500">
                Enregistrement des chauffeurs, téléversement des pièces justificatives avec contrôle magic-bytes et soumission.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigateTo('enrolment')}
            className="w-full sm:w-auto justify-center flex items-center space-x-2 bg-[#CE1126] hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer min-h-[44px]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nouvel Enrôlement Chauffeur</span>
          </button>
        </div>

        {/* 4 Agent Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {agentStats.map((st, idx) => {
            const Icon = st.icon;
            return (
              <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">{st.title}</span>
                  <div className={`p-2 rounded-lg ${st.bgColor} ${st.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl font-black text-slate-900">{st.value}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{st.subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
          <div className="font-bold">Habilitation Opérationnelle Active (L1) :</div>
          <p className="text-slate-600 leading-relaxed">
            Vous pouvez saisir et modifier les dossiers d enrôlement de Matoto, téléverser les photos et permis biométriques, et soumettre les dossiers complets au Chef de Service. Vous ne disposez pas des boutons d approbation ou de rejet (réservés à la hiérarchie).
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // ROLE 5: AUTHORIZED DISTRIBUTOR (TICKETING) DASHBOARD
  // --------------------------------------------------------------------------
  if (currentUser.role === 'DISTRIBUTEUR') {
    const distStats = [
      {
        title: 'Tickets Vendus Aujourd hui',
        value: '48 Tickets',
        subtitle: 'Guichet Kaloum Express',
        icon: Ticket,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
      },
      {
        title: 'Recettes Totales du Jour',
        value: '96 000 GNF',
        subtitle: 'Encaissements certifiés',
        icon: Wallet,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
      },
      {
        title: 'Paiements Mobile Money',
        value: '68% (Orange / MTN)',
        subtitle: 'Paiements sans contact',
        icon: Receipt,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
      },
      {
        title: 'Carnets en Stock de Vente',
        value: '1 Lot Alloué',
        subtitle: 'Reste 34 tickets sur 100',
        icon: Clock,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
      },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <img
              src="/logo-guinee.png"
              alt="Logo"
              className="w-12 h-12 rounded-full object-contain p-0.5 border border-slate-200 shadow-sm flex-shrink-0"
            />
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                RÉGIE DE BILLETTERIE AGRÉÉE • GUICHET KALOUUM
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Espace de Vente & Encaissement POS
              </h1>
              <p className="text-xs text-slate-500">
                Émission des tickets de transport urbain, encaissement en GNF et génération de reçus électroniques.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigateTo('ticketing')}
            className="w-full sm:w-auto justify-center flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer min-h-[44px]"
          >
            <Receipt className="w-4 h-4" />
            <span>Ouvrir le Guichet POS</span>
          </button>
        </div>

        {/* 4 Distributor Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {distStats.map((st, idx) => {
            const Icon = st.icon;
            return (
              <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">{st.title}</span>
                  <div className={`p-2 rounded-lg ${st.bgColor} ${st.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl font-black text-slate-900">{st.value}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{st.subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Conakry Interactive GIS Map Widget for Distributor */}
        <ConakryMapWidget
          currentUser={currentUser}
          height="380px"
          onOpenFullMap={() => navigateTo('mapping')}
          title="Réseau Urbain de Conakry & Points de Desserte Billetterie"
          subtitle="Localisation des stations de correspondance et lignes de transport urbain desservies par le réseau de billetterie."
        />

        <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-950 space-y-1">
          <div className="font-bold">Confidentialité & Immuabilité des Encaissements :</div>
          <p className="text-slate-600 leading-relaxed">
            Vous avez accès uniquement à vos propres carnets alloués et à vos transactions enregistrées. Conformément aux principes comptables, les écritures validées sont immuables et ne peuvent être altérées que par contre-passation autorisée.
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // ROLE 1: DIRECTOR GENERAL (L3) & AUTHORITY MINISTERIAL STRATEGIC DASHBOARD
  // --------------------------------------------------------------------------
  const isAuthority = currentUser.role === 'AUTHORITY';

  const directorStats = [
    {
      title: 'Chauffeurs Enrôlés (National)',
      value: '1 428',
      subtitle: '+34 cette semaine',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100',
    },
    {
      title: 'Véhicules Régulés',
      value: '982',
      subtitle: 'Taxis (64%), Magbanas (36%)',
      icon: Car,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-100',
    },
    {
      title: 'Badges CR80 Délivrés',
      value: '1 210',
      subtitle: 'Signés RFC 8032 Ed25519',
      icon: IdCard,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-100',
    },
    {
      title: 'En Attente Décret L3',
      value: '14 Dossiers',
      subtitle: 'Validés par Chefs de Service',
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-100',
      action: !isAuthority ? onOpenValidationQueue : undefined,
    },
  ];

  const communeData = [
    { name: 'Matoto', count: 320, percentage: 22, color: 'bg-emerald-500' },
    { name: 'Ratoma', count: 260, percentage: 18, color: 'bg-blue-500' },
    { name: 'Gbessia', count: 175, percentage: 12, color: 'bg-teal-500' },
    { name: 'Lambanyi', count: 140, percentage: 10, color: 'bg-cyan-500' },
    { name: 'Dixinn', count: 125, percentage: 9, color: 'bg-indigo-500' },
    { name: 'Matam', count: 110, percentage: 8, color: 'bg-amber-500' },
    { name: 'Kaloum', count: 95, percentage: 7, color: 'bg-purple-500' },
    { name: 'Sonfonia', count: 80, percentage: 6, color: 'bg-sky-500' },
    { name: 'Kagbélen', count: 50, percentage: 3, color: 'bg-orange-500' },
    { name: 'Tombolia', count: 42, percentage: 3, color: 'bg-rose-500' },
    { name: 'Sanoyah', count: 30, percentage: 2, color: 'bg-violet-500' },
    { name: 'Manéah', count: 20, percentage: 1, color: 'bg-lime-600' },
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <img
            src="/logo-guinee.png"
            alt="Armoiries de la République de Guinée"
            className="w-12 h-12 rounded-full object-contain p-0.5 border border-slate-200 shadow-sm flex-shrink-0"
          />
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              RÉPUBLIQUE DE GUINÉE • MINISTÈRE DES TRANSPORTS
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <span>
                {isAuthority
                  ? 'Tableau de Bord Stratégique — Hautes Autorités & Ministère'
                  : 'Tableau de Bord Stratégique — Direction Générale AOTUC'}
              </span>
              {isAuthority && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#0B1E36] text-[#FCD116] border border-[#FCD116]/40">
                  Vue Ministérielle
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500">
              {isAuthority
                ? 'Supervision exécutive en lecture seule : indicateurs clés, régulation des transports et couverture territoriale.'
                : 'Supervision exécutive de la régulation des transports, décrets d agrément et émission des titres officiels.'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          {isAuthority ? (
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
              Accès Consultation Exécutive
            </span>
          ) : (
            <button
              onClick={onOpenValidationQueue}
              className="w-full sm:w-auto justify-center flex items-center space-x-2 bg-[#CE1126] hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer min-h-[44px]"
            >
              <span>Examiner les Dossiers Niveau 3</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 4 Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {directorStats.map((stat, idx) => {
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
                <span className="text-xs font-semibold text-slate-600">{stat.title}</span>
                <div className={`p-2 rounded-lg ${stat.bgColor} ${stat.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">{stat.value}</div>
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

      {/* Exclusive Authorities Management Section for Director General */}
      {/* Boss Requirement: "AUTORITÉS — juste tableau de bord du directeur" */}
      <DirectorAuthoritiesWidget
        currentUser={currentUser}
        onNavigateTab={navigateTo}
      />

      {/* Conakry Interactive GIS Map Widget for Executive Director */}
      <ConakryMapWidget
        currentUser={currentUser}
        height="380px"
        onOpenFullMap={() => navigateTo('mapping')}
        title="Cartographie Nationale & Couverture Territoriale (13 Communes)"
        subtitle="Supervision exécutive des corridors autoroutiers et du réseau de transport urbain du Grand Conakry."
      />

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
            <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
              <div className="flex items-start sm:items-center space-x-2.5 min-w-0">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${item.badge}`}>
                  {item.action}
                </span>
                <span className="font-medium text-slate-800 break-words">{item.detail}</span>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4 text-slate-500 text-[11px] shrink-0 pl-1 sm:pl-0">
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
