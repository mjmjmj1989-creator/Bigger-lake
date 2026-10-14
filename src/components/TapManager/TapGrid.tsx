import React, { useState } from 'react';
import {
  Beer,
  Search,
  CheckCircle,
  AlertTriangle,
  ArrowUpDown,
  LayoutGrid,
  ListFilter,
  Check,
  Zap,
  Calendar,
  AlertCircle,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { Tap, KegFormat, CoolerItem, StaffRole, OnDeckType, isManagerOrSupervisor } from '../../types/taproom';
import { resolveTapOnDeck, ResolvedOnDeck } from '../../utils/onDeckResolver';
import { KegSwapModal } from './KegSwapModal';

export type TapSortOption = 'TAP_NUMBER' | 'ALPHABETICAL' | 'STYLE';
export type TapViewMode = 'SLIM_STRIPS' | 'DETAILED_CARDS';

/**
 * Normalizes beer brand names for alphabetical sorting:
 * - Trims and lowercases
 * - Strips leading punctuation, quotes, or symbols
 * - Strips leading articles ("the ", "a ", "an ")
 */
const getBrandSortKey = (brand: string): string => {
  if (!brand) return '';
  let clean = brand.trim().toLowerCase();
  clean = clean.replace(/^["'‘“#]+/, '').trim();
  if (clean.startsWith('the ')) {
    clean = clean.slice(4).trim();
  } else if (clean.startsWith('a ')) {
    clean = clean.slice(2).trim();
  } else if (clean.startsWith('an ')) {
    clean = clean.slice(3).trim();
  }
  return clean;
};

export interface StyleColorAccent {
  borderColor: string;
  pillBg: string;
  pillText: string;
  pillBorder: string;
  hex: string;
}

export const getStyleColorAccent = (style: string = ''): StyleColorAccent => {
  const s = style.toLowerCase();

  // 1. Stout / Porter / Dark Lager: Deep Mahogany / Brown (#78350f)
  if (
    s.includes('stout') ||
    s.includes('porter') ||
    s.includes('dark lager') ||
    s.includes('schwarzbier') ||
    s.includes('dunkel') ||
    s.includes('brown') ||
    s.includes('black')
  ) {
    return {
      borderColor: 'border-l-[#78350f]',
      pillBg: 'bg-[#78350f]/20',
      pillText: 'text-amber-200',
      pillBorder: 'border-[#78350f]/40',
      hex: '#78350f',
    };
  }

  // 2. Sour / Fruited: Magenta / Raspberry (#ec4899)
  if (
    s.includes('sour') ||
    s.includes('fruit') ||
    s.includes('gose') ||
    s.includes('berliner') ||
    s.includes('lambic') ||
    s.includes('wild') ||
    s.includes('tart')
  ) {
    return {
      borderColor: 'border-l-[#ec4899]',
      pillBg: 'bg-[#ec4899]/20',
      pillText: 'text-pink-300',
      pillBorder: 'border-[#ec4899]/40',
      hex: '#ec4899',
    };
  }

  // 3. Cider / Seltzer / Specialty: Emerald / Teal (#14b8a6)
  if (
    s.includes('cider') ||
    s.includes('seltzer') ||
    s.includes('mead') ||
    s.includes('specialty') ||
    s.includes('kombucha')
  ) {
    return {
      borderColor: 'border-l-[#14b8a6]',
      pillBg: 'bg-[#14b8a6]/20',
      pillText: 'text-teal-300',
      pillBorder: 'border-[#14b8a6]/40',
      hex: '#14b8a6',
    };
  }

  // 4. Lager / Pilsner / Helles: Crisp Pale Yellow / Wheat (#eab308)
  if (
    s.includes('lager') ||
    s.includes('pils') ||
    s.includes('helles') ||
    s.includes('blonde') ||
    s.includes('kolsch') ||
    s.includes('kölsch') ||
    s.includes('wheat') ||
    s.includes('hefe') ||
    s.includes('wit') ||
    s.includes('vienna')
  ) {
    return {
      borderColor: 'border-l-[#eab308]',
      pillBg: 'bg-[#eab308]/20',
      pillText: 'text-yellow-300',
      pillBorder: 'border-[#eab308]/40',
      hex: '#eab308',
    };
  }

  // 5. IPA / DIPA / Pale Ale: Amber / Gold (#f59e0b) (default craft beer category)
  return {
    borderColor: 'border-l-[#f59e0b]',
    pillBg: 'bg-[#f59e0b]/20',
    pillText: 'text-amber-300',
    pillBorder: 'border-[#f59e0b]/40',
    hex: '#f59e0b',
  };
};

interface TapGridProps {
  taps: Tap[];
  coolerStock: CoolerItem[];
  currentStaff: string;
  currentRole: StaffRole;
  onSwapKeg: (params: {
    tapNumber: number;
    newSku: string;
    newBrand: string;
    newStyle: string;
    newFormat: KegFormat;
    staffMember: string;
    deductCoolerStock: boolean;
    clearOnDeck?: boolean;
  }) => void;
  onAssignOnDeck: (params: {
    tapNumber: number;
    onDeckSku: string;
    onDeckBrand: string;
    onDeckFormat: KegFormat;
    onDeckStyle: string;
    onDeckType?: OnDeckType;
    onDeckScheduledDate?: string;
    onDeckNotes?: string;
  }) => void;
  onClearOnDeck: (tapNumber: number) => void;
}

export const TapGrid: React.FC<TapGridProps> = ({
  taps,
  coolerStock,
  currentStaff,
  currentRole,
  onSwapKeg,
  onAssignOnDeck,
  onClearOnDeck,
}) => {
  const [selectedTap, setSelectedTap] = useState<Tap | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'SWAP' | 'ASSIGN_ON_DECK'>('SWAP');
  const [filterLocation, setFilterLocation] = useState<
    'ALL' | 'INSIDE' | 'PATIO' | 'LOW_BACKUP' | 'NO_BACKUP'
  >('ALL');
  
  // Requirement: Default initial sort order to Tap # (1–30)
  const [sortBy, setSortBy] = useState<TapSortOption>('TAP_NUMBER');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<TapViewMode>('SLIM_STRIPS');
  
  // Tactical feedback toast for immediate 1-touch swaps
  const [swapToast, setSwapToast] = useState<{ message: string; tapNumber: number } | null>(null);

  const isManager = isManagerOrSupervisor(currentRole);

  const handleOpenSwap = (tap: Tap) => {
    setSelectedTap(tap);
    setModalMode('SWAP');
    setIsModalOpen(true);
  };

  const handleOpenConfigureOnDeck = (tap: Tap, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedTap(tap);
    setModalMode('ASSIGN_ON_DECK');
    setIsModalOpen(true);
  };

  // 1-Touch Tap Action (Immediate execution for iPad touch speed)
  const handleDirectOneTouchSwap = (tap: Tap, onDeck: ResolvedOnDeck) => {
    if (!onDeck.hasOnDeck || !onDeck.onDeckBrand || !onDeck.onDeckSku) return;

    onSwapKeg({
      tapNumber: tap.tapNumber,
      newSku: onDeck.onDeckSku,
      newBrand: onDeck.onDeckBrand,
      newStyle: onDeck.onDeckStyle || tap.style,
      newFormat: onDeck.onDeckFormat || tap.format,
      staffMember: currentStaff,
      deductCoolerStock: true,
      clearOnDeck: onDeck.isManagerOverride,
    });

    setSwapToast({
      message: `Tap #${tap.tapNumber} swapped to ${onDeck.onDeckBrand}!`,
      tapNumber: tap.tapNumber,
    });
    setTimeout(() => {
      setSwapToast((prev) => (prev?.tapNumber === tap.tapNumber ? null : prev));
    }, 2600);
  };

  // Find remaining cooler stock for currently tapped brand & format (excluding Inactive)
  const getRemainingCoolerStock = (tap: Tap) => {
    const item = coolerStock.find(
      (c) =>
        (c.sku === tap.sku || c.brand.toLowerCase() === tap.brand.toLowerCase()) &&
        c.format === tap.format &&
        c.status !== 'Inactive'
    );
    return item ? item.count : 0;
  };

  // Resolve on-deck data for all taps
  const resolvedTapsMap = new Map<number, ResolvedOnDeck>();
  taps.forEach((t) => {
    resolvedTapsMap.set(t.tapNumber, resolveTapOnDeck(t, coolerStock));
  });

  const filteredTaps = taps.filter((tap) => {
    const onDeck = resolvedTapsMap.get(tap.tapNumber)!;
    const backupCount = onDeck && onDeck.hasCoolerBackup ? onDeck.backupCount : 0;

    if (filterLocation === 'INSIDE' && tap.location !== 'Inside') return false;
    if (filterLocation === 'PATIO' && tap.location !== 'Patio') return false;
    if (filterLocation === 'LOW_BACKUP' && backupCount > 1) return false;
    if (filterLocation === 'NO_BACKUP' && backupCount > 0) return false;

    if (searchQuery.trim() === '') return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      tap.brand.toLowerCase().includes(q) ||
      (tap.style || '').toLowerCase().includes(q) ||
      tap.sku.toLowerCase().includes(q) ||
      (onDeck.onDeckBrand || '').toLowerCase().includes(q) ||
      tap.tapNumber.toString() === q.replace('#', '')
    );
  });

  // Sort filtered taps based on user selection (Default: Tap # 1 - 30)
  const sortedTaps = [...filteredTaps].sort((a, b) => {
    if (sortBy === 'ALPHABETICAL') {
      const keyA = getBrandSortKey(a.brand);
      const keyB = getBrandSortKey(b.brand);
      const cmp = keyA.localeCompare(keyB);
      if (cmp !== 0) return cmp;
      return a.tapNumber - b.tapNumber;
    }
    if (sortBy === 'STYLE') {
      const styleA = (a.style || '').trim().toLowerCase();
      const styleB = (b.style || '').trim().toLowerCase();
      const cmp = styleA.localeCompare(styleB);
      if (cmp !== 0) return cmp;
      return getBrandSortKey(a.brand).localeCompare(getBrandSortKey(b.brand));
    }
    // Default: 'TAP_NUMBER' (1 - 30)
    return a.tapNumber - b.tapNumber;
  });

  // Metrics
  let lowBackupCount = 0;
  let noBackupCount = 0;
  taps.forEach((t) => {
    const r = resolvedTapsMap.get(t.tapNumber);
    const backup = r && r.hasCoolerBackup ? r.backupCount : 0;
    if (backup <= 1) lowBackupCount++;
    if (backup === 0) noBackupCount++;
  });

  return (
    <div className="w-full space-y-1.5">
      {/* ========================================================================= */}
      {/* COMPACT STICKY TOOLBAR (Height < 30px, Total with Header < 70px)           */}
      {/* ========================================================================= */}
      <div className="sticky top-[40px] z-20 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800/80 px-1 py-1 flex items-center justify-between gap-1.5 text-xs select-none">
        {/* Left: Quick Location & Status Filters */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setFilterLocation('ALL')}
            className={`h-[24px] px-2 rounded-md font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
              filterLocation === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm font-black'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>All</span>
            <span className="font-mono text-[10px] opacity-75">(30)</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterLocation('INSIDE')}
            className={`h-[24px] px-2 rounded-md font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
              filterLocation === 'INSIDE'
                ? 'bg-blue-600 text-white shadow-sm font-black'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>Inside</span>
            <span className="font-mono text-[10px] opacity-75">(1-26)</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterLocation('PATIO')}
            className={`h-[24px] px-2 rounded-md font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
              filterLocation === 'PATIO'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>Patio</span>
            <span className="font-mono text-[10px] opacity-75">(27-30)</span>
          </button>

          {/* High-Contrast Low Backup (< 2) Alert Chip */}
          <button
            type="button"
            onClick={() => setFilterLocation((prev) => (prev === 'LOW_BACKUP' ? 'ALL' : 'LOW_BACKUP'))}
            className={`h-[24px] px-2 rounded-md font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              filterLocation === 'LOW_BACKUP'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm ring-1 ring-amber-300'
                : 'bg-amber-950/70 text-amber-300 hover:text-white border border-amber-500/60 hover:bg-amber-900/60'
            }`}
            title="Filter taps with depleted or critical cooler reserves (1 or fewer replacement kegs)"
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${filterLocation === 'LOW_BACKUP' ? 'text-slate-950' : 'text-amber-400'}`} />
            <span>Low Backup (&lt; 2)</span>
            <span className={`font-mono text-[10px] font-black px-1 rounded ${
              filterLocation === 'LOW_BACKUP' ? 'bg-slate-950/20 text-slate-950' : 'bg-amber-500/20 text-amber-200'
            }`}>
              {lowBackupCount}
            </span>
          </button>

          {noBackupCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterLocation((prev) => (prev === 'NO_BACKUP' ? 'ALL' : 'NO_BACKUP'))}
              className={`h-[24px] px-2 rounded-md font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                filterLocation === 'NO_BACKUP'
                  ? 'bg-rose-600 text-white shadow-sm font-black'
                  : 'bg-rose-950/50 text-rose-300 hover:text-white border border-rose-900/50'
              }`}
              title="Filter taps with 0 backup kegs in cooler"
            >
              <AlertCircle className="w-3 h-3 text-rose-400" />
              <span>0 Backup</span>
              <span className="font-mono text-[10px] opacity-75">({noBackupCount})</span>
            </button>
          )}
        </div>

        {/* Right: Quick Sort, Compact Search & Optional View Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Sort Toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5 h-[24px]">
            <button
              type="button"
              onClick={() => setSortBy('TAP_NUMBER')}
              className={`px-1.5 h-full rounded text-[10px] font-bold transition-all cursor-pointer ${
                sortBy === 'TAP_NUMBER'
                  ? 'bg-blue-600 text-white font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Sort by Tap Handle # 1-30"
            >
              Tap #
            </button>
            <button
              type="button"
              onClick={() => setSortBy('ALPHABETICAL')}
              className={`px-1.5 h-full rounded text-[10px] font-bold transition-all cursor-pointer ${
                sortBy === 'ALPHABETICAL'
                  ? 'bg-blue-600 text-white font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Sort Alphabetically A-Z"
            >
              A–Z
            </button>
          </div>

          {/* Compact Search Input */}
          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1.5" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-[24px] w-24 sm:w-32 bg-slate-900 border border-slate-800 rounded-md pl-6 pr-1.5 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* View Mode Toggle Button */}
          <button
            type="button"
            onClick={() => setViewMode((prev) => (prev === 'SLIM_STRIPS' ? 'DETAILED_CARDS' : 'SLIM_STRIPS'))}
            className="h-[24px] px-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
            title={viewMode === 'SLIM_STRIPS' ? 'Switch to Detailed Cards' : 'Switch to Zero-Scroll Slim Strips'}
          >
            {viewMode === 'SLIM_STRIPS' ? (
              <LayoutGrid className="w-3 h-3 text-slate-400" />
            ) : (
              <ListFilter className="w-3 h-3 text-blue-400" />
            )}
            <span className="hidden sm:inline text-[10px] font-bold">
              {viewMode === 'SLIM_STRIPS' ? 'Cards' : 'Strips'}
            </span>
          </button>
        </div>
      </div>

      {/* Floating Tactical Swap Feedback Toast */}
      {swapToast && (
        <div className="fixed bottom-3 right-3 z-50 bg-emerald-600 text-white font-bold text-xs px-3 py-2 rounded-xl shadow-2xl border border-emerald-400 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <CheckCircle className="w-4 h-4 text-emerald-100" />
          <span>{swapToast.message}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: ZERO-SCROLL LANDSCAPE LAYOUT (3 columns of 54px-58px slim strips) */}
      {/* ========================================================================= */}
      {viewMode === 'SLIM_STRIPS' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5 w-full">
          {sortedTaps.map((tap) => {
            const onDeck = resolvedTapsMap.get(tap.tapNumber)!;
            const isNoBackup = onDeck.badgeType === 'empty';
            const isPatio = tap.location === 'Patio';
            const styleAccent = getStyleColorAccent(tap.style);

            return (
              <div
                key={tap.tapNumber}
                onClick={() => handleOpenSwap(tap)}
                className={`h-[58px] min-h-[56px] max-h-[60px] pl-2 pr-2.5 py-1 bg-slate-900/95 hover:bg-slate-850 border border-slate-800/90 hover:border-slate-700 border-l-4 rounded-xl flex items-center justify-between gap-2.5 transition-all shadow-sm select-none cursor-pointer group ${
                  isNoBackup ? 'ring-1 ring-rose-500/25 shadow-rose-950/20' : ''
                }`}
                style={{ borderLeftColor: styleAccent.hex }}
                title="Click strip to open full tap manager & options"
              >
                {/* 1. Left: High-Contrast Tap Number Badge (#01 Inside, #27 Patio) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center font-mono font-black shadow-inner border border-slate-700/90 bg-slate-800 shrink-0 transition-colors">
                    <span className={`text-xs sm:text-sm font-black tracking-tight leading-none ${isPatio ? 'text-amber-400' : 'text-sky-300'}`}>
                      #{String(tap.tapNumber).padStart(2, '0')}
                    </span>
                    <span className="text-[7.5px] font-sans font-semibold uppercase tracking-wider text-slate-400 mt-0.5 leading-none">
                      {isPatio ? 'Patio' : 'In'}
                    </span>
                  </div>
                </div>

                {/* 2. Center: Visual Dominance on Beer Names + Subdued Subtitle */}
                <div className="flex-1 min-w-0 pr-1">
                  <div
                    className="text-[15px] sm:text-base lg:text-lg font-black tracking-tight text-white group-hover:text-amber-200 truncate leading-snug"
                    title={tap.brand}
                  >
                    {tap.brand.length > 28 ? `${tap.brand.slice(0, 28)}…` : tap.brand}
                  </div>
                  <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 leading-none mt-0.5 truncate">
                    <span className="truncate max-w-[130px]">{tap.style}</span>
                    <span className="text-slate-600 font-normal">/</span>
                    <span className="shrink-0">{tap.abv || 'N/A'}</span>
                    <span className="text-slate-600 font-normal">/</span>
                    <span className="shrink-0">{tap.format}</span>
                    {onDeck.hasCoolerBackup && onDeck.backupCount === 1 && (
                      <span className="ml-1 text-[10px] font-bold text-amber-400 bg-amber-950/70 border border-amber-500/40 px-1 py-0.5 rounded leading-none shrink-0">
                        1 backup
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Right: Subdued Compact Action Pill */}
                <div className="shrink-0 flex items-center">
                  {onDeck.hasOnDeck && onDeck.onDeckBrand && onDeck.onDeckSku ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDirectOneTouchSwap(tap, onDeck);
                      }}
                      className={`h-[30px] px-2.5 rounded-lg border font-bold text-[11px] flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-sm shrink-0 whitespace-nowrap ${
                        onDeck.badgeType === 'scheduled'
                          ? 'bg-indigo-950/70 hover:bg-indigo-900/90 border-indigo-500/40 text-indigo-300 hover:text-white'
                          : 'bg-emerald-950/70 hover:bg-emerald-900/90 border-emerald-500/40 text-emerald-300 hover:text-white'
                      }`}
                      title={`1-Touch Swap: Tap ${onDeck.onDeckBrand}`}
                    >
                      <span className={onDeck.badgeType === 'scheduled' ? 'text-indigo-400 font-black text-xs' : 'text-emerald-400 font-black text-xs'}>➔</span>
                      <span>{onDeck.badgeType === 'scheduled' ? 'Tap Rotation' : 'Tap Backup'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSwap(tap);
                      }}
                      className="h-[30px] px-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-400 hover:text-slate-200 font-semibold text-[11px] flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
                      title="No backup keg in cooler. Tap to select a replacement."
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                      <span>➔ Swap</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW 2: DETAILED CARDS VIEW (Optional diagnostic layout)                 */
        /* ========================================================================= */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {sortedTaps.map((tap) => {
            const coolerCount = getRemainingCoolerStock(tap);
            const isCriticallyLow = coolerCount === 0;
            const isLow = coolerCount === 1;
            const onDeck = resolvedTapsMap.get(tap.tapNumber)!;
            const isNoBackup = onDeck.badgeType === 'empty';
            const styleAccent = getStyleColorAccent(tap.style);

            return (
              <div
                key={tap.tapNumber}
                onClick={() => handleOpenSwap(tap)}
                className={`group relative bg-slate-900 hover:bg-slate-850 border border-l-4 rounded-2xl p-4 transition-all duration-150 shadow-md hover:shadow-xl hover:shadow-blue-500/5 cursor-pointer flex flex-col justify-between ${
                  isNoBackup
                    ? 'border-rose-900/60 hover:border-rose-500/70 shadow-rose-950/20'
                    : 'border-slate-800 hover:border-blue-500/50'
                }`}
                style={{ borderLeftColor: styleAccent.hex }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 group-hover:border-blue-500/50 group-hover:bg-blue-600/20 text-blue-400 font-extrabold text-sm flex items-center justify-center transition-colors">
                        #{tap.tapNumber}
                      </span>
                      <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/60">
                        {tap.location}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                        {tap.sku}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          tap.format === '1/2 BBL'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                        }`}
                      >
                        {tap.format}
                      </span>

                      {isManager && (
                        <button
                          type="button"
                          onClick={(e) => handleOpenConfigureOnDeck(tap, e)}
                          title="Configure On-Deck Scheduling & Overrides"
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-purple-900/50 text-slate-400 hover:text-purple-300 border border-slate-700 hover:border-purple-500/50 flex items-center justify-center transition-all cursor-pointer ml-0.5"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mb-3.5 pb-3 border-b border-slate-800/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Active on Tap:
                    </span>
                    <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors line-clamp-1 leading-snug">
                      {tap.brand}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <span>{tap.style}</span>
                      {tap.abv && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="font-semibold text-slate-300">{tap.abv}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mb-3">
                    {onDeck.hasOnDeck ? (
                      <div
                        className={`p-2.5 rounded-xl border flex flex-col gap-1 shadow-inner transition-colors ${
                          onDeck.badgeType === 'scheduled'
                            ? 'bg-indigo-950/40 border-indigo-500/50'
                            : onDeck.badgeType === 'immediate'
                            ? 'bg-amber-950/30 border-amber-500/50'
                            : 'bg-slate-950/70 border-slate-750'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider">
                          <span
                            className={`flex items-center gap-1 ${
                              onDeck.badgeType === 'scheduled'
                                ? 'text-indigo-300'
                                : onDeck.badgeType === 'immediate'
                                ? 'text-amber-300'
                                : 'text-blue-300'
                            }`}
                          >
                            {onDeck.badgeType === 'scheduled' ? (
                              <Calendar className="w-3.5 h-3.5" />
                            ) : onDeck.badgeType === 'immediate' ? (
                              <Zap className="w-3.5 h-3.5" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            <span>{onDeck.badgeLabel}</span>
                          </span>
                          <div className="flex items-center gap-1 font-mono text-[10px]">
                            <span className="px-1.5 py-0.2 rounded bg-slate-900/80 border border-slate-700 text-slate-300">
                              {onDeck.onDeckFormat}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="text-xs font-bold text-white truncate">
                            {onDeck.onDeckBrand}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                            {onDeck.hasCoolerBackup ? `${onDeck.backupCount} in cooler` : 'No backup'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl border border-rose-900/40 bg-rose-950/20 text-rose-300 text-xs flex items-center justify-between">
                        <span>No backup keg in cooler</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">
                    Stock: <strong className={isCriticallyLow ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'}>{coolerCount}</strong>
                  </span>

                  {onDeck.hasOnDeck && onDeck.onDeckBrand ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDirectOneTouchSwap(tap, onDeck);
                      }}
                      className="h-8 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 hover:text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <span>➔ Tap {onDeck.onDeckBrand}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSwap(tap);
                      }}
                      className="h-8 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-[11px] cursor-pointer"
                    >
                      Swap Line
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Keg Swap & On-Deck Manager Modal */}
      <KegSwapModal
        tap={selectedTap}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        coolerStock={coolerStock}
        currentStaff={currentStaff}
        currentRole={currentRole}
        initialManagerMode={modalMode}
        onConfirmSwap={onSwapKeg}
        onAssignOnDeck={onAssignOnDeck}
        onClearOnDeck={onClearOnDeck}
      />
    </div>
  );
};
