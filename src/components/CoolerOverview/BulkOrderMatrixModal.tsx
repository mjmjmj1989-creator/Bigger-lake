import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Search,
  Truck,
  Plus,
  Minus,
  CheckCircle2,
  Trash2,
  Building2,
  Package,
  Beer,
  Archive,
  AlertCircle,
  Hash,
  Sparkles,
} from 'lucide-react';
import { CoolerItem, SpiritItem, PurchaseOrder } from '../../types/taproom';

interface BulkOrderMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  coolerStock: CoolerItem[];
  spiritsCatalog?: SpiritItem[];
  currentStaff: string;
  onSubmitBatchOrders: (orders: PurchaseOrder[]) => void;
}

const VENDOR_OPTIONS = [
  'In-House Brewery',
  'Imperial Beverage',
  'Alliance Beverage',
  'General Distributor',
  '+ Custom Vendor',
];

interface ProductQuantities {
  halfBbl: number;
  sixthBbl: number;
  cases: number;
  fourPacks: number;
  singles: number;
}

interface AggregatedProduct {
  brand: string;
  style: string;
  skuHalf?: string;
  skuSixth?: string;
  skuPackaged?: string;
  currentHalf: number;
  currentSixth: number;
  currentCans: number;
  parHalf: number;
  parSixth: number;
  parCans: number;
}

const generateBatchOrderId = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `ORD-${yyyy}${mm}${dd}-${randomSuffix}`;
};

export const BulkOrderMatrixModal: React.FC<BulkOrderMatrixModalProps> = ({
  isOpen,
  onClose,
  coolerStock,
  currentStaff,
  onSubmitBatchOrders,
}) => {
  // Top Controls State
  const [selectedVendor, setSelectedVendor] = useState<string>('In-House Brewery');
  const [customVendor, setCustomVendor] = useState<string>('');
  const [batchOrderId, setBatchOrderId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Matrix quantities keyed by brand name
  const [quantities, setQuantities] = useState<Record<string, ProductQuantities>>({});

  // Helper to identify packaged items
  const isPackagedItem = (item: CoolerItem) => {
    const f = (item.format || '').toLowerCase();
    const s = (item.sku || '').toLowerCase();
    return (
      f.includes('packaged') ||
      f.includes('16oz') ||
      f.includes('can') ||
      f.includes('4-pk') ||
      f.includes('case') ||
      s.startsWith('pkg-')
    );
  };

  // Aggregate distinct products from cooler stock
  const productRows: AggregatedProduct[] = useMemo(() => {
    const map = new Map<string, AggregatedProduct>();

    coolerStock.forEach((item) => {
      // Exclude deactivated / inactive items from the order matrix
      if (item.status === 'Inactive') return;

      const brandKey = item.brand.trim();
      if (!map.has(brandKey)) {
        map.set(brandKey, {
          brand: item.brand,
          style: item.style || 'Craft Beer',
          currentHalf: 0,
          currentSixth: 0,
          currentCans: 0,
          parHalf: 2,
          parSixth: 2,
          parCans: 24,
        });
      }

      const entry = map.get(brandKey)!;
      if (item.format === '1/2 BBL') {
        entry.skuHalf = item.sku;
        entry.currentHalf = item.count;
        entry.parHalf = item.parLevel ?? 2;
      } else if (item.format === '1/6 BBL') {
        entry.skuSixth = item.sku;
        entry.currentSixth = item.count;
        entry.parSixth = item.parLevel ?? 2;
      } else if (isPackagedItem(item)) {
        entry.skuPackaged = item.sku;
        entry.currentCans = item.baseCanCount ?? item.count;
        entry.parCans = item.parLevel ?? 24;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.brand.localeCompare(b.brand));
  }, [coolerStock]);

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return productRows;
    const q = searchQuery.toLowerCase().trim();
    return productRows.filter(
      (p) =>
        p.brand.toLowerCase().includes(q) ||
        p.style.toLowerCase().includes(q) ||
        (p.skuHalf && p.skuHalf.toLowerCase().includes(q)) ||
        (p.skuSixth && p.skuSixth.toLowerCase().includes(q)) ||
        (p.skuPackaged && p.skuPackaged.toLowerCase().includes(q))
    );
  }, [productRows, searchQuery]);

  // Reset or initialize state when opening modal
  useEffect(() => {
    if (isOpen) {
      setBatchOrderId(generateBatchOrderId());
      setSelectedVendor('In-House Brewery');
      setCustomVendor('');
      setSearchQuery('');
      setQuantities({});
    }
  }, [isOpen]);

  const updateQuantity = useCallback(
    (brand: string, formatField: keyof ProductQuantities, val: number) => {
      setQuantities((prev) => {
        const current = prev[brand] || {
          halfBbl: 0,
          sixthBbl: 0,
          cases: 0,
          fourPacks: 0,
          singles: 0,
        };
        const safeVal = Math.max(0, val);
        return {
          ...prev,
          [brand]: {
            ...current,
            [formatField]: safeVal,
          },
        };
      });
    },
    []
  );

  const incrementQuantity = useCallback(
    (brand: string, formatField: keyof ProductQuantities, delta: number) => {
      setQuantities((prev) => {
        const current = prev[brand] || {
          halfBbl: 0,
          sixthBbl: 0,
          cases: 0,
          fourPacks: 0,
          singles: 0,
        };
        const nextVal = Math.max(0, current[formatField] + delta);
        return {
          ...prev,
          [brand]: {
            ...current,
            [formatField]: nextVal,
          },
        };
      });
    },
    []
  );

  // Clear all entered quantities
  const handleClearAll = () => {
    setQuantities({});
  };

  // Metrics: Total line items, total kegs, total cans
  const { totalLineItems, totalKegs, totalCans } = useMemo(() => {
    let lineItems = 0;
    let kegs = 0;
    let cans = 0;

    Object.values(quantities).forEach((q) => {
      if (q.halfBbl > 0) {
        lineItems++;
        kegs += q.halfBbl;
      }
      if (q.sixthBbl > 0) {
        lineItems++;
        kegs += q.sixthBbl;
      }
      if (q.cases > 0) {
        lineItems++;
        cans += q.cases * 24;
      }
      if (q.fourPacks > 0) {
        lineItems++;
        cans += q.fourPacks * 4;
      }
      if (q.singles > 0) {
        lineItems++;
        cans += q.singles;
      }
    });

    return { totalLineItems: lineItems, totalKegs: kegs, totalCans: cans };
  }, [quantities]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalLineItems === 0) return;

    const finalVendor =
      selectedVendor === '+ Custom Vendor'
        ? customVendor.trim() || 'Custom Distributor'
        : selectedVendor;

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const generatedOrders: PurchaseOrder[] = [];

    // Map each non-zero format quantity to a distinct PurchaseOrder record
    Object.entries(quantities).forEach(([brand, q]) => {
      const product = productRows.find((p) => p.brand === brand);

      if (q.halfBbl > 0) {
        generatedOrders.push({
          id: batchOrderId,
          timestamp: nowStr,
          sku: product?.skuHalf || `KEG-HALF-${brand.replace(/\s+/g, '').toUpperCase().slice(0, 6)}`,
          brand,
          format: '1/2 BBL',
          quantity: q.halfBbl,
          vendor: finalVendor,
          status: 'Ordered',
          loggedBy: currentStaff,
          synced: false,
        });
      }

      if (q.sixthBbl > 0) {
        generatedOrders.push({
          id: batchOrderId,
          timestamp: nowStr,
          sku: product?.skuSixth || `KEG-SIXTH-${brand.replace(/\s+/g, '').toUpperCase().slice(0, 6)}`,
          brand,
          format: '1/6 BBL',
          quantity: q.sixthBbl,
          vendor: finalVendor,
          status: 'Ordered',
          loggedBy: currentStaff,
          synced: false,
        });
      }

      if (q.cases > 0) {
        generatedOrders.push({
          id: batchOrderId,
          timestamp: nowStr,
          sku: product?.skuPackaged || `PKG-CASE-${brand.replace(/\s+/g, '').toUpperCase().slice(0, 6)}`,
          brand,
          format: 'Cases (24 cans)',
          quantity: q.cases,
          vendor: finalVendor,
          status: 'Ordered',
          loggedBy: currentStaff,
          synced: false,
        });
      }

      if (q.fourPacks > 0) {
        generatedOrders.push({
          id: batchOrderId,
          timestamp: nowStr,
          sku: product?.skuPackaged || `PKG-4PK-${brand.replace(/\s+/g, '').toUpperCase().slice(0, 6)}`,
          brand,
          format: '4-Packs (4 cans)',
          quantity: q.fourPacks,
          vendor: finalVendor,
          status: 'Ordered',
          loggedBy: currentStaff,
          synced: false,
        });
      }

      if (q.singles > 0) {
        generatedOrders.push({
          id: batchOrderId,
          timestamp: nowStr,
          sku: product?.skuPackaged || `PKG-SGL-${brand.replace(/\s+/g, '').toUpperCase().slice(0, 6)}`,
          brand,
          format: 'Single Cans',
          quantity: q.singles,
          vendor: finalVendor,
          status: 'Ordered',
          loggedBy: currentStaff,
          synced: false,
        });
      }
    });

    if (generatedOrders.length > 0) {
      onSubmitBatchOrders(generatedOrders);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden select-none">
        {/* ========================================================================= */}
        {/* TOP HEADER: Title, Dismiss, Batch PO Reference, Vendor, and Search        */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 shrink-0 space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center font-bold">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white leading-tight flex items-center gap-2">
                  <span>Bulk Order Matrix</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    High-Velocity Multi-Item
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Quickly order draft kegs & packaged cans across multiple brands in a single batch
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750 transition-colors cursor-pointer"
              title="Close matrix"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Top Controls Grid: Vendor Selector, Batch ID, and Search Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Vendor / Supplier Dropdown */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Vendor / Supplier</span>
              </label>
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {VENDOR_OPTIONS.map((v) => (
                  <option key={v} value={v} className="bg-slate-900 text-slate-100">
                    {v}
                  </option>
                ))}
              </select>
              {selectedVendor === '+ Custom Vendor' && (
                <input
                  type="text"
                  placeholder="Enter custom supplier name..."
                  value={customVendor}
                  onChange={(e) => setCustomVendor(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-blue-500 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                  autoFocus
                />
              )}
            </div>

            {/* 2. PO / Batch Reference */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-purple-400" />
                <span>PO / Batch Reference</span>
              </label>
              <input
                type="text"
                value={batchOrderId}
                onChange={(e) => setBatchOrderId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-mono text-xs font-bold text-purple-300 focus:outline-none focus:border-purple-500"
                placeholder="ORD-YYYYMMDD-###"
              />
            </div>

            {/* 3. Search / Quick Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span>Filter Matrix Products</span>
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search brand or style..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MATRIX GRID LAYOUT: Multi-Row / Multi-Format Table                        */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-3 sm:p-5">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-900 sticky top-0 z-10">
                <th className="pb-3 pl-2 w-[34%]">Product & Current Stock</th>
                <th className="pb-3 text-center w-[15%]">
                  <span className="text-amber-400 flex items-center justify-center gap-1">
                    <Beer className="w-3 h-3" />
                    <span>1/2 BBL</span>
                  </span>
                </th>
                <th className="pb-3 text-center w-[15%]">
                  <span className="text-cyan-400 flex items-center justify-center gap-1">
                    <Beer className="w-3 h-3" />
                    <span>1/6 BBL</span>
                  </span>
                </th>
                <th className="pb-3 text-center w-[12%]">
                  <span className="text-emerald-400 flex items-center justify-center gap-1">
                    <Archive className="w-3 h-3" />
                    <span>Cases (24)</span>
                  </span>
                </th>
                <th className="pb-3 text-center w-[12%]">
                  <span className="text-teal-400 flex items-center justify-center gap-1">
                    <Archive className="w-3 h-3" />
                    <span>4-Packs (4)</span>
                  </span>
                </th>
                <th className="pb-3 text-center w-[12%]">
                  <span className="text-slate-300 flex items-center justify-center gap-1">
                    <span>Singles (1)</span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredProducts.map((p) => {
                const q = quantities[p.brand] || {
                  halfBbl: 0,
                  sixthBbl: 0,
                  cases: 0,
                  fourPacks: 0,
                  singles: 0,
                };
                const hasSelected =
                  q.halfBbl > 0 ||
                  q.sixthBbl > 0 ||
                  q.cases > 0 ||
                  q.fourPacks > 0 ||
                  q.singles > 0;

                return (
                  <tr
                    key={p.brand}
                    className={`transition-colors ${
                      hasSelected
                        ? 'bg-blue-950/20 hover:bg-blue-950/30'
                        : 'hover:bg-slate-850/60'
                    }`}
                  >
                    {/* Product Name + Style + Current Stock / Pars */}
                    <td className="py-3 pl-2 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="font-extrabold text-white text-xs sm:text-sm leading-tight">
                          {p.brand}
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">({p.style})</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span>
                          Draft: <strong className="text-slate-300">{p.currentHalf}</strong> 1/2 (par {p.parHalf}),{' '}
                          <strong className="text-slate-300">{p.currentSixth}</strong> 1/6 (par {p.parSixth})
                        </span>
                        <span>•</span>
                        <span>
                          Cans: <strong className="text-slate-300">{p.currentCans}</strong> (par {p.parCans})
                        </span>
                      </div>
                    </td>

                    {/* Draft 1/2 BBL Stepper */}
                    <td className="py-2.5 px-1.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => incrementQuantity(p.brand, 'halfBbl', -1)}
                          disabled={q.halfBbl <= 0}
                          className="w-6 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={q.halfBbl === 0 ? '' : q.halfBbl}
                          placeholder="0"
                          onChange={(e) =>
                            updateQuantity(p.brand, 'halfBbl', parseInt(e.target.value) || 0)
                          }
                          className={`w-11 h-7 text-center font-mono font-bold text-xs rounded-lg border transition-all ${
                            q.halfBbl > 0
                              ? 'bg-amber-500/20 text-amber-200 border-amber-500/60 shadow-sm'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => incrementQuantity(p.brand, 'halfBbl', 1)}
                          className="w-6 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Draft 1/6 BBL Stepper */}
                    <td className="py-2.5 px-1.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => incrementQuantity(p.brand, 'sixthBbl', -1)}
                          disabled={q.sixthBbl <= 0}
                          className="w-6 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={q.sixthBbl === 0 ? '' : q.sixthBbl}
                          placeholder="0"
                          onChange={(e) =>
                            updateQuantity(p.brand, 'sixthBbl', parseInt(e.target.value) || 0)
                          }
                          className={`w-11 h-7 text-center font-mono font-bold text-xs rounded-lg border transition-all ${
                            q.sixthBbl > 0
                              ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/60 shadow-sm'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => incrementQuantity(p.brand, 'sixthBbl', 1)}
                          className="w-6 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Packaged Cases (24) Stepper */}
                    <td className="py-2.5 px-1.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => incrementQuantity(p.brand, 'cases', -1)}
                          disabled={q.cases <= 0}
                          className="w-6 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={q.cases === 0 ? '' : q.cases}
                          placeholder="0"
                          onChange={(e) =>
                            updateQuantity(p.brand, 'cases', parseInt(e.target.value) || 0)
                          }
                          className={`w-11 h-7 text-center font-mono font-bold text-xs rounded-lg border transition-all ${
                            q.cases > 0
                              ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/60 shadow-sm'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => incrementQuantity(p.brand, 'cases', 1)}
                          className="w-6 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Packaged 4-Packs (4) Stepper */}
                    <td className="py-2.5 px-1.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => incrementQuantity(p.brand, 'fourPacks', -1)}
                          disabled={q.fourPacks <= 0}
                          className="w-6 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={q.fourPacks === 0 ? '' : q.fourPacks}
                          placeholder="0"
                          onChange={(e) =>
                            updateQuantity(p.brand, 'fourPacks', parseInt(e.target.value) || 0)
                          }
                          className={`w-11 h-7 text-center font-mono font-bold text-xs rounded-lg border transition-all ${
                            q.fourPacks > 0
                              ? 'bg-teal-500/20 text-teal-200 border-teal-500/60 shadow-sm'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => incrementQuantity(p.brand, 'fourPacks', 1)}
                          className="w-6 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Packaged Singles (1) Stepper */}
                    <td className="py-2.5 px-1.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => incrementQuantity(p.brand, 'singles', -1)}
                          disabled={q.singles <= 0}
                          className="w-6 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={q.singles === 0 ? '' : q.singles}
                          placeholder="0"
                          onChange={(e) =>
                            updateQuantity(p.brand, 'singles', parseInt(e.target.value) || 0)
                          }
                          className={`w-11 h-7 text-center font-mono font-bold text-xs rounded-lg border transition-all ${
                            q.singles > 0
                              ? 'bg-slate-700 text-white border-slate-600 shadow-sm'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => incrementQuantity(p.brand, 'singles', 1)}
                          className="w-6 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ========================================================================= */}
        {/* FAST-FILL & TOTALIZER FOOTER (Sticky)                                     */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Left: Summary Metrics */}
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>{totalLineItems} Line Items</span>
            </div>

            <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
              <Beer className="w-3.5 h-3.5 text-amber-400" />
              <span>{totalKegs} Kegs Total</span>
            </div>

            <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
              <Archive className="w-3.5 h-3.5 text-emerald-400" />
              <span>{totalCans} Cans Total</span>
            </div>

            {totalLineItems > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[11px] text-slate-400 hover:text-rose-300 underline cursor-pointer ml-1"
              >
                Clear Quantities
              </button>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={totalLineItems === 0}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap active:scale-95"
            >
              <Truck className="w-4 h-4" />
              <span>Submit Purchase Order ({totalLineItems} {totalLineItems === 1 ? 'item' : 'items'})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
