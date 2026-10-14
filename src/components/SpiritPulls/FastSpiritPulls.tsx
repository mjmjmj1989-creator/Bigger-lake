import React, { useState, useMemo } from 'react';
import { Wine, Check, Plus, Minus, Search, Sparkles, Clock, Undo2, MapPin, Tag } from 'lucide-react';
import { Station, SpiritRemovalEntry, SpiritItem, StaffRole, isManagerOrSupervisor } from '../../types/taproom';

interface FastSpiritPullsProps {
  currentStaff: string;
  currentRole: StaffRole;
  recentRemovals: SpiritRemovalEntry[];
  spiritsCatalog: SpiritItem[];
  onLogSpiritPull: (entry: {
    station: Station;
    spiritSku: string;
    spiritBrand: string;
    bottleCount: number;
    staffMember: string;
  }) => void;
  onUndoSpiritPull?: (id: string) => void;
  onOpenNewProductModal?: () => void;
}

export const FastSpiritPulls: React.FC<FastSpiritPullsProps> = ({
  currentStaff,
  currentRole,
  recentRemovals,
  spiritsCatalog,
  onLogSpiritPull,
  onUndoSpiritPull,
  onOpenNewProductModal,
}) => {
  const isManager = isManagerOrSupervisor(currentRole);
  const [selectedStation, setSelectedStation] = useState<Station>('Service Well');
  const [selectedSku, setSelectedSku] = useState<string>(
    spiritsCatalog[0]?.sku || 'SPR-001'
  );
  const [bottleCount, setBottleCount] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [lastLoggedMessage, setLastLoggedMessage] = useState<string | null>(null);

  // Custom spirit fallback
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customBrandName, setCustomBrandName] = useState<string>('');
  const [customSku, setCustomSku] = useState<string>('');

  const stations: Station[] = ['Service Well', 'Inside Main Bar', 'Patio Bar'];

  // Accessible spirits: Inactive bottles must NEVER appear in Fast Pick, Station views, or search
  const accessibleSpirits = useMemo(() => {
    return spiritsCatalog.filter((s) => s.status !== 'Inactive');
  }, [spiritsCatalog]);

  // Dynamically extract categories from live spirits catalog
  const categories = useMemo(() => {
    const set = new Set<string>();
    accessibleSpirits.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [accessibleSpirits]);

  // Find currently selected spirit object
  const currentSpirit = useMemo(() => {
    return accessibleSpirits.find((s) => s.sku === selectedSku) || accessibleSpirits[0];
  }, [accessibleSpirits, selectedSku]);

  // Fast pick list: items flagged fastSelect or first 8 items
  const fastMoverBottles = useMemo(() => {
    const flagged = accessibleSpirits.filter((s) => s.fastSelect);
    return flagged.length > 0 ? flagged : accessibleSpirits.slice(0, 8);
  }, [accessibleSpirits]);

  // Filter full catalog by category and search query (name, category, or SKU)
  const filteredCatalog = useMemo(() => {
    return accessibleSpirits.filter((item) => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.brand.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [accessibleSpirits, selectedCategory, searchQuery]);

  const handleLogPull = (
    brandToLog: string = isCustomMode ? customBrandName : (currentSpirit?.brand || 'Spirits'),
    skuToLog: string = isCustomMode ? (customSku || `SPR-CUST-${Date.now().toString().slice(-4)}`) : (currentSpirit?.sku || 'SPR-999'),
    countToLog: number = bottleCount
  ) => {
    if (!brandToLog.trim()) return;

    onLogSpiritPull({
      station: selectedStation,
      spiritSku: skuToLog,
      spiritBrand: brandToLog,
      bottleCount: countToLog,
      staffMember: currentStaff,
    });

    // Instant optimistic feedback banner
    const msg = `Logged ${countToLog}x ${brandToLog} (${skuToLog}) → ${selectedStation}`;
    setLastLoggedMessage(msg);
    setTimeout(() => {
      setLastLoggedMessage((prev) => (prev === msg ? null : prev));
    }, 4000);

    // Reset bottle count to 1 for next pull
    setBottleCount(1);
    if (isCustomMode) {
      setCustomBrandName('');
      setCustomSku('');
      setIsCustomMode(false);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Optimistic Success Toast */}
      {lastLoggedMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-sm font-semibold flex items-center justify-between shadow-lg shadow-emerald-500/10 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <span>{lastLoggedMessage}</span>
          </div>
          <span className="text-xs text-emerald-400/80 font-medium">Logged instantly to Google Sheets</span>
        </div>
      )}

      {/* Main Bar Operations Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
        {/* Step 1: Station Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>1. Select Bar Station</span>
          </label>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {stations.map((st) => {
              const isSelected = selectedStation === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStation(st)}
                  className={`py-3 sm:py-3.5 px-3 rounded-xl border text-center transition-all cursor-pointer select-none font-bold text-xs sm:text-sm ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/40'
                      : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Dynamic Fast Pick Grid (from Master Sheet) */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>2. Fast Pick: High-Velocity Bottles (Live from Sheet)</span>
            </label>
            <button
              type="button"
              onClick={() => setIsCustomMode(!isCustomMode)}
              className="text-xs text-amber-400 hover:text-amber-300 underline font-medium"
            >
              {isCustomMode ? 'Pick from Sheet Catalog' : '+ Custom / Rare Bottle'}
            </button>
          </div>

          {!isCustomMode ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
              {fastMoverBottles.map((bottle) => {
                const isSelected = selectedSku === bottle.sku;
                return (
                  <button
                    key={bottle.sku}
                    type="button"
                    onClick={() => {
                      setSelectedSku(bottle.sku);
                      setIsCustomMode(false);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[76px] ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500 text-white ring-1 ring-amber-500 shadow-sm'
                        : 'bg-slate-800/60 border-slate-750 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold leading-tight line-clamp-2 text-white">
                        {bottle.brand}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-750 px-1.5 py-0.5 rounded border border-slate-700">
                        {bottle.sku}
                      </span>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-amber-400 stroke-[3]" />
                      ) : (
                        <span className="text-[10px] text-slate-400">{bottle.category}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-slate-400 mb-1 block">Spirit Brand / Bottle Name</label>
                  <input
                    type="text"
                    placeholder="e.g. WhistlePig 10 Year Rye"
                    value={customBrandName}
                    onChange={(e) => setCustomBrandName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Custom SKU / Code</label>
                  <input
                    type="text"
                    placeholder="e.g. SPR-CUSTOM"
                    value={customSku}
                    onChange={(e) => setCustomSku(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Bottle Search & Full Sheet Catalog */}
        {!isCustomMode && (
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Or Search Full Spirits Master List ({spiritsCatalog.length} Live Items)
              </label>

              {/* Dynamic Category Pills from Master Sheet */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                {categories.slice(0, 8).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-slate-700 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search spirits by name, SKU, or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {isManager && onOpenNewProductModal && (
                <button
                  type="button"
                  onClick={onOpenNewProductModal}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0"
                  title="Create New Spirit SKU & Add to Google Sheet"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ New Product</span>
                </button>
              )}
            </div>

            {searchQuery.trim() !== '' && (
              <div className="max-h-48 overflow-y-auto space-y-1 bg-slate-850 p-2 rounded-xl border border-slate-750">
                {filteredCatalog.map((bottle) => (
                  <div
                    key={bottle.sku}
                    onClick={() => {
                      setSelectedSku(bottle.sku);
                      setSearchQuery('');
                    }}
                    className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                      selectedSku === bottle.sku
                        ? 'bg-amber-500/20 text-white font-bold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{bottle.brand}</span>
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                        {bottle.sku}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">{bottle.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Panel: Bottle Count & Submit Button */}
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-850/60 p-4 rounded-xl border border-slate-750">
          <div className="flex items-center justify-between sm:justify-start gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Bottle Count:
            </span>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setBottleCount((prev) => Math.max(1, prev - 1))}
                className="w-9 h-9 rounded-lg bg-slate-700 text-slate-200 hover:text-white flex items-center justify-center font-bold transition-colors cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-extrabold text-base text-amber-400">
                {bottleCount}
              </span>
              <button
                type="button"
                onClick={() => setBottleCount((prev) => prev + 1)}
                className="w-9 h-9 rounded-lg bg-slate-700 text-slate-200 hover:text-white flex items-center justify-center font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Big One-Tap Pull Button */}
          <button
            type="button"
            onClick={() => handleLogPull()}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-extrabold text-base sm:text-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer select-none"
          >
            <Wine className="w-5 h-5 stroke-[2.5]" />
            <span>
              Log Bottle Pulled: {isCustomMode ? customBrandName || 'Bottle' : currentSpirit?.brand}
            </span>
          </button>
        </div>
      </div>

      {/* Recent Spirit Removals Stream */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Recent Spirit Removals (Live Log with SKU & Product Name)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Total {recentRemovals.length} entries
          </span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {recentRemovals.slice(0, 8).map((removal) => (
            <div
              key={removal.id}
              className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-amber-400 font-extrabold text-xs flex items-center justify-center shrink-0">
                  {removal.bottleCount}x
                </span>
                <div>
                  <div className="font-semibold text-white leading-tight flex items-center gap-2">
                    <span>{removal.spiritBrand}</span>
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                      {removal.spiritSku}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                    <span className="text-amber-400/90 font-medium">{removal.station}</span>
                    <span>•</span>
                    <span>{removal.staffMember}</span>
                    <span>•</span>
                    <span className="text-slate-500">{removal.timestamp}</span>
                  </div>
                </div>
              </div>

              {onUndoSpiritPull && (
                <button
                  type="button"
                  onClick={() => onUndoSpiritPull(removal.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Undo spirit removal"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
