import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Beer,
  Wine,
  Sparkles,
  Plus,
  Check,
  Package,
  Layers,
  ShieldCheck,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { CoolerItem, SpiritItem, KegFormat } from '../../types/taproom';
import { SearchableStyleSelect } from '../Common/SearchableStyleSelect';

export type ProductType = 'BEER' | 'SPIRIT';

interface ProductCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: ProductType;
  existingCoolerItems: CoolerItem[];
  existingSpirits: SpiritItem[];
  beerStyles?: string[];
  onAddNewBeerStyle?: (newStyle: string) => void;
  onAddBeer: (beer: CoolerItem & { abv?: string }) => void;
  onAddSpirit: (spirit: SpiritItem) => void;
}

const COMMON_BEER_STYLES = [
  'Hazy IPA',
  'West Coast IPA',
  'Double IPA',
  'German Pilsner',
  'Italian Pilsner',
  'Amber Ale',
  'Oatmeal Stout',
  'Fruited Sour',
  'Hard Cider',
  'Kolsch',
  'Wheat Beer',
  'Vienna Lager',
];

const COMMON_SPIRIT_CATEGORIES = [
  'Tequila / Mezcal',
  'Whiskey / Bourbon',
  'Vodka',
  'Gin',
  'Rum',
  'Liqueurs / Cordials',
  'Amaro & Bitters',
  'Brandy & Cognac',
  'Other',
];

export const ProductCreatorModal: React.FC<ProductCreatorModalProps> = ({
  isOpen,
  onClose,
  initialType = 'BEER',
  existingCoolerItems,
  existingSpirits,
  beerStyles,
  onAddNewBeerStyle,
  onAddBeer,
  onAddSpirit,
}) => {
  const [productType, setProductType] = useState<ProductType>(initialType);
  const effectiveBeerStyles = beerStyles && beerStyles.length > 0 ? beerStyles : COMMON_BEER_STYLES;

  // Format selection toggle: Draft Keg vs Packaged
  const [beerCategory, setBeerCategory] = useState<'DRAFT' | 'PACKAGED'>('DRAFT');

  // Draft Beer fields
  const [beerBrand, setBeerBrand] = useState('');
  const [beerStyle, setBeerStyle] = useState('Hazy IPA');
  const [beerFormat, setBeerFormat] = useState<KegFormat>('1/2 BBL');
  const [beerStock, setBeerStock] = useState<number>(2);
  const [beerAbv, setBeerAbv] = useState<string>('6.5%');
  const [beerPar, setBeerPar] = useState<number>(2);
  const [beerSku, setBeerSku] = useState('');

  // Packaged (16oz Cans) fields
  const [packagedCases, setPackagedCases] = useState<number>(2);
  const [packagedFourPacks, setPackagedFourPacks] = useState<number>(3);
  const [packagedSingles, setPackagedSingles] = useState<number>(0);
  const [packagedPar, setPackagedPar] = useState<number>(24);
  const [packagedSku, setPackagedSku] = useState('');

  // Auto-calculate total base cans: (Cases * 24) + (4-Packs * 4) + Singles
  const totalBaseCans = useMemo(() => {
    const cases = Math.max(0, Number(packagedCases) || 0);
    const fourPacks = Math.max(0, Number(packagedFourPacks) || 0);
    const singles = Math.max(0, Number(packagedSingles) || 0);
    return cases * 24 + fourPacks * 4 + singles;
  }, [packagedCases, packagedFourPacks, packagedSingles]);

  // Spirit fields
  const [spiritBrand, setSpiritBrand] = useState('');
  const [spiritCategory, setSpiritCategory] = useState('Tequila / Mezcal');
  const [spiritPar, setSpiritPar] = useState<number>(3);
  const [spiritFastPick, setSpiritFastPick] = useState<boolean>(true);
  const [spiritSku, setSpiritSku] = useState('');

  // Compute next sequential SKUs
  const nextBeerSku = useMemo(() => {
    let maxNum = 0;
    existingCoolerItems.forEach((item) => {
      const match = item.sku.match(/^KEG-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `KEG-${String(maxNum + 1).padStart(3, '0')}`;
  }, [existingCoolerItems]);

  const nextPackagedSku = useMemo(() => {
    let maxNum = 0;
    existingCoolerItems.forEach((item) => {
      const match = item.sku.match(/^PKG-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `PKG-${String(maxNum + 1).padStart(3, '0')}`;
  }, [existingCoolerItems]);

  const nextSpiritSku = useMemo(() => {
    let maxNum = 0;
    existingSpirits.forEach((item) => {
      const match = item.sku.match(/^SPR-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `SPR-${String(maxNum + 1).padStart(3, '0')}`;
  }, [existingSpirits]);

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      setProductType(initialType);
      setBeerCategory('DRAFT');
      setBeerBrand('');
      setBeerStyle('Hazy IPA');
      setBeerFormat('1/2 BBL');
      setBeerStock(2);
      setBeerAbv('6.5%');
      setBeerPar(2);
      setBeerSku(nextBeerSku);

      setPackagedCases(2);
      setPackagedFourPacks(3);
      setPackagedSingles(0);
      setPackagedPar(24);
      setPackagedSku(nextPackagedSku);

      setSpiritBrand('');
      setSpiritCategory('Tequila / Mezcal');
      setSpiritPar(3);
      setSpiritFastPick(true);
      setSpiritSku(nextSpiritSku);
    }
  }, [isOpen, initialType, nextBeerSku, nextPackagedSku, nextSpiritSku]);

  if (!isOpen) return null;

  const handleSubmitBeer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!beerBrand.trim()) return;

    const finalStyle = beerStyle.trim() || 'Craft Beer';

    if (onAddNewBeerStyle && finalStyle && finalStyle !== 'Craft Beer') {
      onAddNewBeerStyle(finalStyle);
    }

    if (beerCategory === 'PACKAGED') {
      const finalSku = packagedSku.trim() || nextPackagedSku;
      const newBeer: CoolerItem & { abv?: string } = {
        id: finalSku,
        sku: finalSku,
        brand: beerBrand.trim(),
        style: finalStyle,
        format: '16oz Can',
        count: totalBaseCans,
        baseCanCount: totalBaseCans,
        parLevel: Math.max(1, Number(packagedPar) || 24),
        unit: 'Cans',
        abv: beerAbv.trim() || undefined,
      };

      onAddBeer(newBeer);
    } else {
      const finalSku = beerSku.trim() || nextBeerSku;
      const newBeer: CoolerItem & { abv?: string } = {
        id: finalSku,
        sku: finalSku,
        brand: beerBrand.trim(),
        style: finalStyle,
        format: beerFormat,
        count: Math.max(0, Number(beerStock) || 0),
        parLevel: Math.max(1, Number(beerPar) || 2),
        unit: 'Kegs',
        abv: beerAbv.trim() || undefined,
      };

      onAddBeer(newBeer);
    }

    onClose();
  };

  const handleSubmitSpirit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!spiritBrand.trim()) return;

    const finalSku = spiritSku.trim() || nextSpiritSku;
    const newSpirit: SpiritItem = {
      sku: finalSku,
      brand: spiritBrand.trim(),
      category: spiritCategory.trim() || 'Spirits',
      defaultPar: Math.max(1, Number(spiritPar) || 3),
      fastSelect: spiritFastPick,
    };

    onAddSpirit(newSpirit);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="bg-slate-850 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-inner">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white leading-tight">
                  Add New Product / SKU
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Manager Tool</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Creates a new master SKU and syncs directly to Google Sheets
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Type Toggle (Beer vs Spirit) */}
        <div className="bg-slate-800/60 p-2 border-b border-slate-750 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setProductType('BEER')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              productType === 'BEER'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Beer className="w-4 h-4" />
            <span>Draft Beer / Keg SKU</span>
          </button>

          <button
            type="button"
            onClick={() => setProductType('SPIRIT')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              productType === 'SPIRIT'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Wine className="w-4 h-4" />
            <span>Spirit Bottle SKU</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* BEER CREATION FORM (DRAFT KEG VS PACKAGED 16OZ CANS)                      */}
        {/* ========================================================================= */}
        {productType === 'BEER' ? (
          <form onSubmit={handleSubmitBeer} className="p-5 space-y-4">
            {/* Format Selector Toggle: Draft Keg vs Packaged (16oz Cans) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Beer Product Category
              </label>
              <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 grid grid-cols-2 gap-1.5 shadow-inner">
                <button
                  type="button"
                  onClick={() => setBeerCategory('DRAFT')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    beerCategory === 'DRAFT'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-750'
                  }`}
                >
                  <Beer className="w-4 h-4" />
                  <span>Draft Keg</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBeerCategory('PACKAGED')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    beerCategory === 'PACKAGED'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-750'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>Packaged (16oz Cans)</span>
                </button>
              </div>
            </div>

            {/* Auto SKU Banner */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                beerCategory === 'PACKAGED'
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              <div
                className={`flex items-center gap-1.5 font-semibold ${
                  beerCategory === 'PACKAGED' ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                <Sparkles
                  className={`w-4 h-4 ${
                    beerCategory === 'PACKAGED' ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                />
                <span>Auto-Generated SKU ({beerCategory === 'PACKAGED' ? 'Packaged' : 'Keg'}):</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={beerCategory === 'PACKAGED' ? packagedSku : beerSku}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    if (beerCategory === 'PACKAGED') setPackagedSku(val);
                    else setBeerSku(val);
                  }}
                  className={`font-mono font-bold text-xs bg-slate-900 border px-2 py-0.5 rounded text-right w-24 focus:outline-none ${
                    beerCategory === 'PACKAGED'
                      ? 'border-emerald-500/40 text-emerald-300 focus:border-emerald-400'
                      : 'border-amber-500/40 text-amber-300 focus:border-amber-400'
                  }`}
                  title="Sequential SKU identifier (editable)"
                />
              </div>
            </div>

            {/* Beer Name / Brand */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Beer / Brand Name <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Copper Ridge Red Ale"
                value={beerBrand}
                onChange={(e) => setBeerBrand(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Style with Searchable Creatable Selector & Quick Chips */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Beer Style <span className="text-slate-500 font-normal">(search, select, or type custom)</span>
              </label>
              <SearchableStyleSelect
                value={beerStyle}
                onChange={setBeerStyle}
                onAddNewStyle={(newStyle) => {
                  setBeerStyle(newStyle);
                  if (onAddNewBeerStyle) onAddNewBeerStyle(newStyle);
                }}
                styles={effectiveBeerStyles}
                placeholder="Search style or type custom (e.g. Cold IPA, Pastry Stout)..."
                className="mb-2"
              />
              <div className="flex flex-wrap gap-1.5">
                {effectiveBeerStyles.slice(0, 6).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setBeerStyle(style)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                      beerStyle.toLowerCase() === style.toLowerCase()
                        ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-bold'
                        : 'bg-slate-800/80 border-slate-750 text-slate-400 hover:text-white'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* DRAFT KEG VIEW: Format & Keg Stock Inputs */}
            {beerCategory === 'DRAFT' ? (
              <>
                {/* Format Selection (1/2 BBL vs 1/6 BBL) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Keg Format
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setBeerFormat('1/2 BBL')}
                      className={`p-3 rounded-xl border font-bold text-xs cursor-pointer text-left transition-all ${
                        beerFormat === '1/2 BBL'
                          ? 'bg-amber-500/20 border-amber-500 text-white ring-1 ring-amber-500'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                      }`}
                    >
                      <div className="text-sm font-extrabold text-white">1/2 BBL</div>
                      <div className="text-[11px] text-slate-400">Full Keg (124 Pints)</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBeerFormat('1/6 BBL')}
                      className={`p-3 rounded-xl border font-bold text-xs cursor-pointer text-left transition-all ${
                        beerFormat === '1/6 BBL'
                          ? 'bg-cyan-500/20 border-cyan-500 text-white ring-1 ring-cyan-500'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                      }`}
                    >
                      <div className="text-sm font-extrabold text-white">1/6 BBL</div>
                      <div className="text-[11px] text-slate-400">Sixtel (41 Pints)</div>
                    </button>
                  </div>
                </div>

                {/* Row: Initial Stock, ABV, Par Level */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Cooler Kegs
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={beerStock}
                      onChange={(e) => setBeerStock(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      ABV %
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 6.5%"
                      value={beerAbv}
                      onChange={(e) => setBeerAbv(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Par (Kegs)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={beerPar}
                      onChange={(e) => setBeerPar(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </>
            ) : (
              /* PACKAGED (16OZ CANS) VIEW: Starting Stock Inputs (Cases, 4-Packs, Singles) */
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Starting Stock Quantities
                  </label>
                  <span className="text-[11px] font-bold text-slate-400">Format: 16oz Can</span>
                </div>

                {/* 3 Starting Stock Inputs: Cases (24pk), 4-Packs, and Singles */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                    <label className="block text-[11px] font-bold uppercase text-emerald-300 mb-1">
                      Cases (24pk)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={packagedCases}
                      onChange={(e) => setPackagedCases(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-base font-black text-white text-center focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400 block text-center mt-1">
                      = {packagedCases * 24} cans
                    </span>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                    <label className="block text-[11px] font-bold uppercase text-cyan-300 mb-1">
                      4-Packs
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={packagedFourPacks}
                      onChange={(e) => setPackagedFourPacks(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-base font-black text-white text-center focus:outline-none focus:border-cyan-500"
                    />
                    <span className="text-[10px] text-slate-400 block text-center mt-1">
                      = {packagedFourPacks * 4} cans
                    </span>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                    <label className="block text-[11px] font-bold uppercase text-amber-300 mb-1">
                      Singles
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={packagedSingles}
                      onChange={(e) => setPackagedSingles(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-base font-black text-white text-center focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-400 block text-center mt-1">
                      = {packagedSingles} cans
                    </span>
                  </div>
                </div>

                {/* Auto-calculate total base cans card */}
                <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs">
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span className="text-emerald-300">Total Calculated Base Stock:</span>
                    <span className="text-base font-black text-white">
                      {totalBaseCans} Total Cans
                    </span>
                  </div>
                  <div className="text-emerald-200/70 font-mono text-[11px]">
                    ({packagedCases} Cases × 24) + ({packagedFourPacks} 4-Packs × 4) + ({packagedSingles} Singles) = {totalBaseCans} cans
                  </div>
                </div>

                {/* Row: ABV and Par Level in Cans */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      ABV %
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 6.8%"
                      value={beerAbv}
                      onChange={(e) => setBeerAbv(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Par Level (Total Cans)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={packagedPar}
                      onChange={(e) => setPackagedPar(Math.max(1, parseInt(e.target.value) || 24))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!beerBrand.trim()}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm text-slate-950 disabled:opacity-40 transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
                  beerCategory === 'PACKAGED'
                    ? 'bg-emerald-500 hover:bg-emerald-400'
                    : 'bg-amber-500 hover:bg-amber-400'
                }`}
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>
                  {beerCategory === 'PACKAGED' ? 'Create & Add Packaged Cans' : 'Create & Add Draft Keg'}
                </span>
              </button>
            </div>
          </form>
        ) : (
          /* ========================================================================= */
          /* SPIRIT CREATION FORM                                                      */
          /* ========================================================================= */
          <form onSubmit={handleSubmitSpirit} className="p-5 space-y-4">
            {/* Auto SKU Banner */}
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Auto-Generated SKU:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={spiritSku}
                  onChange={(e) => setSpiritSku(e.target.value.toUpperCase())}
                  className="font-mono font-bold text-xs bg-slate-900 border border-purple-500/40 text-purple-300 px-2 py-0.5 rounded text-right w-24 focus:outline-none focus:border-purple-400"
                  title="Sequential SKU identifier (editable)"
                />
              </div>
            </div>

            {/* Spirit Brand / Product Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Spirit / Product Name <span className="text-purple-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Casamigos Reposado Tequila"
                value={spiritBrand}
                onChange={(e) => setSpiritBrand(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Category Dropdown */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Category
              </label>
              <select
                value={spiritCategory}
                onChange={(e) => setSpiritCategory(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                {COMMON_SPIRIT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-900 text-slate-100">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Row: Default Par & Fast Pick */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Default Par (Bottles)
                </label>
                <input
                  type="number"
                  min="1"
                  value={spiritPar}
                  onChange={(e) => setSpiritPar(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Fast Pick Grid
                </label>
                <button
                  type="button"
                  onClick={() => setSpiritFastPick(!spiritFastPick)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    spiritFastPick
                      ? 'bg-purple-500/20 border-purple-500 text-purple-200'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <Check className={`w-3.5 h-3.5 ${spiritFastPick ? 'opacity-100' : 'opacity-20'}`} />
                  <span>{spiritFastPick ? 'Show on Fast Pick' : 'Hidden from Fast Pick'}</span>
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!spiritBrand.trim()}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create & Add to Spirits</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
