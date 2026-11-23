import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building,
  UserPlus,
  ArrowUpRight,
  BadgeCheck,
  Clock,
  Phone,
  User,
} from 'lucide-react';
import { UserContext } from '../../types';
import { buildApiUrl, getStoredAuthToken } from '../../utils/api';

interface DirectorAuthoritiesWidgetProps {
  currentUser: UserContext;
  onNavigateTab: (tab: string) => void;
  onOpenRegisterAuthority?: () => void;
}

interface AuthorityKpiData {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  institutionsCount: number;
  recent: Array<{
    id: string;
    fullName: string;
    fonction: string;
    institution: string;
    photoUrl?: string | null;
    status: string;
    phoneNumber?: string | null;
    commune?: { name: string } | null;
  }>;
}

export const DirectorAuthoritiesWidget: React.FC<DirectorAuthoritiesWidgetProps> = ({
  currentUser,
  onNavigateTab,
  onOpenRegisterAuthority,
}) => {
  // STRICT SECURITY & RBAC ENFORCEMENT:
  // "AUTORITÉS — juste tableau de bord du directeur"
  // Must render ONLY for DIRECTOR role
  if (currentUser.role !== 'DIRECTOR') {
    return null;
  }

  const [data, setData] = useState<AuthorityKpiData>({
    total: 0,
    active: 0,
    pending: 0,
    suspended: 0,
    institutionsCount: 0,
    recent: [],
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchKpis = async () => {
      try {
        const token = getStoredAuthToken();
        const res = await fetch(buildApiUrl('/api/v1/authorities/kpis'), {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.data) {
            setData(json.data);
          }
        }
      } catch {
        // Fallback gracefully without breaking dashboard
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchKpis();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Module Réservé • Direction Générale AOTUC
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>Autorités Administratives & Institutionnelles</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#CE1126] text-white">
                DG Exclusif
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Supervision des corps de contrôle, commandements routiers et juridictions habilitées.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onOpenRegisterAuthority && (
            <button
              onClick={onOpenRegisterAuthority}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-blue-600" />
              <span>Enregistrer</span>
            </button>
          )}

          <button
            onClick={() => onNavigateTab('authorities')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center space-x-1.5 shadow transition cursor-pointer"
          >
            <span>Consulter le Registre</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#FCD116]" />
          </button>
        </div>
      </div>

      {/* 3 Metric Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Autorités Habilitées</div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
              {data.active} / {data.total}
            </div>
            <div className="text-[10px] text-emerald-600 font-medium">Accréditations actives</div>
          </div>
          <BadgeCheck className="w-6 h-6 text-emerald-500" />
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Institutions Partenaires</div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
              {data.institutionsCount}
            </div>
            <div className="text-[10px] text-blue-600 font-medium">Police, Gendarmerie, Mairies</div>
          </div>
          <Building className="w-6 h-6 text-blue-500" />
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase">En Attente Décret</div>
            <div className="text-xl font-black text-amber-600 mt-0.5">
              {data.pending}
            </div>
            <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Dossiers à instruire</div>
          </div>
          <Clock className="w-6 h-6 text-amber-500" />
        </div>
      </div>

      {/* Recent Authorities List */}
      <div>
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
          Dernières Autorités & Officiers Enregistrés
        </div>

        {isLoading ? (
          <div className="py-6 text-center text-xs text-slate-400">Chargement des données...</div>
        ) : data.recent.length === 0 ? (
          <div className="py-5 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/20 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
            Aucune autorité encore enregistrée. Cliquez sur "Enregistrer" pour débuter le recensement.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.recent.map((auth) => (
              <div
                key={auth.id}
                onClick={() => onNavigateTab('authorities')}
                className="py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-lg cursor-pointer transition text-xs"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  {auth.photoUrl ? (
                    <img
                      src={auth.photoUrl}
                      alt={auth.fullName}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                      <User className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {auth.fullName}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {auth.fonction} • <span className="font-medium">{auth.institution}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 flex-shrink-0">
                  {auth.commune && (
                    <span className="hidden sm:inline-block text-[11px] text-slate-600 dark:text-slate-400 font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {auth.commune.name}
                    </span>
                  )}
                  {auth.phoneNumber && (
                    <span className="hidden md:flex items-center space-x-1 text-[11px] text-slate-500">
                      <Phone className="w-3 h-3" />
                      <span>{auth.phoneNumber}</span>
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      auth.status === 'ACTIF'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                    }`}
                  >
                    {auth.status === 'ACTIF' ? 'Actif' : 'En attente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectorAuthoritiesWidget;
