import React, { useState } from 'react';
import { DollarSign, User, Phone, Check, ArrowDownLeft, ArrowUpRight, Search, ShieldCheck, AlertCircle } from 'lucide-react';
import { DepositTransaction, KegDepositEntry } from '../../types/taproom';

interface KegDepositsProps {
  currentStaff: string;
  deposits: KegDepositEntry[];
  onLogDeposit: (entry: {
    customerName: string;
    phone: string;
    transaction: DepositTransaction;
    status: 'Active' | 'Returned & Refunded';
    loggedBy: string;
  }) => void;
  onProcessReturn: (depositId: string, staffMember: string) => void;
}

export const KegDeposits: React.FC<KegDepositsProps> = ({
  currentStaff,
  deposits,
  onLogDeposit,
  onProcessReturn,
}) => {
  const [transactionType, setTransactionType] = useState<DepositTransaction>('Deposit Charged $30');
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'RETURNED'>('ACTIVE');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [quickRefundTarget, setQuickRefundTarget] = useState<KegDepositEntry | null>(null);

  // Compute metrics
  const activeDeposits = deposits.filter((d) => d.status === 'Active');
  const totalHeldCash = activeDeposits.length * 30;
  const returnedCount = deposits.filter((d) => d.status === 'Returned & Refunded').length;

  const formatPhoneNumber = (val: string) => {
    // Strip non-digits
    const digits = val.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(formatPhoneNumber(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return;
    setShowConfirmModal(true);
  };

  const handleExecuteDeposit = () => {
    const isCharge = transactionType === 'Deposit Charged $30';
    onLogDeposit({
      customerName: customerName.trim(),
      phone: phoneNumber.trim() || 'N/A',
      transaction: transactionType,
      status: isCharge ? 'Active' : 'Returned & Refunded',
      loggedBy: currentStaff,
    });

    setCustomerName('');
    setPhoneNumber('');
    setShowConfirmModal(false);
  };

  const handleConfirmQuickRefund = () => {
    if (!quickRefundTarget) return;
    onProcessReturn(quickRefundTarget.id, currentStaff);
    setQuickRefundTarget(null);
  };

  // Filtered deposits list
  const filteredDeposits = deposits.filter((d) => {
    if (statusFilter === 'ACTIVE' && d.status !== 'Active') return false;
    if (statusFilter === 'RETURNED' && d.status !== 'Returned & Refunded') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        d.customerName.toLowerCase().includes(q) ||
        d.phone.toLowerCase().includes(q) ||
        d.date.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-extrabold text-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">${totalHeldCash}</div>
            <div className="text-xs text-slate-400 font-medium">Total Active Deposits Held</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-extrabold text-xl">
            {activeDeposits.length}
          </div>
          <div>
            <div className="text-2xl font-black text-white">{activeDeposits.length} Kegs</div>
            <div className="text-xs text-slate-400 font-medium">Kegs Out in Field</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-extrabold text-xl">
            {returnedCount}
          </div>
          <div>
            <div className="text-2xl font-black text-white">${returnedCount * 30}</div>
            <div className="text-xs text-slate-400 font-medium">Total Deposits Refunded</div>
          </div>
        </div>
      </div>

      {/* Form Card: $30 Keg Deposit Entry */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span>Record $30 Keg Deposit Transaction</span>
          </h2>
          <span className="text-xs text-slate-400">Fixed $30.00 Rate</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Radio Toggle: Keg Sold vs Keg Returned */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              1. Transaction Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTransactionType('Deposit Charged $30')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3.5 select-none ${
                  transactionType === 'Deposit Charged $30'
                    ? 'bg-emerald-500/15 border-emerald-500 text-white ring-2 ring-emerald-500/50 shadow-md'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:border-slate-650'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    transactionType === 'Deposit Charged $30'
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <div className="font-bold text-sm sm:text-base text-white">
                    Keg Sold (+ $30 Deposit)
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Customer borrows keg shell, charge $30
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTransactionType('Deposit Refunded $30')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3.5 select-none ${
                  transactionType === 'Deposit Refunded $30'
                    ? 'bg-cyan-500/15 border-cyan-500 text-white ring-2 ring-cyan-500/50 shadow-md'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:border-slate-650'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    transactionType === 'Deposit Refunded $30'
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <div className="font-bold text-sm sm:text-base text-white">
                    Keg Returned (Refund $30)
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Customer returns keg shell, refund $30
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Customer Name and Phone Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span>Customer Full Name</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Marcus Vance"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>Phone Number</span>
              </label>
              <input
                type="tel"
                placeholder="(555) 000-0000"
                value={phoneNumber}
                onChange={handlePhoneChange}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Staff Member: <strong className="text-slate-200">{currentStaff}</strong>
            </span>
            <button
              type="submit"
              disabled={!customerName.trim()}
              className={`px-7 py-3 rounded-xl font-bold text-sm sm:text-base flex items-center gap-2 cursor-pointer shadow-lg transition-all ${
                transactionType === 'Deposit Charged $30'
                  ? 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 shadow-emerald-500/20'
                  : 'bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-950 shadow-cyan-500/20'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>
                {transactionType === 'Deposit Charged $30'
                  ? 'Confirm & Collect $30 Deposit'
                  : 'Confirm & Issue $30 Refund'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Active Keg Deposits Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Keg Deposits Ledger
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
              {filteredDeposits.length} Records
            </span>
          </div>

          {/* Filter and Search */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('RETURNED')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  statusFilter === 'RETURNED'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Refunded
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                All
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search name, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Ledger Table / List */}
        <div className="divide-y divide-slate-800/80">
          {filteredDeposits.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No deposit records matching current filters.
            </div>
          ) : (
            filteredDeposits.map((entry) => {
              const isActive = entry.status === 'Active';
              return (
                <div
                  key={entry.id}
                  className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      $30
                    </div>
                    <div>
                      <div className="font-bold text-white leading-tight">
                        {entry.customerName}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="text-slate-300">{entry.phone}</span>
                        <span>•</span>
                        <span>{entry.date}</span>
                        <span>•</span>
                        <span>By {entry.loggedBy}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {entry.status}
                    </span>

                    {isActive && (
                      <button
                        type="button"
                        onClick={() => setQuickRefundTarget(entry)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-colors cursor-pointer"
                      >
                        Refund $30 Return
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Confirmation Modal for New Deposit (Workspace Compliance) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Deposit Transaction</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Are you sure you want to log this transaction to the master Google Sheets deposit ledger?
                </p>
              </div>
            </div>

            <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span>Transaction:</span>
                <strong className="text-white">{transactionType}</strong>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <strong className="text-white">{customerName}</strong>
              </div>
              <div className="flex justify-between">
                <span>Phone:</span>
                <span className="text-slate-300">{phoneNumber || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Staff:</span>
                <span className="text-slate-300">{currentStaff}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDeposit}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md transition-colors"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Quick Refund Return */}
      {quickRefundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Issue $30 Keg Return Refund</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Confirm refund of $30.00 to <strong>{quickRefundTarget.customerName}</strong> for returned keg shell?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setQuickRefundTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmQuickRefund}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md transition-colors"
              >
                Confirm $30 Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
