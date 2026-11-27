import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  X,
  Check,
  ChevronDown,
  UserCheck,
  MapPin,
  RefreshCw,
  Loader2,
  Phone,
  AlertCircle,
  User,
} from 'lucide-react';
import { AgentItem } from '../../types';

export interface AgentSearchSelectProps {
  label?: string;
  value: string;
  onChange: (agentId: string, agent?: AgentItem | null) => void;
  agents: AgentItem[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  targetCommuneId?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  required?: boolean;
  helperText?: string;
}

export const AgentSearchSelect: React.FC<AgentSearchSelectProps> = ({
  label = 'Agent de terrain désigné',
  value,
  onChange,
  agents = [],
  isLoading = false,
  error = null,
  onRetry,
  targetCommuneId,
  placeholder = 'Rechercher un agent par nom, matricule, commune...',
  allowEmpty = true,
  emptyLabel = 'Assigner plus tard (Mission Planifiée)',
  disabled = false,
  required = false,
  helperText,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Find currently selected agent
  const selectedAgent = useMemo(() => {
    if (!value) return null;
    return agents.find((a) => a.id === value) || null;
  }, [value, agents]);

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const result = agents.filter((agent) => {
      if (!q) return true;
      const fullName = `${agent.firstName} ${agent.lastName}`.toLowerCase();
      const revName = `${agent.lastName} ${agent.firstName}`.toLowerCase();
      const empNo = (agent.employeeNumber || '').toLowerCase();
      const communeName = (agent.commune?.name || '').toLowerCase();
      const communeCode = (agent.commune?.code || '').toLowerCase();
      const phone = (agent.phoneNumber || '').toLowerCase();
      const email = (agent.email || '').toLowerCase();

      return (
        fullName.includes(q) ||
        revName.includes(q) ||
        empNo.includes(q) ||
        communeName.includes(q) ||
        communeCode.includes(q) ||
        phone.includes(q) ||
        email.includes(q)
      );
    });

    // Prioritize agents whose commune matches targetCommuneId, then alphabetically by name
    return result.sort((a, b) => {
      if (targetCommuneId) {
        const aMatch = a.communeId === targetCommuneId;
        const bMatch = b.communeId === targetCommuneId;
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }
      return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
    });
  }, [agents, searchQuery, targetCommuneId]);

  const handleSelect = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId) || null;
    onChange(agentId, agent);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', null);
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-1.5 text-left">
      {/* Label and Status */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {agents.length > 0 && !isLoading && (
          <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">
            {agents.length} agent{agents.length > 1 ? 's' : ''} éligible{agents.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Main Selector Box / Trigger Card */}
      {!selectedAgent ? (
        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all ${
            isOpen
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/20'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex items-center space-x-2.5 truncate">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/80 flex items-center justify-center text-slate-500 flex-shrink-0">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
            </div>
            <div className="truncate">
              {isLoading ? (
                <span className="text-xs text-slate-400">Chargement des agents accrédités...</span>
              ) : (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {allowEmpty ? emptyLabel : 'Sélectionner un agent de terrain...'}
                </span>
              )}
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ml-2 ${
              isOpen ? 'rotate-180 text-emerald-500' : ''
            }`}
          />
        </button>
      ) : (
        /* Selected Agent Display Card */
        <div
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          className={`w-full p-2.5 rounded-xl border border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-600/40 transition-all flex items-center justify-between group ${
            disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:border-emerald-500'
          }`}
        >
          <div className="flex items-center space-x-3 truncate">
            {/* Avatar with status indicator */}
            <div className="relative flex-shrink-0">
              {selectedAgent.avatarUrl ? (
                <img
                  src={selectedAgent.avatarUrl}
                  alt={`${selectedAgent.firstName} ${selectedAgent.lastName}`}
                  className="w-10 h-10 rounded-xl object-cover border border-emerald-500/50 shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-bold text-sm flex items-center justify-center shadow-sm">
                  {selectedAgent.firstName?.charAt(0)}
                  {selectedAgent.lastName?.charAt(0)}
                </div>
              )}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full"
                title="Agent de terrain actif"
              />
            </div>

            {/* Agent Info */}
            <div className="truncate text-left">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {selectedAgent.firstName} {selectedAgent.lastName}
                </span>
                {selectedAgent.employeeNumber && (
                  <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                    {selectedAgent.employeeNumber}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {selectedAgent.commune?.name && (
                  <span className="inline-flex items-center space-x-0.5 text-slate-600 dark:text-slate-300">
                    <MapPin className="w-3 h-3 text-emerald-600 inline" />
                    <span>{selectedAgent.commune.name}</span>
                  </span>
                )}
                {selectedAgent.phoneNumber && (
                  <span className="inline-flex items-center space-x-0.5 text-slate-600 dark:text-slate-300">
                    <Phone className="w-2.5 h-2.5 text-slate-400 inline" />
                    <span>{selectedAgent.phoneNumber}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen((prev) => !prev);
              }}
              className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 transition"
              title="Changer d'agent"
            >
              Changer
            </button>
            {allowEmpty && !required && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition"
                title="Retirer l'agent"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Banner with Retry */}
      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center justify-between text-xs text-red-700 dark:text-red-300">
          <div className="flex items-center space-x-1.5 truncate">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 dark:bg-red-900/60 hover:bg-red-200 text-red-800 dark:text-red-200 flex-shrink-0 ml-2"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Réessayer</span>
            </button>
          )}
        </div>
      )}

      {/* Helper text */}
      {helperText && !error && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{helperText}</p>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List Options */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {/* Optional Unassigned / Deferred Option */}
            {allowEmpty && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={`w-full px-3 py-2.5 flex items-center justify-between text-left transition ${
                  !value
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold">{emptyLabel}</div>
                    <div className="text-[10px] text-slate-400">
                      La mission sera créée avec le statut PLANIFIÉE (DRAFT)
                    </div>
                  </div>
                </div>
                {!value && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 ml-2" />}
              </button>
            )}

            {/* Loading state in dropdown */}
            {isLoading && (
              <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <span>Chargement des agents de terrain...</span>
              </div>
            )}

            {/* Empty states */}
            {!isLoading && agents.length === 0 && (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                <UserCheck className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-1.5" />
                <p className="text-xs font-medium">Aucun agent de terrain accrédité</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Aucun compte AGENT_TERRAIN actif n&apos;est disponible dans ce périmètre territorial.
                </p>
              </div>
            )}

            {!isLoading && agents.length > 0 && filteredAgents.length === 0 && (
              <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                <p className="text-xs">
                  Aucun agent trouvé pour « <span className="font-semibold">{searchQuery}</span> »
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-1 text-[11px] text-emerald-600 hover:underline"
                >
                  Effacer la recherche
                </button>
              </div>
            )}

            {/* Agent Items */}
            {!isLoading &&
              filteredAgents.map((agent) => {
                const isSelected = agent.id === value;
                const isTargetCommune = targetCommuneId && agent.communeId === targetCommuneId;

                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => handleSelect(agent.id)}
                    className={`w-full px-3 py-2 flex items-center justify-between text-left transition ${
                      isSelected
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-medium'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {agent.avatarUrl ? (
                          <img
                            src={agent.avatarUrl}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center">
                            {agent.firstName?.charAt(0)}
                            {agent.lastName?.charAt(0)}
                          </div>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white dark:border-slate-900" />
                      </div>

                      {/* Info */}
                      <div className="truncate">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold truncate">
                            {agent.firstName} {agent.lastName}
                          </span>
                          {agent.employeeNumber && (
                            <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {agent.employeeNumber}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                          {agent.commune?.name ? (
                            <span
                              className={`inline-flex items-center space-x-0.5 ${
                                isTargetCommune
                                  ? 'text-emerald-700 dark:text-emerald-300 font-semibold'
                                  : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <MapPin className="w-2.5 h-2.5 inline" />
                              <span>{agent.commune.name}</span>
                              {isTargetCommune && (
                                <span className="ml-1 px-1 py-0.2 text-[8px] rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                                  Même commune
                                </span>
                              )}
                            </span>
                          ) : (
                            <span>Sans commune</span>
                          )}

                          {agent.phoneNumber && (
                            <span className="text-slate-600 dark:text-slate-300 flex items-center space-x-0.5">
                              <Phone className="w-2.5 h-2.5 inline text-slate-400" />
                              <span>{agent.phoneNumber}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Checkmark indicator */}
                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
          </div>

          {/* Footer with summary */}
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-300">
            <span>
              {filteredAgents.length} agent{filteredAgents.length > 1 ? 's' : ''} affiché
              {filteredAgents.length > 1 ? 's' : ''}
            </span>
            <span className="text-emerald-700 dark:text-emerald-300 font-medium flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span>Rôle AGENT_TERRAIN uniquement</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
