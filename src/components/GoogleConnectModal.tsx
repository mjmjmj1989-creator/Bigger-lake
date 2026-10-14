import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  RefreshCw,
  LogOut,
  Layers,
  Sparkles,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { SpreadsheetConfig } from '../types/taproom';
import { createMasterSpreadsheet, SHEET_NAMES } from '../services/sheetsService';
import { QueueState } from '../services/syncQueue';

interface GoogleConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
  isLoggingIn: boolean;
  spreadsheetConfig: SpreadsheetConfig;
  onUpdateSpreadsheetConfig: (config: SpreadsheetConfig) => void;
  queueState: QueueState;
  onTriggerSync: (overrideConfig?: SpreadsheetConfig) => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

export const GoogleConnectModal: React.FC<GoogleConnectModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onGoogleSignIn,
  onGoogleSignOut,
  isLoggingIn,
  spreadsheetConfig,
  onUpdateSpreadsheetConfig,
  queueState,
  onTriggerSync,
  getAccessToken,
}) => {
  const [sheetInput, setSheetInput] = useState(spreadsheetConfig.spreadsheetId || '');
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync sheet input and reset messages when modal is opened or config updates
  React.useEffect(() => {
    if (isOpen) {
      setSheetInput(spreadsheetConfig.spreadsheetId || '');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, spreadsheetConfig.spreadsheetId]);

  if (!isOpen) return null;

  // Extract spreadsheet ID from url or raw ID
  const extractSpreadsheetId = (input: string): string => {
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  };

  const handleConnectExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const id = extractSpreadsheetId(sheetInput);
    if (!id) {
      setErrorMessage('Please enter a valid Google Spreadsheet ID or URL.');
      return;
    }

    const newConfig: SpreadsheetConfig = {
      spreadsheetId: id,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${id}/edit`,
      title: 'Connected Taproom Master Sheet',
      lastSyncedAt: new Date().toISOString(),
      autoSync: true,
    };

    // Immediately persist to localStorage for resilience across reloads and rebuilds
    try {
      localStorage.setItem('tapflow_sheet_config_v1', JSON.stringify(newConfig));
      localStorage.setItem('tapflow_spreadsheet_id', id);
    } catch (err) {
      console.warn('Failed to persist sheet config to localStorage', err);
    }

    onUpdateSpreadsheetConfig(newConfig);
    setSuccessMessage('Successfully connected spreadsheet! Initializing sync...');
    try {
      await onTriggerSync(newConfig);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sync with connected sheet.');
    }
  };

  const handleDisconnect = () => {
    const emptyConfig: SpreadsheetConfig = {
      spreadsheetId: '',
      spreadsheetUrl: '',
      title: 'Taproom Master Inventory',
      autoSync: true,
    };
    try {
      localStorage.removeItem('tapflow_sheet_config_v1');
      localStorage.removeItem('tapflow_spreadsheet_id');
    } catch (err) {
      console.warn('Failed to clear sheet config from localStorage', err);
    }
    onUpdateSpreadsheetConfig(emptyConfig);
    setSheetInput('');
    setSuccessMessage('Spreadsheet disconnected.');
  };

  const handleCreateNewSheet = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsCreatingSheet(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Google authentication token not available. Please sign in again.');
      }

      const created = await createMasterSpreadsheet(
        token,
        '🍻 Taproom Master Inventory & Operations'
      );

      const newConfig: SpreadsheetConfig = {
        spreadsheetId: created.spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
        title: created.properties.title,
        lastSyncedAt: new Date().toISOString(),
        autoSync: true,
      };

      // Immediately persist to localStorage
      try {
        localStorage.setItem('tapflow_sheet_config_v1', JSON.stringify(newConfig));
        localStorage.setItem('tapflow_spreadsheet_id', created.spreadsheetId);
      } catch (err) {
        console.warn('Failed to persist sheet config to localStorage', err);
      }

      onUpdateSpreadsheetConfig(newConfig);
      setSheetInput(created.spreadsheetId);
      setSuccessMessage('Created & pre-populated master taproom spreadsheet in your Google Drive!');
      await onTriggerSync(newConfig);
    } catch (err: any) {
      console.error('Error creating spreadsheet:', err);
      setErrorMessage(err.message || 'Failed to create spreadsheet.');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="bg-slate-850 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Google Sheets Master Backend</h2>
              <p className="text-xs text-slate-400">Direct real-time link to your taproom spreadsheet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Section 1: Authentication State */}
          <div className="bg-slate-850 p-4 rounded-xl border border-slate-750">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              1. Google Account Connection
            </label>

            {currentUser ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'Google User'}
                      className="w-10 h-10 rounded-full border border-slate-700"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center">
                      {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-sm text-white">{currentUser.displayName || 'Google User'}</div>
                    <div className="text-xs text-slate-400">{currentUser.email}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onGoogleSignOut}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sign in with your Google account to read and update master spreadsheet tabs directly from the bar.
                </p>

                {/* Official Sign in with Google Button styled as per workspace skill */}
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 font-semibold px-4 py-2.5 rounded-xl border border-slate-300 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                  <span>{isLoggingIn ? 'Connecting to Google...' : 'Sign in with Google'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Master Spreadsheet Connection */}
          <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              2. Master Spreadsheet Setup
            </label>

            {/* Currently Connected Banner */}
            {spreadsheetConfig.spreadsheetId ? (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Active Master Spreadsheet Connected</span>
                  </div>
                  <a
                    href={spreadsheetConfig.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold hover:underline"
                  >
                    <span>Open Sheet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="text-xs text-slate-300 font-mono bg-slate-950/70 p-2 rounded border border-slate-800 truncate">
                  ID: {spreadsheetConfig.spreadsheetId}
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                  <span>
                    Queue: <strong>{queueState.pendingCount} pending</strong> ({queueState.status})
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onTriggerSync()}
                      className="text-amber-400 hover:text-amber-300 font-medium hover:underline cursor-pointer"
                    >
                      Force Sync Now
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="text-rose-400 hover:text-rose-300 font-medium hover:underline cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Action A: 1-Click Auto-Create Master Spreadsheet */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>1-Click: Create Master Taproom Spreadsheet</span>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Automatically builds the spreadsheet in your Google Drive with all 6 live master tabs:
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300 font-medium py-1">
                <span className="flex items-center gap-1">🍻 On-Tap & Line Flow</span>
                <span className="flex items-center gap-1">📦 Cooler & Draft Inventory</span>
                <span className="flex items-center gap-1">🥃 Master Spirits Catalog</span>
                <span className="flex items-center gap-1">🍻 Keg Change Log</span>
                <span className="flex items-center gap-1">🥃 Spirit Removals Log</span>
                <span className="flex items-center gap-1">🏷️ Keg Deposits</span>
              </div>
              <button
                type="button"
                onClick={handleCreateNewSheet}
                disabled={isCreatingSheet}
                className="w-full mt-2 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all disabled:opacity-50"
              >
                {isCreatingSheet ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating & Formatting Tabs...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>Create Master Taproom Sheet</span>
                  </>
                )}
              </button>
            </div>

            {/* Action B: Connect Existing Spreadsheet */}
            <form onSubmit={handleConnectExisting} className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300 block">
                Or Paste Existing Spreadsheet ID or URL:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetInput}
                  onChange={(e) => setSheetInput(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-700 hover:bg-slate-600 active:bg-slate-650 text-white cursor-pointer transition-colors"
                >
                  Connect
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-850 px-5 py-3 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-750 hover:bg-slate-700 text-white cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
