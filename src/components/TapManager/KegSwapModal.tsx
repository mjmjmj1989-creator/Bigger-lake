import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Beer,
  AlertTriangle,
  Search,
  Package,
  Sparkles,
  Shield,
  Clock,
  ArrowRight,
  Trash2,
  Lock,
  Calendar,
  Zap,
  RefreshCw,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import { Tap, KegFormat, CoolerItem, StaffRole, OnDeckType } from '../../types/taproom';
import { resolveTapOnDeck, ResolvedOnDeck } from '../../utils/onDeckResolver';

interface KegSwapModalProps {
  tap: Tap | null;
  isOpen: boolean;
  onClose: () => void;
  coolerStock: CoolerItem[];
  currentStaff: string;
  currentRole: StaffRole;
  initialManagerMode?: 'SWAP' | 'ASSIGN_ON_DECK';
  onConfirmSwap: (params: {
    tapNumber: number;
    newSku: string;
    newBrand: string;
    newStyle: string;
    newFormat: KegFormat;
    staffMember: string;
    deductCoolerStock: boolean;
    clearOnDeck?: boolean;
  }) => void;
  onAssignOnDeck?: (params: {
    tapNumber: number;
    onDeckSku: string;
    onDeckBrand: string;
    onDeckFormat: KegFormat;
    onDeckStyle: string;
    onDeckType?: OnDeckType;
    onDeckScheduledDate?: string;
    onDeckNotes?: string;
  }) => void;
  onClearOnDeck?: (tapNumber: number) => void;
}

export const KegSwapModal: React.FC<KegSwapModalProps> = ({
  tap,
  isOpen,
  onClose,
  coolerStock,
  currentStaff,
  currentRole,
  initialManagerMode = 'SWAP',
  onConfirmSwap,
  onAssignOnDeck,
  onClearOnDeck,
}) => {
  // Always declare top-level role flags
  const isBartenderView = currentRole === 'Bartender';

  // Safe fallback for resolved on-deck data when modal is unopened or tap is null
  const resolvedOnDeck: ResolvedOnDeck = tap
    ? resolveTapOnDeck(tap, coolerStock)
    : {
        hasOnDeck: false,
        onDeckType: 'NONE',
        isManagerOverride: false,
        badgeLabel: 'No Backup In Cooler',
        badgeType: 'empty',
        statusText: 'No replacement keg in cooler',
        hasCoolerBackup: false,
        backupCount: 0,
      };

  // Manager subtab: 'SWAP' or 'ASSIGN_ON_DECK'
  const [managerMode, setManagerMode] = useState<'SWAP' | 'ASSIGN_ON_DECK'>(initialManagerMode);

  // Manager Configure On-Deck Option: Option A (Immediate) or Option B (Scheduled)
  const [managerOption, setManagerOption] = useState<'IMMEDIATE' | 'SCHEDULED'>(
    tap?.onDeckType === 'SCHEDULED_ROTATION' ? 'SCHEDULED' : 'IMMEDIATE'
  );
  const [scheduledDateInput, setScheduledDateInput] = useState<string>(
    tap?.onDeckScheduledDate || ''
  );
  const [onDeckNotesInput, setOnDeckNotesInput] = useState<string>(tap?.onDeckNotes || '');

  // Bartender emergency override toggle
  const [isBartenderManualOverride, setIsBartenderManualOverride] = useState<boolean>(false);

  // Selection states for manual swap / on-deck assignment
  const [selectedFormat, setSelectedFormat] = useState<KegFormat>(
    resolvedOnDeck.onDeckFormat || tap?.format || '1/2 BBL'
  );
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [deductStock, setDeductStock] = useState<boolean>(true);

  // Reset states when opening modal or changing tap
  useEffect(() => {
    if (tap && isOpen) {
      setManagerMode(initialManagerMode || 'SWAP');
      setManagerOption(tap.onDeckType === 'SCHEDULED_ROTATION' ? 'SCHEDULED' : 'IMMEDIATE');
      setScheduledDateInput(tap.onDeckScheduledDate || '');
      setOnDeckNotesInput(tap.onDeckNotes || '');
      setIsBartenderManualOverride(false);
      setSelectedFormat(resolvedOnDeck.onDeckFormat || tap.format);
      setSelectedSku('');
      setSelectedBrand('');
      setSelectedStyle('');
      setSearchQuery('');
    }
  }, [tap, isOpen, initialManagerMode, resolvedOnDeck.onDeckFormat]);

  if (!isOpen || !tap) return null;

  // Filter cooler stock by selected format and search (Inactive beers strictly excluded)
  const availableKegs = coolerStock.filter((item) => {
    if (item.status === 'Inactive') return false;
    if (item.format !== selectedFormat) return false;
    if (searchQuery.trim() === '') return true;
    const q = searchQuery.toLowerCase();
    return (
      item.brand.toLowerCase().includes(q) ||
      item.style.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q)
    );
  });

  const handleSelectCoolerItem = (item: CoolerItem) => {
    setSelectedSku(item.sku);
    setSelectedBrand(item.brand);
    setSelectedStyle(item.style);
  };

  // 1. Bartender 1-Tap "Confirm Tap On-Deck"
  const handleTapOnDeckNow = () => {
    if (!resolvedOnDeck.hasOnDeck || !resolvedOnDeck.onDeckBrand || !resolvedOnDeck.onDeckSku) return;

    onConfirmSwap({
      tapNumber: tap.tapNumber,
      newSku: resolvedOnDeck.onDeckSku,
      newBrand: resolvedOnDeck.onDeckBrand,
      newStyle: resolvedOnDeck.onDeckStyle || 'Craft Beer',
      newFormat: resolvedOnDeck.onDeckFormat || '1/2 BBL',
      staffMember: currentStaff,
      deductCoolerStock: true,
      clearOnDeck: true, // Clears manager assignment upon tapping so next auto-resolution takes over
    });
    onClose();
  };

  // 2. Manual Swap Execution (Manager or emergency fallback)
  const handleExecuteManualSwap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand) return;

    onConfirmSwap({
      tapNumber: tap.tapNumber,
      newSku: selectedSku || `KEG-${String(tap.tapNumber).padStart(3, '0')}`,
      newBrand: selectedBrand,
      newStyle: selectedStyle || 'Craft Beer',
      newFormat: selectedFormat,
      staffMember: currentStaff,
      deductCoolerStock: deductStock,
      clearOnDeck: false,
    });
    onClose();
  };

  // 3. Manager assigns or schedules On-Deck beer
  const handleSaveManagerOnDeck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand || !onAssignOnDeck) return;

    const assignedType: OnDeckType =
      managerOption === 'SCHEDULED' ? 'SCHEDULED_ROTATION' : 'IMMEDIATE_REPLACEMENT';

    onAssignOnDeck({
      tapNumber: tap.tapNumber,
      onDeckSku: selectedSku || `KEG-${String(tap.tapNumber).padStart(3, '0')}`,
      onDeckBrand: selectedBrand,
      onDeckFormat: selectedFormat,
      onDeckStyle: selectedStyle || 'Craft Beer',
      onDeckType: assignedType,
      onDeckScheduledDate: managerOption === 'SCHEDULED' ? scheduledDateInput.trim() : undefined,
      onDeckNotes: onDeckNotesInput.trim() || undefined,
    });
    onClose();
  };

  // 4. Revert to Automatic Same-Brand Fallback
  const handleRevertToAutoFallback = () => {
    if (onClearOnDeck) {
      onClearOnDeck(tap.tapNumber);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Modal Header */}
        <div className="bg-slate-850 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 font-black text-base flex items-center justify-center shadow-inner">
              #{tap.tapNumber}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white leading-none">
                  Tap #{tap.tapNumber} Line Management
                </h2>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {tap.location} Bar
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Currently pouring: <strong className="text-white">{tap.brand}</strong> ({tap.format} • {tap.style})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Manager Mode Selector: High-Contrast Segmented Control */}
        {!isBartenderView && (
          <div className="bg-slate-900/90 px-5 py-3 border-b border-slate-800">
            <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 gap-1.5 shadow-inner">
              <button
                type="button"
                onClick={() => setManagerMode('SWAP')}
                className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  managerMode === 'SWAP'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-900/40 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800/80'
                }`}
              >
                <Beer className="w-4 h-4" />
                <span>Swap Active Tap Now</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setManagerMode('ASSIGN_ON_DECK');
                  setSelectedBrand('');
                  setSelectedSku('');
                }}
                className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  managerMode === 'ASSIGN_ON_DECK'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-slate-900/40 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800/80'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>Configure On Deck</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: BARTENDER 1-CLICK TAP FLOW                                       */}
        {/* ========================================================================= */}
        {isBartenderView && resolvedOnDeck.hasOnDeck && !isBartenderManualOverride ? (
          <div className="p-6 space-y-6">
            {/* On-Deck Card with Context Badge */}
            <div
              className={`p-5 rounded-2xl border space-y-3.5 shadow-lg ${
                resolvedOnDeck.badgeType === 'scheduled'
                  ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-100'
                  : resolvedOnDeck.badgeType === 'immediate'
                  ? 'bg-amber-950/30 border-amber-500/50 text-amber-100'
                  : 'bg-blue-950/40 border-blue-500/40 text-blue-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 border ${
                    resolvedOnDeck.badgeType === 'scheduled'
                      ? 'bg-indigo-500/30 text-indigo-200 border-indigo-400/40'
                      : resolvedOnDeck.badgeType === 'immediate'
                      ? 'bg-amber-500/30 text-amber-200 border-amber-400/40'
                      : 'bg-blue-500/25 text-blue-200 border-blue-400/30'
                  }`}
                >
                  {resolvedOnDeck.badgeType === 'scheduled' ? (
                    <Calendar className="w-3.5 h-3.5" />
                  ) : resolvedOnDeck.badgeType === 'immediate' ? (
                    <Zap className="w-3.5 h-3.5" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>{resolvedOnDeck.badgeLabel}</span>
                </span>

                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900/90 text-slate-300 border border-slate-700">
                  {resolvedOnDeck.onDeckSku}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Ready to Tap Immediately:
                </span>
                <h3 className="text-2xl font-black text-white leading-tight">
                  {resolvedOnDeck.onDeckBrand}
                </h3>
                <div className="text-xs text-slate-200 mt-1 flex items-center gap-2">
                  <span>{resolvedOnDeck.onDeckStyle}</span>
                  <span>•</span>
                  <span className="font-bold text-amber-300">{resolvedOnDeck.onDeckFormat}</span>
                  {resolvedOnDeck.scheduledDate && (
                    <>
                      <span>•</span>
                      <span className="text-indigo-300 font-semibold">
                        Scheduled: {resolvedOnDeck.scheduledDate}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-2.5 text-xs text-slate-300 border-t border-slate-800/80 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    {resolvedOnDeck.isManagerOverride
                      ? 'Pre-assigned by management override.'
                      : 'Automatically resolved from available cooler backup.'}
                  </span>
                </span>
                {resolvedOnDeck.backupCount > 0 && (
                  <span className="text-blue-300 font-bold text-[11px]">
                    {resolvedOnDeck.backupCount} kegs in cooler
                  </span>
                )}
              </div>
            </div>

            {/* Foolproof 1-Tap Action Button in Bright Amber */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleTapOnDeckNow}
                className="w-full py-4 px-6 rounded-2xl font-black text-base sm:text-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              >
                <Zap className="w-5 h-5 fill-current" />
                <span>Confirm Tap {resolvedOnDeck.onDeckBrand} (1 Click)</span>
              </button>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Deducts 1 keg from cooler and logs to Google Sheet.</span>
                <button
                  type="button"
                  onClick={() => setIsBartenderManualOverride(true)}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Emergency: Choose other keg
                </button>
              </div>
            </div>
          </div>
        ) : isBartenderView && (!resolvedOnDeck.hasOnDeck || isBartenderManualOverride) ? (
          /* Bartender View when NO backup is in cooler (or emergency override requested) */
          <div className="p-5 space-y-4">
            {!resolvedOnDeck.hasOnDeck ? (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border-2 border-rose-500/70 text-xs text-rose-200 flex items-start gap-2.5 shadow-sm">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-bold">No Backup In Cooler</strong>
                  Cooler inventory for <strong className="text-white">{tap.brand}</strong> is at 0. Select an available active replacement keg below to keep the line pouring.
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Manual Cooler Selection (Overrides On-Deck)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBartenderManualOverride(false)}
                  className="font-bold underline text-amber-300 hover:text-white cursor-pointer"
                >
                  Back to 1-Tap On-Deck
                </button>
              </div>
            )}

            <form onSubmit={handleExecuteManualSwap} className="space-y-4">
              {/* Format selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Select Format</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFormat('1/2 BBL');
                      setSelectedBrand('');
                      setSelectedSku('');
                    }}
                    className={`p-3 rounded-xl border text-center font-bold text-xs cursor-pointer ${
                      selectedFormat === '1/2 BBL'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    1/2 BBL (Full Keg)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFormat('1/6 BBL');
                      setSelectedBrand('');
                      setSelectedSku('');
                    }}
                    className={`p-3 rounded-xl border text-center font-bold text-xs cursor-pointer ${
                      selectedFormat === '1/6 BBL'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    1/6 BBL (Sixtel)
                  </button>
                </div>
              </div>

              {/* Search and select from cooler */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-400">Available In Cooler</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder={`Search ${selectedFormat} in cooler...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {availableKegs.map((item) => (
                    <div
                      key={item.sku}
                      onClick={() => handleSelectCoolerItem(item)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                        selectedSku === item.sku
                          ? 'bg-blue-600/30 border-blue-500 text-white ring-1 ring-blue-500'
                          : 'bg-slate-800/60 border-slate-750 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold text-white">{item.brand}</div>
                        <div className="text-xs text-slate-400">
                          {item.style} • <span className="font-mono">{item.sku}</span>
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-850 text-emerald-400 font-extrabold border border-slate-700">
                        {item.count} in cooler
                      </span>
                    </div>
                  ))}
                  {availableKegs.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-800/40 rounded-xl">
                      No {selectedFormat} kegs match search.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedBrand}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 cursor-pointer shadow-md"
                >
                  Confirm Tap Selection
                </button>
              </div>
            </form>
          </div>
        ) : !isBartenderView && managerMode === 'SWAP' ? (
          /* ========================================================================= */
          /* VIEW 2: MANAGER IMMEDIATE TAP SWAP                                        */
          /* ========================================================================= */
          <div className="p-5 space-y-4">
            {/* 1-Click Tap On-Deck Quick Option in Bright Amber */}
            {resolvedOnDeck.hasOnDeck && (
              <div className="p-4 rounded-2xl bg-amber-950/25 border-2 border-amber-500/50 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/40 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>{resolvedOnDeck.badgeLabel}</span>
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900/90 text-slate-300 border border-slate-700">
                    {resolvedOnDeck.onDeckSku}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Ready to Tap Immediately:
                  </span>
                  <div className="text-lg font-black text-white">
                    {resolvedOnDeck.onDeckBrand}{' '}
                    <span className="text-xs text-amber-300 font-bold">
                      ({resolvedOnDeck.onDeckFormat} • {resolvedOnDeck.onDeckStyle})
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTapOnDeckNow}
                  className="w-full py-3.5 px-5 rounded-xl font-black text-sm sm:text-base bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Confirm Tap {resolvedOnDeck.onDeckBrand} (1 Click)</span>
                </button>
              </div>
            )}

            {!resolvedOnDeck.hasOnDeck && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border-2 border-rose-500/70 text-xs text-rose-200 flex items-start gap-2.5 shadow-sm">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-bold">No Backup In Cooler</strong>
                  Cooler inventory for <strong className="text-white">{tap.brand}</strong> is at 0. Select an available replacement keg below to swap line.
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <div className="h-px bg-slate-800 flex-1" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {resolvedOnDeck.hasOnDeck ? 'Or Select Alternate Keg From Cooler' : 'Select Replacement Keg from Cooler'}
              </span>
              <div className="h-px bg-slate-800 flex-1" />
            </div>

            <form onSubmit={handleExecuteManualSwap} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Select Format</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFormat('1/2 BBL');
                    setSelectedBrand('');
                    setSelectedSku('');
                  }}
                  className={`p-3 rounded-xl border text-center font-bold text-xs cursor-pointer ${
                    selectedFormat === '1/2 BBL'
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  1/2 BBL (Full Keg)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFormat('1/6 BBL');
                    setSelectedBrand('');
                    setSelectedSku('');
                  }}
                  className={`p-3 rounded-xl border text-center font-bold text-xs cursor-pointer ${
                    selectedFormat === '1/6 BBL'
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  1/6 BBL (Sixtel)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400">Select Replacement Keg</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={`Search ${selectedFormat} in cooler...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {availableKegs.map((item) => (
                  <div
                    key={item.sku}
                    onClick={() => handleSelectCoolerItem(item)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                      selectedSku === item.sku
                        ? 'bg-blue-600/30 border-blue-500 text-white ring-1 ring-blue-500'
                        : 'bg-slate-800/60 border-slate-750 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold text-white">{item.brand}</div>
                      <div className="text-xs text-slate-400">{item.style} • <span className="font-mono">{item.sku}</span></div>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-850 text-emerald-400 font-extrabold border border-slate-700">
                      {item.count} in cooler
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deductStock}
                  onChange={(e) => setDeductStock(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <span>Deduct 1 keg from cooler inventory</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedBrand}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 cursor-pointer shadow-md"
                >
                  Swap Tap Line Now
                </button>
              </div>
            </div>
          </form>
        </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 3: MANAGER "CONFIGURE ON DECK" CONTROLS (OPTION A & OPTION B)        */
          /* ========================================================================= */
          <form onSubmit={handleSaveManagerOnDeck} className="p-5 space-y-4">
            {/* Header info */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <span>Configure On-Deck Scheduling</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manager overrides take priority over the automatic same-brand cooler fallback.
                </p>
              </div>

              {resolvedOnDeck.isManagerOverride && (
                <button
                  type="button"
                  onClick={handleRevertToAutoFallback}
                  className="px-3 py-1 rounded-xl text-xs font-bold text-rose-300 hover:bg-rose-950/40 border border-rose-500/40 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Revert to automatic same-brand fallback"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Revert to Auto-Fallback</span>
                </button>
              )}
            </div>

            {/* Current Active Resolution Status Card */}
            <div className="p-3 rounded-xl bg-slate-850 border border-slate-750 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold">Active Resolution Status:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase border ${
                    resolvedOnDeck.badgeType === 'scheduled'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      : resolvedOnDeck.badgeType === 'immediate'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : resolvedOnDeck.badgeType === 'auto'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {resolvedOnDeck.badgeLabel}
                </span>
              </div>
              <div className="text-white font-medium">
                {resolvedOnDeck.hasOnDeck ? (
                  <>
                    Target: <strong>{resolvedOnDeck.onDeckBrand}</strong> ({resolvedOnDeck.onDeckFormat})
                    {resolvedOnDeck.scheduledDate ? ` • Scheduled: ${resolvedOnDeck.scheduledDate}` : ''}
                  </>
                ) : (
                  <span className="text-rose-300">0 backup kegs in cooler. No automated replacement assigned.</span>
                )}
              </div>
            </div>

            {/* Mode Switcher: Option A vs Option B with High Contrast Separation */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Configure Mode (Select Strategy)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setManagerOption('IMMEDIATE')}
                  className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                    managerOption === 'IMMEDIATE'
                      ? 'bg-amber-950/40 border-2 border-amber-500 ring-2 ring-amber-500/20 shadow-lg'
                      : 'bg-slate-850 border border-slate-750 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                        managerOption === 'IMMEDIATE'
                          ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      Option A
                    </span>
                    <Zap
                      className={`w-4 h-4 ${
                        managerOption === 'IMMEDIATE' ? 'text-amber-400 fill-current' : 'text-slate-500'
                      }`}
                    />
                  </div>
                  <div className="font-extrabold text-sm text-white">Immediate Replacement</div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Tap an alternate brand immediately as soon as active keg kicks.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setManagerOption('SCHEDULED')}
                  className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                    managerOption === 'SCHEDULED'
                      ? 'bg-indigo-950/40 border-2 border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg'
                      : 'bg-slate-850 border border-slate-750 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                        managerOption === 'SCHEDULED'
                          ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      Option B
                    </span>
                    <Calendar
                      className={`w-4 h-4 ${
                        managerOption === 'SCHEDULED' ? 'text-indigo-400' : 'text-slate-500'
                      }`}
                    />
                  </div>
                  <div className="font-extrabold text-sm text-white">Schedule Next Tapping</div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Queue a specific beer for an upcoming tapping date, weekend, or event.
                  </p>
                </button>
              </div>
            </div>

            {/* Contextual Mode Detail Banner */}
            {managerOption === 'IMMEDIATE' ? (
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0 fill-current" />
                <span>
                  <strong>Immediate Mode:</strong> Selected beer becomes the 1-click on-deck replacement for when this keg blows.
                </span>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-indigo-950/40 border-2 border-indigo-500/50 space-y-2 shadow-inner">
                <div className="flex items-center gap-2 text-xs font-black text-indigo-200 uppercase tracking-wider">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span>Scheduled Rotation Date or Event Label</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Next Friday Happy Hour, Weekend Feature, or 2026-10-10"
                  value={scheduledDateInput}
                  onChange={(e) => setScheduledDateInput(e.target.value)}
                  className="w-full bg-slate-900 border border-indigo-500/60 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                />
              </div>
            )}

            {/* Format selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Select Format</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFormat('1/2 BBL');
                    setSelectedBrand('');
                    setSelectedSku('');
                  }}
                  className={`p-2.5 rounded-xl border text-center font-bold text-xs cursor-pointer ${
                    selectedFormat === '1/2 BBL'
                      ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  1/2 BBL (Full Keg)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFormat('1/6 BBL');
                    setSelectedBrand('');
                    setSelectedSku('');
                  }}
                  className={`p-2.5 rounded-xl border text-center font-bold text-xs cursor-pointer ${
                    selectedFormat === '1/6 BBL'
                      ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  1/6 BBL (Sixtel)
                </button>
              </div>
            </div>

            {/* Search and select from cooler */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400">
                Choose Beer from Cooler Stock
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={`Search ${selectedFormat} in cooler...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {availableKegs.map((item) => (
                  <div
                    key={item.sku}
                    onClick={() => handleSelectCoolerItem(item)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                      selectedSku === item.sku
                        ? 'bg-purple-600/30 border-purple-500 text-white ring-1 ring-purple-500'
                        : 'bg-slate-800/60 border-slate-750 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold text-white">{item.brand}</div>
                      <div className="text-xs text-slate-400">
                        {item.style} • <span className="font-mono">{item.sku}</span>
                      </div>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-850 text-purple-300 font-extrabold border border-slate-700">
                      {item.count} in cooler
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rotation Notes (optional)</label>
              <input
                type="text"
                placeholder="e.g. VIP keg hold, tap after cleaning cycle..."
                value={onDeckNotesInput}
                onChange={(e) => setOnDeckNotesInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Save Buttons */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedBrand}
                className={`px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white disabled:opacity-40 cursor-pointer shadow-md flex items-center gap-1.5 ${
                  managerOption === 'SCHEDULED'
                    ? 'bg-indigo-600 hover:bg-indigo-500'
                    : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                {managerOption === 'SCHEDULED' ? (
                  <>
                    <Calendar className="w-4 h-4" />
                    <span>Save as Scheduled Rotation</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Save as Immediate Replacement</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
