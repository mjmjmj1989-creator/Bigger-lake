import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  Layers,
  Check,
  AlertCircle,
  Calculator,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { CoolerItem, getPackagedBreakdown } from '../../types/taproom';

interface PackagedAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CoolerItem | null;
  currentStaff: string;
  onConfirmAudit: (params: {
    sku: string;
    brand: string;
    newBaseCans: number;
    delta: number;
    staffMember: string;
  }) => void;
}

export const PackagedAuditModal: React.FC<PackagedAuditModalProps> = ({
  isOpen,
  onClose,
  item,
  currentStaff,
  onConfirmAudit,
}) => {
  const [casesInput, setCasesInput] = useState<number>(0);
  const [fourPacksInput, setFourPacksInput] = useState<number>(0);
  const [singlesInput, setSinglesInput] = useState<number>(0);

  // Initialize breakdown based on current stock
  useEffect(() => {
    if (item) {
      const currentTotal = item.baseCanCount ?? item.count ?? 0;
      const breakdown = getPackagedBreakdown(currentTotal);
      setCasesInput(breakdown.cases);
      setFourPacksInput(breakdown.fourPacks);
      setSinglesInput(breakdown.singles);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const currentTotalCans = item.baseCanCount ?? item.count ?? 0;
  const currentBreakdown = getPackagedBreakdown(currentTotalCans);

  // Calculate new total base cans from the 3 quick-entry fields
  const safeCases = Math.max(0, Number(casesInput) || 0);
  const safe4Pks = Math.max(0, Number(fourPacksInput) || 0);
  const safeSingles = Math.max(0, Number(singlesInput) || 0);

  const calculatedNewCans = safeCases * 24 + safe4Pks * 4 + safeSingles;
  const delta = calculatedNewCans - currentTotalCans;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmAudit({
      sku: item.sku,
      brand: item.brand,
      newBaseCans: calculatedNewCans,
      delta,
      staffMember: currentStaff,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>Packaged Beer Physical Audit</span>
              </h2>
              <p className="text-xs text-slate-400">
                Count 16oz cans by Case, 4-Pack, and Single
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Summary Banner */}
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-white">{item.brand}</div>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span className="font-mono text-emerald-400">{item.sku}</span>
              <span>•</span>
              <span>{item.style}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block font-medium">Currently Recorded</span>
            <span className="text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              {currentBreakdown.formatted}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {/* Quick-Entry 3-Field Grid */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Physical Count Input Fields</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Cases */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white">Full Cases</label>
                  <span className="text-[10px] text-emerald-400 font-mono">24 cans</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={casesInput}
                  onChange={(e) => setCasesInput(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-center text-lg font-black text-white focus:outline-none"
                />
                <div className="text-[11px] text-center text-slate-400">
                  = {safeCases * 24} cans
                </div>
              </div>

              {/* 4-Packs */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white">4-Packs</label>
                  <span className="text-[10px] text-cyan-400 font-mono">4 cans</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={fourPacksInput}
                  onChange={(e) => setFourPacksInput(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-center text-lg font-black text-white focus:outline-none"
                />
                <div className="text-[11px] text-center text-slate-400">
                  = {safe4Pks * 4} cans
                </div>
              </div>

              {/* Singles */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white">Singles</label>
                  <span className="text-[10px] text-amber-400 font-mono">1 can</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={singlesInput}
                  onChange={(e) => setSinglesInput(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-center text-lg font-black text-white focus:outline-none"
                />
                <div className="text-[11px] text-center text-slate-400">
                  = {safeSingles} cans
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Calculation Summary Card */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
              <span>Auto-Calculated Base Stock</span>
              <span>Auditor: {currentStaff}</span>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400">
                  {calculatedNewCans}{' '}
                  <span className="text-sm font-semibold text-slate-400">Total 16oz Cans</span>
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  {safeCases} Cases • {safe4Pks} 4-Packs • {safeSingles} Singles
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`text-xs font-extrabold px-2.5 py-1 rounded-full inline-block ${
                    delta === 0
                      ? 'bg-slate-800 text-slate-300'
                      : delta > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {delta === 0 ? 'No Change' : delta > 0 ? `+${delta} cans adjustment` : `${delta} cans adjustment`}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-850 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Saves total atomic single cans and writes adjustment audit log to Google Sheets.</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Confirm & Save Audit ({calculatedNewCans} cans)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
