import React, { useState } from 'react';
import {
  History,
  Beer,
  Wine,
  DollarSign,
  Search,
  CheckCircle2,
  Clock,
  Download,
  FileDown,
  Check,
  ChevronDown,
  Archive,
} from 'lucide-react';
import { KegChangeLogEntry, SpiritRemovalEntry, KegDepositEntry, PackagedMovementEntry, StaffRole } from '../../types/taproom';

interface ActivityLogsProps {
  kegChanges: KegChangeLogEntry[];
  spiritRemovals: SpiritRemovalEntry[];
  kegDeposits: KegDepositEntry[];
  packagedMovements?: PackagedMovementEntry[];
  currentRole?: StaffRole;
}

export const ActivityLogs: React.FC<ActivityLogsProps> = ({
  kegChanges,
  spiritRemovals,
  kegDeposits,
  packagedMovements = [],
  currentRole = 'Bartender',
}) => {
  const [logType, setLogType] = useState<
    'KEG_CHANGES' | 'SPIRIT_REMOVALS' | 'DEPOSITS' | 'PACKAGED_MOVEMENTS'
  >('KEG_CHANGES');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const filterKegChanges = kegChanges.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.newBrand || '').toLowerCase().includes(q) ||
      item.newSku.toLowerCase().includes(q) ||
      (item.oldBrand || '').toLowerCase().includes(q) ||
      item.oldSku.toLowerCase().includes(q) ||
      item.staffMember.toLowerCase().includes(q) ||
      item.tapNumber.toString() === q.replace('#', '')
    );
  });

  const filterSpiritRemovals = spiritRemovals.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.spiritBrand.toLowerCase().includes(q) ||
      (item.spiritSku || '').toLowerCase().includes(q) ||
      item.station.toLowerCase().includes(q) ||
      item.staffMember.toLowerCase().includes(q)
    );
  });

  const filterDeposits = kegDeposits.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.customerName.toLowerCase().includes(q) ||
      item.phone.toLowerCase().includes(q) ||
      item.loggedBy.toLowerCase().includes(q)
    );
  });

  const filterPackagedMovements = packagedMovements.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.brand.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.formatPulled.toLowerCase().includes(q) ||
      item.staffMember.toLowerCase().includes(q)
    );
  });

  // Helper to escape values safely for CSV format
  const escapeCsv = (val: any): string => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const triggerDownload = (csvContent: string, fileName: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccessToast(`Exported ${fileName}`);
    setTimeout(() => {
      setDownloadSuccessToast((prev) => (prev === `Exported ${fileName}` ? null : prev));
    }, 4000);
  };

  // Export Keg Changes CSV with both SKU and Product Name
  const exportKegChangesCsv = () => {
    const headers = ['Timestamp', 'Tap #', 'Old SKU', 'Old Product Name', 'New SKU', 'New Product Name', 'Format', 'Staff Member'];
    const rows = kegChanges.map((entry) => [
      escapeCsv(entry.timestamp),
      escapeCsv(entry.tapNumber),
      escapeCsv(entry.oldSku),
      escapeCsv(entry.oldBrand || entry.oldSku),
      escapeCsv(entry.newSku),
      escapeCsv(entry.newBrand || entry.newSku),
      escapeCsv(entry.format),
      escapeCsv(entry.staffMember),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerDownload(csvContent, `tapflow_keg_changes_${dateStr}.csv`);
    setShowExportMenu(false);
  };

  // Export Spirit Removals CSV with both SKU and Product Name
  const exportSpiritRemovalsCsv = () => {
    const headers = ['Timestamp', 'Station', 'Spirit SKU', 'Spirit Product Name', 'Bottle Count', 'Staff Member'];
    const rows = spiritRemovals.map((entry) => [
      escapeCsv(entry.timestamp),
      escapeCsv(entry.station),
      escapeCsv(entry.spiritSku || ''),
      escapeCsv(entry.spiritBrand),
      escapeCsv(entry.bottleCount),
      escapeCsv(entry.staffMember),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerDownload(csvContent, `tapflow_spirit_removals_${dateStr}.csv`);
    setShowExportMenu(false);
  };

  // Export Keg Deposits CSV
  const exportDepositsCsv = () => {
    const headers = ['Date', 'Customer Name', 'Phone', 'Transaction', 'Amount', 'Status', 'Logged By'];
    const rows = kegDeposits.map((entry) => [
      escapeCsv(entry.date),
      escapeCsv(entry.customerName),
      escapeCsv(entry.phone),
      escapeCsv(entry.transaction),
      escapeCsv(`$${entry.amount}`),
      escapeCsv(entry.status),
      escapeCsv(entry.loggedBy),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerDownload(csvContent, `tapflow_keg_deposits_${dateStr}.csv`);
    setShowExportMenu(false);
  };

  // Export All Logs Combined Summary
  const exportAllLogsCsv = () => {
    const dateStr = new Date().toISOString().slice(0, 10);

    const sections = [
      '=== KEG CHANGE LOG (WITH IMMUTABLE SKUS) ===',
      ['Timestamp', 'Tap #', 'Old SKU', 'Old Product Name', 'New SKU', 'New Product Name', 'Format', 'Staff Member'].join(','),
      ...kegChanges.map((entry) =>
        [
          escapeCsv(entry.timestamp),
          escapeCsv(entry.tapNumber),
          escapeCsv(entry.oldSku),
          escapeCsv(entry.oldBrand || entry.oldSku),
          escapeCsv(entry.newSku),
          escapeCsv(entry.newBrand || entry.newSku),
          escapeCsv(entry.format),
          escapeCsv(entry.staffMember),
        ].join(',')
      ),
      '',
      '=== SPIRIT REMOVALS LOG (WITH IMMUTABLE SKUS) ===',
      ['Timestamp', 'Station', 'Spirit SKU', 'Spirit Product Name', 'Bottle Count', 'Staff Member'].join(','),
      ...spiritRemovals.map((entry) =>
        [
          escapeCsv(entry.timestamp),
          escapeCsv(entry.station),
          escapeCsv(entry.spiritSku || ''),
          escapeCsv(entry.spiritBrand),
          escapeCsv(entry.bottleCount),
          escapeCsv(entry.staffMember),
        ].join(',')
      ),
      '',
      '=== KEG DEPOSITS LEDGER ===',
      ['Date', 'Customer Name', 'Phone', 'Transaction', 'Amount', 'Status', 'Logged By'].join(','),
      ...kegDeposits.map((entry) =>
        [
          escapeCsv(entry.date),
          escapeCsv(entry.customerName),
          escapeCsv(entry.phone),
          escapeCsv(entry.transaction),
          escapeCsv(`$${entry.amount}`),
          escapeCsv(entry.status),
          escapeCsv(entry.loggedBy),
        ].join(',')
      ),
    ];

    triggerDownload(sections.join('\n'), `tapflow_master_audit_report_${dateStr}.csv`);
    setShowExportMenu(false);
  };

  // Export Packaged Movements CSV
  const exportPackagedCsv = () => {
    const headers = ['Timestamp', 'SKU', 'Brand / Product', 'Format Pulled', 'Cans Changed', 'Remaining Cans', 'Staff Member'];
    const rows = packagedMovements.map((entry) => [
      escapeCsv(entry.timestamp),
      escapeCsv(entry.sku),
      escapeCsv(entry.brand),
      escapeCsv(entry.formatPulled),
      escapeCsv(entry.cansChanged),
      escapeCsv(entry.remainingCans),
      escapeCsv(entry.staffMember),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerDownload(csvContent, `tapflow_packaged_movements_${dateStr}.csv`);
    setShowExportMenu(false);
  };

  const handleCurrentExport = () => {
    if (logType === 'KEG_CHANGES') exportKegChangesCsv();
    else if (logType === 'SPIRIT_REMOVALS') exportSpiritRemovalsCsv();
    else if (logType === 'DEPOSITS') exportDepositsCsv();
    else exportPackagedCsv();
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Toast notification on successful export */}
      {downloadSuccessToast && (
        <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-lg shadow-emerald-500/10 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <span>{downloadSuccessToast}</span>
          </div>
          <span className="text-xs text-emerald-400 font-medium">Ready for spreadsheet reporting</span>
        </div>
      )}

      {/* Bar Staff Read-Only Notice */}
      {currentRole === 'Bartender' && (
        <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-blue-200 text-xs flex items-center gap-3 shadow-md animate-in fade-in duration-150">
          <Clock className="w-5 h-5 text-blue-400 shrink-0" />
          <div>
            <span className="font-bold text-white">Immutable Audit Trail:</span> Activity logs record real-time operations synced to the Google Sheet. Bar staff cannot edit or delete log entries. Any dispute or inventory reconciliation must be processed by Management.
          </div>
        </div>
      )}

      {/* Control bar: Subtab selection, Search, and CSV Export */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Subtabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setLogType('KEG_CHANGES')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              logType === 'KEG_CHANGES'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Beer className="w-3.5 h-3.5" />
            <span>Keg Changes ({kegChanges.length})</span>
          </button>

          <button
            onClick={() => setLogType('SPIRIT_REMOVALS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              logType === 'SPIRIT_REMOVALS'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Wine className="w-3.5 h-3.5" />
            <span>Spirit Pulls ({spiritRemovals.length})</span>
          </button>

          <button
            onClick={() => setLogType('DEPOSITS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              logType === 'DEPOSITS'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Deposits ({kegDeposits.length})</span>
          </button>

          <button
            onClick={() => setLogType('PACKAGED_MOVEMENTS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              logType === 'PACKAGED_MOVEMENTS'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Packaged Cans ({packagedMovements.length})</span>
          </button>
        </div>

        {/* Search & Export Buttons */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search log history (name, SKU)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* CSV Export Dropdown / Button */}
          <div className="relative">
            <div className="flex items-center rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-slate-950 font-bold shadow-lg shadow-emerald-600/20 transition-all">
              <button
                type="button"
                onClick={handleCurrentExport}
                className="px-3 py-2 text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="Export currently viewed log to CSV"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-1.5 py-2 border-l border-emerald-700/60 hover:bg-emerald-400/30 rounded-r-xl cursor-pointer"
                title="Export options"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Dropdown Menu */}
            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-40 space-y-1">
                <button
                  type="button"
                  onClick={exportKegChangesCsv}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Beer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Keg Changes CSV</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">({kegChanges.length})</span>
                </button>

                <button
                  type="button"
                  onClick={exportSpiritRemovalsCsv}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Wine className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Spirit Pulls CSV</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">({spiritRemovals.length})</span>
                </button>

                <button
                  type="button"
                  onClick={exportDepositsCsv}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Keg Deposits CSV</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">({kegDeposits.length})</span>
                </button>

                <div className="border-t border-slate-800 pt-1">
                  <button
                    type="button"
                    onClick={exportAllLogsCsv}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-amber-300 hover:bg-slate-800 flex items-center gap-2 transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Full Operations Report (All Logs)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Log Content Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        {logType === 'KEG_CHANGES' && (
          <div className="divide-y divide-slate-800/80">
            {filterKegChanges.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No keg changes logged yet.</div>
            ) : (
              filterKegChanges.map((entry) => (
                <div key={entry.id} className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 font-extrabold text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                      #{entry.tapNumber}
                    </span>
                    <div>
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>Tapped:</span>
                        <span className="text-amber-300 font-bold">{entry.newBrand || entry.newSku}</span>
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          {entry.newSku}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                        <span>
                          Replaced: <strong>{entry.oldBrand || entry.oldSku}</strong>{' '}
                          <span className="font-mono text-[10px] text-slate-500">({entry.oldSku})</span>
                        </span>
                        <span>•</span>
                        <span>Format: {entry.format}</span>
                        <span>•</span>
                        <span>By {entry.staffMember}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-400 block">{entry.timestamp}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Logged
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {logType === 'SPIRIT_REMOVALS' && (
          <div className="divide-y divide-slate-800/80">
            {filterSpiritRemovals.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No spirit pulls logged yet.</div>
            ) : (
              filterSpiritRemovals.map((entry) => (
                <div key={entry.id} className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 font-extrabold text-xs flex items-center justify-center shrink-0 border border-cyan-500/30">
                      {entry.bottleCount}x
                    </span>
                    <div>
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>{entry.spiritBrand}</span>
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          {entry.spiritSku}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Station: <span className="text-slate-300 font-medium">{entry.station}</span> • Staff: {entry.staffMember}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-400 block">{entry.timestamp}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Logged
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {logType === 'DEPOSITS' && (
          <div className="divide-y divide-slate-800/80">
            {filterDeposits.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No keg deposits logged yet.</div>
            ) : (
              filterDeposits.map((entry) => (
                <div key={entry.id} className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-8 h-8 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 ${
                        entry.status === 'Active'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      }`}
                    >
                      $30
                    </span>
                    <div>
                      <div className="font-semibold text-white">
                        {entry.customerName} <span className="text-slate-400 font-normal">({entry.phone})</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Transaction: <strong className="text-slate-200">{entry.transaction}</strong> • Logged by: {entry.loggedBy}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-400 block">{entry.date}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        entry.status === 'Active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {entry.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {logType === 'PACKAGED_MOVEMENTS' && (
          <div className="divide-y divide-slate-800/80">
            {filterPackagedMovements.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No packaged movements logged yet.</div>
            ) : (
              filterPackagedMovements.map((entry) => (
                <div key={entry.id} className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-8 h-8 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 ${
                        entry.cansChanged < 0
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {entry.cansChanged > 0 ? `+${entry.cansChanged}` : entry.cansChanged}
                    </span>
                    <div>
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>{entry.brand}</span>
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          {entry.sku}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>Action: <strong className="text-slate-200">{entry.formatPulled}</strong></span>
                        <span>•</span>
                        <span>Stock Remaining: <strong className="text-emerald-400">{entry.remainingCans} cans</strong></span>
                        <span>•</span>
                        <span>Staff: {entry.staffMember}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-400 block">{entry.timestamp}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Logged
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
