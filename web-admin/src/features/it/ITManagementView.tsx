import React, { useState, useEffect } from 'react';
import {
  Database,
  Server,
  Play,
  RotateCcw,
  Download,
  AlertTriangle,
  CheckCircle2,
  Table,
  RefreshCw,
  Terminal,
  Activity,
  History,
  HardDrive,
  Users,
  Car,
  FileText,
  Shield,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { UserContext } from '../../types';
import { buildApiUrl, getStoredAuthToken, parseApiResponse } from '../../utils/api';

interface ITManagementViewProps {
  currentUser: UserContext;
}

export const ITManagementView: React.FC<ITManagementViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'tables' | 'sql' | 'backups' | 'migrations' | 'diagnostics'>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Overview state
  const [overviewData, setOverviewData] = useState<any>(null);

  // 2. Tables & Schema state
  const [tablesList, setTablesList] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('users');
  const [tableSchema, setTableSchema] = useState<any>(null);
  const [tableRecords, setTableRecords] = useState<any>(null);
  const [recordPage, setRecordPage] = useState(1);
  const [schemaSubTab, setSchemaSubTab] = useState<'data' | 'columns' | 'constraints' | 'indexes'>('data');

  // 3. SQL Console state
  const [sqlQuery, setSqlQuery] = useState("SELECT id, name, label_fr FROM roles ORDER BY name ASC;");
  const [sqlReason, setSqlReason] = useState('');
  const [requireConfirmation, setRequireConfirmation] = useState(false);
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlRunning, setSqlRunning] = useState(false);

  // 4. Backups state
  const [backups, setBackups] = useState<any[]>([]);
  const [backupReason, setBackupReason] = useState('Sauvegarde manuelle avant contrôle de conformité');
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoreFileName, setRestoreFileName] = useState('');
  const [restoreEntityType, setRestoreEntityType] = useState('driver');
  const [restoreReason, setRestoreReason] = useState('');
  const [restoring, setRestoring] = useState(false);

  // 5. Migrations state
  const [migrations, setMigrations] = useState<any[]>([]);

  // 6. Diagnostics state
  const [diagnostics, setDiagnostics] = useState<any>(null);

  const token = getStoredAuthToken();

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  // Fetch overview on mount
  useEffect(() => {
    fetchOverview();
  }, []);

  // Fetch tab-specific data when tab changes
  useEffect(() => {
    setError(null);
    setSuccessMsg(null);
    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'tables') {
      fetchTablesList();
      fetchTableDetails(selectedTable, 1);
    }
    if (activeTab === 'backups') fetchBackups();
    if (activeTab === 'migrations') fetchMigrations();
    if (activeTab === 'diagnostics') fetchDiagnostics();
  }, [activeTab]);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl('/api/v1/it/overview'), { headers: getHeaders() });
      const json = await parseApiResponse(res);
      if (res.ok && json?.data) {
        setOverviewData(json.data);
      } else {
        setError(json?.message || 'Impossible de charger l aperçu IT.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const fetchTablesList = async () => {
    try {
      const res = await fetch(buildApiUrl('/api/v1/it/tables'), { headers: getHeaders() });
      const json = await parseApiResponse(res);
      if (res.ok && json?.data) {
        setTablesList(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTableDetails = async (tableName: string, page = 1) => {
    setLoading(true);
    try {
      const [schemaRes, recordsRes] = await Promise.all([
        fetch(buildApiUrl(`/api/v1/it/tables/${tableName}/schema`), { headers: getHeaders() }),
        fetch(buildApiUrl(`/api/v1/it/tables/${tableName}/records?page=${page}&limit=15`), { headers: getHeaders() }),
      ]);
      const schemaJson = await parseApiResponse(schemaRes);
      const recordsJson = await parseApiResponse(recordsRes);

      if (schemaRes.ok && schemaJson?.data) setTableSchema(schemaJson.data);
      if (recordsRes.ok && recordsJson?.data) setTableRecords(recordsJson.data);
      setRecordPage(page);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTable = (tbl: string) => {
    setSelectedTable(tbl);
    fetchTableDetails(tbl, 1);
  };

  const handleRunSQL = async () => {
    setError(null);
    setSuccessMsg(null);
    setSqlRunning(true);
    try {
      const res = await fetch(buildApiUrl('/api/v1/it/query'), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          query: sqlQuery,
          reason: sqlReason,
          requireConfirmation,
        }),
      });
      const json = await parseApiResponse(res);
      if (res.ok && json?.data) {
        setSqlResult(json.data);
        setSuccessMsg(`Requête exécutée avec succès en ${json.data.executionTimeMs} ms.`);
      } else {
        setError(json?.message || 'Erreur lors de l exécution de la requête SQL.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur serveur');
    } finally {
      setSqlRunning(false);
    }
  };

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl('/api/v1/it/backups'), { headers: getHeaders() });
      const json = await parseApiResponse(res);
      if (res.ok && json?.data) {
        setBackups(json.data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!backupReason.trim()) {
      setError('Un motif de sauvegarde est requis.');
      return;
    }
    setCreatingBackup(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(buildApiUrl('/api/v1/it/backups/create'), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason: backupReason }),
      });
      const json = await parseApiResponse(res);
      if (res.ok && json?.data) {
        setSuccessMsg(`Sauvegarde instantanée réussie : ${json.data.fileName} (${json.data.sizeFormatted})`);
        fetchBackups();
      } else {
        setError(json?.message || 'Échec de la sauvegarde.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreTargeted = async () => {
    if (!restoreFileName) {
      setError('Sélectionnez un fichier de sauvegarde.');
      return;
    }
    if (!restoreReason || restoreReason.trim().length < 5) {
      setError('Le motif de restauration doit comporter au moins 5 caractères.');
      return;
    }
    setRestoring(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(buildApiUrl('/api/v1/it/backups/restore-targeted'), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          backupFileName: restoreFileName,
          entityType: restoreEntityType,
          reason: restoreReason,
        }),
      });
      const json = await parseApiResponse(res);
      if (res.ok && json?.data) {
        setSuccessMsg(json.data.message || 'Restauration ciblée exécutée avec succès.');
        fetchOverview();
      } else {
        setError(json?.message || 'Échec de la restauration.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRestoring(false);
    }
  };

  const fetchMigrations = async () => {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl('/api/v1/it/migrations'), { headers: getHeaders() });
      const json = await parseApiResponse(res);
      if (res.ok && json?.data) {
        setMigrations(json.data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl('/api/v1/it/diagnostics'), { headers: getHeaders() });
      const json = await parseApiResponse(res);
      if (res.ok && json?.data) {
        setDiagnostics(json.data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 bg-red-600/30 border border-red-500/40 text-red-400 font-mono text-xs font-bold rounded-lg uppercase tracking-wider flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-red-400" />
                <span>Privilège IT — Contrôle Informatique</span>
              </span>
              <span className="px-2.5 py-1 bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 font-mono text-xs font-medium rounded-lg flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Supabase PostgreSQL En Ligne</span>
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center space-x-2">
              <Terminal className="w-6 h-6 text-[#CE1126]" />
              <span>Console Technique & Administration Base de Données</span>
            </h1>
            <p className="text-xs text-slate-400">
              Contrôle complet de la plateforme AOTUC-TRANSPORT, intégrité du schéma, sauvegardes ciblées, requêtes SQL sécurisées et traçabilité d audit.
            </p>
            <div className="text-[11px] text-slate-400 font-mono pt-1">
              Opérateur IT habilité : <span className="text-white font-semibold">{currentUser.name}</span> ({currentUser.jobTitle || currentUser.roleLabel})
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                if (activeTab === 'overview') fetchOverview();
                if (activeTab === 'tables') fetchTableDetails(selectedTable, recordPage);
                if (activeTab === 'backups') fetchBackups();
                if (activeTab === 'migrations') fetchMigrations();
                if (activeTab === 'diagnostics') fetchDiagnostics();
              }}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center space-x-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
          </div>
        </div>

        {/* Global Alert Notification */}
        {error && (
          <div className="mt-4 p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-200 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* 2. Top Navigation Tabs */}
      <div className="flex items-center space-x-1 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
        {[
          { id: 'overview', label: 'Vue d Ensemble', icon: Activity },
          { id: 'tables', label: 'Explorateur de Données & Tables', icon: Table },
          { id: 'sql', label: 'Console SQL Sécurisée', icon: Terminal },
          { id: 'backups', label: 'Sauvegardes & Restauration', icon: HardDrive },
          { id: 'migrations', label: 'Migrations Prisma', icon: History },
          { id: 'diagnostics', label: 'Diagnostics & Audit', icon: Server },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. TAB CONTENT */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Utilisateurs', val: overviewData?.counts?.users ?? '...', icon: Users, color: 'text-blue-500' },
              { label: 'Chauffeurs', val: overviewData?.counts?.drivers ?? '...', icon: Users, color: 'text-emerald-500' },
              { label: 'Véhicules', val: overviewData?.counts?.vehicles ?? '...', icon: Car, color: 'text-amber-500' },
              { label: 'Missions Terrain', val: overviewData?.counts?.missions ?? '...', icon: Layers, color: 'text-purple-500' },
              { label: 'Documents Archivés', val: overviewData?.counts?.documents ?? '...', icon: FileText, color: 'text-indigo-500' },
              { label: 'Événements d Audit', val: overviewData?.counts?.auditLogs ?? '...', icon: Shield, color: 'text-rose-500' },
            ].map((m, idx) => {
              const Icon = m.icon;
              return (
                <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider">{m.label}</span>
                    <Icon className={`w-4 h-4 ${m.color}`} />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">{m.val}</div>
                </div>
              );
            })}
          </div>

          {/* Infrastructure Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
                <Database className="w-4 h-4 text-[#CE1126]" />
                <span>Base de Données PostgreSQL</span>
              </div>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Hébergement :</span>
                  <span className="font-semibold text-slate-900 dark:text-white">Supabase (AWS Frankfurt)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Taille disque :</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{overviewData?.database?.size || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Connexions actives :</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{overviewData?.database?.activeConnections || 1}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Extension PostGIS :</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{overviewData?.database?.postgisVersion || 'Active'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
                <Server className="w-4 h-4 text-emerald-500" />
                <span>Serveur d Application AOTUC</span>
              </div>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Moteur d exécution :</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">Node.js {overviewData?.server?.nodeVersion || 'v22'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Plateforme :</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{overviewData?.server?.platform || 'Windows / Hosted'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Disponibilité (Uptime) :</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{Math.floor((overviewData?.server?.uptimeSeconds || 0) / 60)} minutes</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Mémoire Heap utilisée :</span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {overviewData?.server?.memory?.heapUsed ? `${Math.round(overviewData.server.memory.heapUsed / 1024 / 1024)} MB` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
                <Shield className="w-4 h-4 text-purple-500" />
                <span>Séparation Hiérarchique</span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
                <p>
                  <strong className="text-slate-900 dark:text-white">IT :</strong> Contrôle technique et DBA de la plateforme, gestion des comptes, sauvegardes et audits.
                </p>
                <p>
                  <strong className="text-slate-900 dark:text-white">Validation 3 Niveaux :</strong> Préservée (N1 Terrain $\rightarrow$ N2 Chef de Service $\rightarrow$ N3 Directeur Général).
                </p>
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-400 text-[11px]">
                  L administrateur IT ne remplace pas les validateurs métier L2/L3.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TABLE BROWSER & SCHEMA */}
      {activeTab === 'tables' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tables list sidebar */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Tables Publiques ({tablesList.length})
            </div>
            <div className="space-y-1 max-h-[550px] overflow-y-auto pr-1">
              {tablesList.map((t) => (
                <button
                  key={t.table_name}
                  onClick={() => handleSelectTable(t.table_name)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition cursor-pointer flex items-center justify-between ${
                    selectedTable === t.table_name
                      ? 'bg-slate-900 text-white dark:bg-slate-800 shadow-sm'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="truncate">{t.table_name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Table view */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="text-lg font-black text-slate-900 dark:text-white font-mono flex items-center space-x-2">
                  <Table className="w-5 h-5 text-[#CE1126]" />
                  <span>{selectedTable}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {tableSchema?.totalRows ?? 0} enregistrement(s) dans la table
                </div>
              </div>

              {/* Sub tabs: data vs columns vs constraints vs indexes */}
              <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {[
                  { id: 'data', label: 'Données' },
                  { id: 'columns', label: 'Colonnes' },
                  { id: 'constraints', label: 'Clés & Contraintes' },
                  { id: 'indexes', label: 'Index' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setSchemaSubTab(st.id as any)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                      schemaSubTab === st.id
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* DATA VIEW */}
            {schemaSubTab === 'data' && (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl max-h-[460px]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase text-[10px] tracking-wider sticky top-0">
                      <tr>
                        {tableSchema?.columns?.map((c: any) => (
                          <th key={c.column_name} className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                            {c.column_name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {tableRecords?.rows?.map((row: any, rIdx: number) => (
                        <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          {tableSchema?.columns?.map((c: any) => (
                            <td key={c.column_name} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate" title={String(row[c.column_name] ?? '')}>
                              {row[c.column_name] === null ? (
                                <span className="text-slate-400 italic">null</span>
                              ) : typeof row[c.column_name] === 'object' ? (
                                JSON.stringify(row[c.column_name])
                              ) : (
                                String(row[c.column_name])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {(!tableRecords?.rows || tableRecords.rows.length === 0) && (
                        <tr>
                          <td colSpan={tableSchema?.columns?.length || 1} className="text-center py-8 text-slate-400">
                            Aucune ligne dans cette table.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Page {tableRecords?.page || 1} sur {tableRecords?.totalPages || 1}</span>
                  <div className="flex space-x-2">
                    <button
                      disabled={recordPage <= 1}
                      onClick={() => fetchTableDetails(selectedTable, recordPage - 1)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-50 cursor-pointer flex items-center space-x-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Précédent</span>
                    </button>
                    <button
                      disabled={recordPage >= (tableRecords?.totalPages || 1)}
                      onClick={() => fetchTableDetails(selectedTable, recordPage + 1)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-50 cursor-pointer flex items-center space-x-1"
                    >
                      <span>Suivant</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* COLUMNS VIEW */}
            {schemaSubTab === 'columns' && (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Nom Colonne</th>
                      <th className="px-3 py-2">Type SQL</th>
                      <th className="px-3 py-2">Nullable</th>
                      <th className="px-3 py-2">Valeur par défaut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-slate-800 dark:text-slate-200">
                    {tableSchema?.columns?.map((c: any) => (
                      <tr key={c.column_name}>
                        <td className="px-3 py-2 font-bold">{c.column_name}</td>
                        <td className="px-3 py-2 text-indigo-600 dark:text-indigo-400">{c.udt_name || c.data_type}</td>
                        <td className="px-3 py-2">{c.is_nullable === 'YES' ? 'OUI' : 'NON'}</td>
                        <td className="px-3 py-2 text-slate-500">{c.column_default || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* CONSTRAINTS VIEW */}
            {schemaSubTab === 'constraints' && (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Nom Contrainte</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Colonne Locale</th>
                      <th className="px-3 py-2">Table Étrangère</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-slate-800 dark:text-slate-200">
                    {tableSchema?.constraints?.map((c: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">{c.constraint_name}</td>
                        <td className="px-3 py-2 text-amber-600 dark:text-amber-400">{c.constraint_type}</td>
                        <td className="px-3 py-2">{c.column_name}</td>
                        <td className="px-3 py-2 text-blue-600 dark:text-blue-400">{c.foreign_table_name ? `${c.foreign_table_name}(${c.foreign_column_name})` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* INDEXES VIEW */}
            {schemaSubTab === 'indexes' && (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Nom Index</th>
                      <th className="px-3 py-2">Définition SQL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-slate-800 dark:text-slate-200">
                    {tableSchema?.indexes?.map((idx: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300">{idx.indexname}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400 break-all">{idx.indexdef}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SQL CONSOLE */}
      {activeTab === 'sql' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-bold text-sm text-slate-900 dark:text-white">
                <Terminal className="w-4 h-4 text-[#CE1126]" />
                <span>Éditeur SQL Sécurisé (Console IT)</span>
              </div>
              <div className="flex space-x-2">
                {[
                  { label: 'Rôles', query: 'SELECT id, name, label_fr FROM roles ORDER BY name ASC;' },
                  { label: 'Chauffeurs Récents', query: 'SELECT id, nin, first_name, last_name, phone_number, created_at FROM drivers ORDER BY created_at DESC LIMIT 10;' },
                  { label: 'Véhicules', query: 'SELECT id, immatriculation, brand, model, genre FROM vehicles LIMIT 10;' },
                  { label: 'Audit Logs', query: 'SELECT id, action, target_module, reason, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 10;' },
                ].map((sample, i) => (
                  <button
                    key={i}
                    onClick={() => setSqlQuery(sample.query)}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-mono transition cursor-pointer"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              rows={6}
              placeholder="Saisissez votre requête SQL (ex: SELECT * FROM users LIMIT 10;)"
              className="w-full p-3 font-mono text-xs bg-slate-950 text-emerald-400 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-[#CE1126]"
            />

            {/* Mutation Protection Controls */}
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3 text-xs">
              <div className="flex items-start space-x-2 text-amber-800 dark:text-amber-300 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Garde-fous de Production : Les instructions destructives (DROP TABLE, TRUNCATE) sont formellement bloquées. Toute mutation (INSERT, UPDATE, DELETE) exige un motif obligatoire et une confirmation explicite.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Motif technique obligatoire (pour INSERT / UPDATE / DELETE) :
                  </label>
                  <input
                    type="text"
                    value={sqlReason}
                    onChange={(e) => setSqlReason(e.target.value)}
                    placeholder="Ex: Correction manuelle du libellé territorial..."
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center space-x-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={requireConfirmation}
                      onChange={(e) => setRequireConfirmation(e.target.checked)}
                      className="w-4 h-4 text-[#CE1126] rounded border-slate-400"
                    />
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      Je confirme explicitement l impact de cette requête sur la production
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                disabled={sqlRunning}
                onClick={handleRunSQL}
                className="px-5 py-2.5 bg-[#CE1126] hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${sqlRunning ? 'animate-spin' : ''}`} />
                <span>{sqlRunning ? 'Exécution en cours...' : 'Exécuter la Requête SQL'}</span>
              </button>
            </div>
          </div>

          {/* Execution Results */}
          {sqlResult && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-800">
                <span>Résultats ({sqlResult.rowCount} ligne(s) - {sqlResult.queryType})</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">{sqlResult.executionTimeMs} ms</span>
              </div>

              {sqlResult.rows && sqlResult.rows.length > 0 ? (
                <div className="overflow-x-auto max-h-[400px] border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px]">
                      <tr>
                        {Object.keys(sqlResult.rows[0]).map((k) => (
                          <th key={k} className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                            {k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {sqlResult.rows.map((row: any, rIdx: number) => (
                        <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          {Object.keys(sqlResult.rows[0]).map((k) => (
                            <td key={k} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate" title={String(row[k] ?? '')}>
                              {row[k] === null ? (
                                <span className="text-slate-400 italic">null</span>
                              ) : typeof row[k] === 'object' ? (
                                JSON.stringify(row[k])
                              ) : (
                                String(row[k])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-center text-xs text-slate-500 font-mono">
                  {sqlResult.queryType === 'MUTATION'
                    ? `Requête exécutée. Lignes affectées : ${sqlResult.affectedRows}`
                    : 'Aucune ligne retournée.'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BACKUPS & RECOVERY */}
      {activeTab === 'backups' && (
        <div className="space-y-6">
          {/* Create Backup Action Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 font-bold text-sm text-slate-900 dark:text-white">
              <Download className="w-4 h-4 text-emerald-500" />
              <span>Déclencher une Sauvegarde Instantanée de Production</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-3">
                <input
                  type="text"
                  value={backupReason}
                  onChange={(e) => setBackupReason(e.target.value)}
                  placeholder="Motif de la sauvegarde..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
                />
              </div>
              <div>
                <button
                  disabled={creatingBackup}
                  onClick={handleCreateBackup}
                  className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  <Download className={`w-3.5 h-3.5 ${creatingBackup ? 'animate-spin' : ''}`} />
                  <span>{creatingBackup ? 'Génération...' : 'Créer la Sauvegarde'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Targeted Recovery Tool Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 font-bold text-sm text-slate-900 dark:text-white">
              <RotateCcw className="w-4 h-4 text-blue-500" />
              <span>Restauration Ciblée Non Destructive (Targeted Recovery)</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Restaure uniquement les enregistrements manquants depuis une sauvegarde précédente, sans écraser ni supprimer les enregistrements récents ou modifier les missions actives.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Sauvegarde source :
                </label>
                <select
                  value={restoreFileName}
                  onChange={(e) => setRestoreFileName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                >
                  <option value="">-- Choisir une sauvegarde --</option>
                  {backups.map((b) => (
                    <option key={b.fileName} value={b.fileName}>
                      {b.fileName} ({b.sizeFormatted})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Type d entité à restaurer :
                </label>
                <select
                  value={restoreEntityType}
                  onChange={(e) => setRestoreEntityType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                >
                  <option value="driver">Chauffeurs (Driver + Person)</option>
                  <option value="vehicle">Véhicules (Vehicle)</option>
                  <option value="owner">Propriétaires (Owner)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Motif obligatoire :
                </label>
                <input
                  type="text"
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  placeholder="Ex: Restauration ciblée chauffeurs..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                disabled={restoring}
                onClick={handleRestoreTargeted}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${restoring ? 'animate-spin' : ''}`} />
                <span>{restoring ? 'Restauration...' : 'Exécuter la Restauration Ciblée'}</span>
              </button>
            </div>
          </div>

          {/* Backups List Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Fichiers de Sauvegarde Disponibles ({backups.length})
            </div>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">Fichier</th>
                    <th className="px-3 py-2.5">Taille</th>
                    <th className="px-3 py-2.5">Date Création</th>
                    <th className="px-3 py-2.5">Description / Contenu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-slate-800 dark:text-slate-200">
                  {backups.map((b) => (
                    <tr key={b.fileName} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                        <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                        <span>{b.fileName}</span>
                      </td>
                      <td className="px-3 py-2.5">{b.sizeFormatted}</td>
                      <td className="px-3 py-2.5 text-slate-500">{new Date(b.modifiedAt).toLocaleString('fr-FR')}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 font-sans text-xs">
                        {b.metadata?.description || 'Snapshot standard de production'}
                      </td>
                    </tr>
                  ))}
                  {backups.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-slate-400 font-sans">
                        Aucune sauvegarde répertoriée.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: MIGRATIONS */}
      {activeTab === 'migrations' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm">
          <div className="flex items-center space-x-2 font-bold text-sm text-slate-900 dark:text-white">
            <History className="w-4 h-4 text-purple-500" />
            <span>Historique des Migrations Prisma Appliquées</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2.5">Nom Migration</th>
                  <th className="px-3 py-2.5">Date d Application</th>
                  <th className="px-3 py-2.5">Checksum SHA256</th>
                  <th className="px-3 py-2.5">Étapes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {migrations.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-bold text-indigo-600 dark:text-indigo-400">{m.migration_name}</td>
                    <td className="px-3 py-2.5 text-slate-500">{m.finished_at ? new Date(m.finished_at).toLocaleString('fr-FR') : '-'}</td>
                    <td className="px-3 py-2.5 text-slate-400 truncate max-w-[180px]" title={m.checksum}>{m.checksum}</td>
                    <td className="px-3 py-2.5 font-bold text-emerald-600 dark:text-emerald-400">{m.applied_steps_count}</td>
                  </tr>
                ))}
                {migrations.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 font-sans">
                      Aucune migration répertoriée dans _prisma_migrations.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: DIAGNOSTICS & AUDIT */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          {/* Latency & Health */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <div className="text-[11px] font-bold uppercase text-slate-400">Latence Base Supabase</div>
              <div className="text-2xl font-black text-emerald-500 font-mono">
                {diagnostics?.database?.latencyMs ?? '...'} ms
              </div>
              <div className="text-xs text-slate-500">Temps d aller-retour requête ping</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <div className="text-[11px] font-bold uppercase text-slate-400">Processus Node.js</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                PID {diagnostics?.system?.pid ?? '...'}
              </div>
              <div className="text-xs text-slate-500">{diagnostics?.system?.platform} ({diagnostics?.system?.architecture})</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <div className="text-[11px] font-bold uppercase text-slate-400">Mémoire RSS</div>
              <div className="text-2xl font-black text-indigo-500 font-mono">
                {diagnostics?.system?.memory?.rss ? `${Math.round(diagnostics.system.memory.rss / 1024 / 1024)} MB` : '...'}
              </div>
              <div className="text-xs text-slate-500">Allocation mémoire totale résidente</div>
            </div>
          </div>

          {/* Recent Audit Logs */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center space-x-2">
              <Shield className="w-3.5 h-3.5 text-[#CE1126]" />
              <span>Traçabilité & Événements Récents de Sécurité (Audit Logs)</span>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl max-h-[450px]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Action</th>
                    <th className="px-3 py-2.5">Module</th>
                    <th className="px-3 py-2.5">Opérateur (Acteur)</th>
                    <th className="px-3 py-2.5">Motif / Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {diagnostics?.recentAudits?.map((a: any) => (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">{new Date(a.timestamp).toLocaleString('fr-FR')}</td>
                      <td className="px-3 py-2 font-bold text-rose-600 dark:text-rose-400">{a.action}</td>
                      <td className="px-3 py-2 text-indigo-600 dark:text-indigo-400">{a.targetModule}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {a.actor ? `${a.actor.firstName} ${a.actor.lastName} (${a.actor.phoneNumber})` : 'Système'}
                      </td>
                      <td className="px-3 py-2 max-w-[300px] truncate" title={a.reason || ''}>
                        {a.reason || '-'}
                      </td>
                    </tr>
                  ))}
                  {(!diagnostics?.recentAudits || diagnostics.recentAudits.length === 0) && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-400 font-sans">
                        Aucun journal d audit récent.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ITManagementView;
