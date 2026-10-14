import React from 'react';
import {
  Beer,
  Wine,
  DollarSign,
  Archive,
  History,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  Lock,
  Users,
} from 'lucide-react';
import { QueueState } from '../services/syncQueue';
import { SpreadsheetConfig, StaffRole } from '../types/taproom';
import { BigLakeLogo } from './BigLakeLogo';

export type ActiveTab = 'taps' | 'spirits' | 'deposits' | 'cooler' | 'logs';

interface HeaderProps {
  currentRole: StaffRole | null;
  onLock: () => void;
  onOpenStaffModal?: () => void;
  queueState: QueueState;
  spreadsheetConfig: SpreadsheetConfig;
  onOpenGoogleModal: () => void;
  onManualSync: () => void;
  isSyncing: boolean;
  activeTab?: ActiveTab;
  onTabChange?: (tab: ActiveTab) => void;
  pendingDepositsCount?: number;
  lowStockCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onLock,
  onOpenStaffModal,
  queueState,
  spreadsheetConfig,
  onOpenGoogleModal,
  onManualSync,
  isSyncing,
  activeTab = 'taps',
  onTabChange,
  pendingDepositsCount = 0,
  lowStockCount = 0,
}) => {

  const tabs = [
    {
      id: 'taps' as ActiveTab,
      label: 'Taps',
      icon: Beer,
      badge: '30',
      badgeColor: 'bg-blue-500/20 text-blue-300',
    },
    {
      id: 'spirits' as ActiveTab,
      label: 'Spirits',
      icon: Wine,
    },
    {
      id: 'deposits' as ActiveTab,
      label: 'Deposits',
      icon: DollarSign,
      badge: pendingDepositsCount > 0 ? String(pendingDepositsCount) : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-300',
    },
    {
      id: 'cooler' as ActiveTab,
      label: 'Cooler',
      icon: Archive,
      badge: lowStockCount > 0 ? String(lowStockCount) : undefined,
      badgeColor: 'bg-rose-500/20 text-rose-300',
    },
    {
      id: 'logs' as ActiveTab,
      label: 'Logs',
      icon: History,
    },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-sm h-[40px] px-2 sm:px-3 flex items-center justify-between gap-2 overflow-hidden select-none">
      {/* Left: Brand Mark + Integrated Navigation Tabs */}
      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar py-0.5">
        <div className="shrink-0 flex items-center pr-1 sm:pr-2 border-r border-slate-800">
          <BigLakeLogo variant="compact" size="sm" className="h-6 sm:h-7" />
        </div>

        {/* Compact Navigation Tabs (< 30px height) */}
        {onTabChange && (
          <nav className="flex items-center gap-1 shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`h-[28px] px-2 sm:px-2.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all touch-manipulation cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`text-[9px] font-extrabold px-1 py-0.2 rounded font-mono leading-none shrink-0 ${
                        isActive ? 'bg-white/20 text-white' : tab.badgeColor
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Right: Active Status Badge, Lock Button, Google Sync */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Compact Active Status Badge */}
        {currentRole === 'Bartender' ? (
          <div
            className="flex items-center gap-1.5 px-2.5 h-[28px] rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs shadow-sm select-none"
            title="Active Session: Bartender"
          >
            <span>🍺</span>
            <span>Bartender</span>
          </div>
        ) : currentRole ? (
          <div
            className="flex items-center gap-1.5 px-2.5 h-[28px] rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 font-bold text-xs shadow-sm select-none"
            title="Active Session: Manager"
          >
            <span>⚡</span>
            <span>Manager</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onLock}
            className="flex items-center gap-1.5 px-2.5 h-[28px] rounded-lg bg-slate-800 border border-slate-700 text-slate-400 font-bold text-xs cursor-pointer hover:text-white"
          >
            <Lock className="w-3 h-3 text-amber-400" />
            <span>Sign In</span>
          </button>
        )}

        {/* Manager Only: Staff & Permissions PIN Management */}
        {currentRole && currentRole !== 'Bartender' && onOpenStaffModal && (
          <button
            type="button"
            onClick={onOpenStaffModal}
            className="flex items-center gap-1.5 px-2.5 h-[28px] rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer shrink-0"
            title="Manage Staff & Terminal Access PINs"
          >
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Staff</span>
          </button>
        )}

        {/* Lock / Exit button to switch users or lock the screen */}
        <button
          type="button"
          onClick={onLock}
          className="p-1.5 h-[28px] w-[28px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-amber-300 border border-slate-700 transition-colors cursor-pointer shrink-0"
          title="Lock screen / Switch user PIN"
        >
          <Lock className="w-3.5 h-3.5" />
        </button>

        {/* Sync / Google Sheets Status */}
        <button
          type="button"
          onClick={onOpenGoogleModal}
          className={`flex items-center gap-1.5 px-2 h-[28px] rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
            spreadsheetConfig.spreadsheetId
              ? queueState.status === 'error'
                ? 'bg-rose-950/40 border-rose-600/50 text-rose-300'
                : queueState.status === 'syncing' || isSyncing
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                : 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
          }`}
          title="Google Sheets Sync Status & Settings"
        >
          {spreadsheetConfig.spreadsheetId ? (
            <>
              {queueState.status === 'syncing' || isSyncing ? (
                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
              ) : queueState.status === 'error' ? (
                <AlertCircle className="w-3 h-3 text-rose-400" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              )}
              <span className="hidden sm:inline">
                {queueState.status === 'syncing' || isSyncing
                  ? 'Syncing'
                  : queueState.pendingCount > 0
                  ? `${queueState.pendingCount}Q`
                  : 'Sheets'}
              </span>
            </>
          ) : (
            <>
              <Database className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">Connect</span>
            </>
          )}
        </button>

        {spreadsheetConfig.spreadsheetId && (
          <button
            type="button"
            onClick={onManualSync}
            disabled={isSyncing}
            className="p-1 h-[28px] w-[28px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
            title="Force refresh Google Sheets"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
    </header>
  );
};
