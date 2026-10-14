import React, { useState, useMemo } from 'react';
import {
  Archive,
  Package,
  Search,
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  Plus,
  Minus,
  Tag,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Edit3,
  Check,
  X,
  Layers,
  Sparkles,
  Wine,
  Beer,
  Calculator,
  Sliders,
  AlertTriangle,
  Truck,
  ClipboardList,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import {
  CoolerItem,
  SpiritItem,
  StaffRole,
  isManagerOrSupervisor,
  getPackagedBreakdown,
  ProductStatus,
  PurchaseOrder,
} from '../../types/taproom';
import { PackagedAuditModal } from './PackagedAuditModal';
import { BulkOrderMatrixModal } from './BulkOrderMatrixModal';
import { SearchableStyleSelect } from '../Common/SearchableStyleSelect';

interface CoolerStockOverviewProps {
  coolerStock: CoolerItem[];
  spiritsCatalog?: SpiritItem[];
  purchaseOrders?: PurchaseOrder[];
  currentStaff: string;
  currentRole?: StaffRole;
  beerStyles?: string[];
  onAddNewBeerStyle?: (newStyle: string) => void;
  onAdjustStock?: (id: string, delta: number) => void;
  onOpenNewProductModal?: () => void;
  onAddPurchaseOrder?: (order: PurchaseOrder) => void;
  onSubmitBatchOrders?: (orders: PurchaseOrder[]) => void;
  onReceivePurchaseOrder?: (orderId: string) => void;
  onQuickPackagedPull?: (params: {
    sku: string;
    brand: string;
    cansToDeduct: number;
    formatLabel: string;
  }) => void;
  onAuditPackagedStock?: (params: {
    sku: string;
    brand: string;
    newBaseCans: number;
    delta: number;
    staffMember: string;
  }) => void;
  onUpdateBeerCatalogItem?: (item: CoolerItem) => void;
  onUpdateSpiritCatalogItem?: (item: SpiritItem) => void;
}

export const CoolerStockOverview: React.FC<CoolerStockOverviewProps> = ({
  coolerStock,
  spiritsCatalog = [],
  purchaseOrders = [],
  currentStaff,
  currentRole = 'Manager',
  beerStyles = [],
  onAddNewBeerStyle,
  onAdjustStock,
  onOpenNewProductModal,
  onAddPurchaseOrder,
  onSubmitBatchOrders,
  onReceivePurchaseOrder,
  onQuickPackagedPull,
  onAuditPackagedStock,
  onUpdateBeerCatalogItem,
  onUpdateSpiritCatalogItem,
}) => {
  const isManager = isManagerOrSupervisor(currentRole);
  const [isManageCatalogOpen, setIsManageCatalogOpen] = useState(false);
  const [catalogStatusFilter, setCatalogStatusFilter] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [manageSubtab, setManageSubtab] = useState<'BEER' | 'SPIRITS'>('BEER');
  const [archivedSubtab, setArchivedSubtab] = useState<'ALL' | 'BEER' | 'SPIRITS'>('ALL');
  const [formatFilter, setFormatFilter] = useState<'ALL' | '1/2 BBL' | '1/6 BBL' | 'PACKAGED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Packaged audit modal state
  const [auditItem, setAuditItem] = useState<CoolerItem | null>(null);

  // Quick feedback toast
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Active / Deactivated item groupings
  const activeCoolerStock = useMemo(() => {
    return coolerStock.filter((c) => c.status !== 'Inactive');
  }, [coolerStock]);

  const inactiveCoolerStock = useMemo(() => {
    return coolerStock.filter((c) => c.status === 'Inactive');
  }, [coolerStock]);

  const activeSpiritsCatalog = useMemo(() => {
    return spiritsCatalog.filter((s) => s.status !== 'Inactive');
  }, [spiritsCatalog]);

  const inactiveSpiritsCatalog = useMemo(() => {
    return spiritsCatalog.filter((s) => s.status === 'Inactive');
  }, [spiritsCatalog]);

  const totalActiveCatalogCount = activeCoolerStock.length + activeSpiritsCatalog.length;
  const totalArchivedCatalogCount = inactiveCoolerStock.length + inactiveSpiritsCatalog.length;

  // Editing state for catalog items (item SKU -> partial changes)
  const [editingBeerId, setEditingBeerId] = useState<string | null>(null);
  const [editBeerStyle, setEditBeerStyle] = useState('');
  const [editBeerPar, setEditBeerPar] = useState<number>(2);

  const [editingSpiritSku, setEditingSpiritSku] = useState<string | null>(null);
  const [editSpiritPar, setEditSpiritPar] = useState<number>(3);
  const [editSpiritCategory, setEditSpiritCategory] = useState('');

  // Purchase & Restock Orders state
  const [isBulkOrderModalOpen, setIsBulkOrderModalOpen] = useState(false);
  const [isOrdersViewOpen, setIsOrdersViewOpen] = useState(false);
  const [ordersFilter, setOrdersFilter] = useState<'OPEN' | 'ALL'>('OPEN');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // Active On-Order quantity lookup
  const getOnOrderQuantity = (sku: string, brand: string) => {
    return purchaseOrders
      .filter(
        (o) =>
          o.status === 'Ordered' &&
          (o.sku.toLowerCase() === sku.toLowerCase() ||
            o.brand.toLowerCase() === brand.toLowerCase())
      )
      .reduce((sum, o) => sum + o.quantity, 0);
  };

  const openOrdersCount = purchaseOrders.filter((o) => o.status === 'Ordered').length;

  const displayedOrders = purchaseOrders.filter((o) => {
    if (ordersFilter === 'OPEN' && o.status !== 'Ordered') return false;
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase();
      const matchBrand = o.brand.toLowerCase().includes(q);
      const matchSku = o.sku.toLowerCase().includes(q);
      const matchId = o.id.toLowerCase().includes(q);
      const matchVendor = (o.vendor || '').toLowerCase().includes(q);
      const matchLoggedBy = (o.loggedBy || '').toLowerCase().includes(q);
      return matchBrand || matchSku || matchId || matchVendor || matchLoggedBy;
    }
    return true;
  });

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => {
      setActionToast((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Helper to identify packaged beers (16oz Cans, Packaged Cases, etc.)
  const isPackagedBeer = (item: CoolerItem) => {
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

  // Metrics (Strictly computed only from Active stock)
  const halfBblCount = activeCoolerStock
    .filter((c) => c.format === '1/2 BBL')
    .reduce((sum, item) => sum + item.count, 0);

  const sixthBblCount = activeCoolerStock
    .filter((c) => c.format === '1/6 BBL')
    .reduce((sum, item) => sum + item.count, 0);

  const packagedItems = activeCoolerStock.filter(isPackagedBeer);
  const totalPackagedCans = packagedItems.reduce(
    (sum, item) => sum + (item.baseCanCount ?? item.count),
    0
  );

  const lowStockItems = activeCoolerStock.filter((c) => c.count <= 1);

  // Filter items for normal view (Inactive items strictly excluded from operational view)
  const filteredStock = activeCoolerStock.filter((item) => {
    if (formatFilter === '1/2 BBL' && item.format !== '1/2 BBL') return false;
    if (formatFilter === '1/6 BBL' && item.format !== '1/6 BBL') return false;
    if (formatFilter === 'PACKAGED' && !isPackagedBeer(item)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.brand.toLowerCase().includes(q) ||
        item.style.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q)
      );
    }

    return true;
  });

  // Packaged items specifically (Inactive items strictly excluded)
  const filteredPackaged = packagedItems.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.brand.toLowerCase().includes(q) ||
        item.style.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Keg-only items for the keg section
  const kegItems = filteredStock.filter((item) => !isPackagedBeer(item));

  // Quick pull handlers
  const handleQuickPull = (item: CoolerItem, cansToPull: number, formatLabel: string) => {
    if (!onQuickPackagedPull) return;
    const currentCans = item.baseCanCount ?? item.count ?? 0;
    if (currentCans < cansToPull) {
      showToast(`⚠️ Insufficient stock for ${formatLabel} (Only ${currentCans} cans left)`);
      return;
    }
    onQuickPackagedPull({
      sku: item.sku,
      brand: item.brand,
      cansToDeduct: cansToPull,
      formatLabel,
    });
    showToast(`Logged pull: ${formatLabel} of ${item.brand} (-${cansToPull} cans)`);
  };

  // Toggle active status for beer
  const handleToggleBeerStatus = (item: CoolerItem) => {
    if (!onUpdateBeerCatalogItem) return;
    const nextStatus: ProductStatus = item.status === 'Inactive' ? 'Active' : 'Inactive';
    const updated = { ...item, status: nextStatus };
    onUpdateBeerCatalogItem(updated);
    if (nextStatus === 'Inactive') {
      showToast(`Deactivated ${item.brand} (${item.sku}) - hidden from all operational views`);
    } else {
      showToast(`✓ Reactivated ${item.brand} (${item.sku}) - restored to all operational screens`);
    }
  };

  // Toggle active status for spirit
  const handleToggleSpiritStatus = (item: SpiritItem) => {
    if (!onUpdateSpiritCatalogItem) return;
    const nextStatus: ProductStatus = item.status === 'Inactive' ? 'Active' : 'Inactive';
    const updated = { ...item, status: nextStatus };
    onUpdateSpiritCatalogItem(updated);
    if (nextStatus === 'Inactive') {
      showToast(`Deactivated ${item.brand} (${item.sku}) - hidden from all operational views`);
    } else {
      showToast(`✓ Reactivated ${item.brand} (${item.sku}) - restored to all operational screens`);
    }
  };

  // Toggle fast select for spirit
  const handleToggleSpiritFastSelect = (item: SpiritItem) => {
    if (!onUpdateSpiritCatalogItem) return;
    const updated = { ...item, fastSelect: !item.fastSelect };
    onUpdateSpiritCatalogItem(updated);
    showToast(`Fast Pick for ${item.brand}: ${!item.fastSelect ? 'ON' : 'OFF'}`);
  };

  // Save inline edit for beer
  const handleSaveBeerEdit = (item: CoolerItem) => {
    if (!onUpdateBeerCatalogItem) return;
    const finalStyle = editBeerStyle.trim() || item.style;
    if (onAddNewBeerStyle && finalStyle && finalStyle !== item.style) {
      onAddNewBeerStyle(finalStyle);
    }
    const updated: CoolerItem = {
      ...item,
      style: finalStyle,
      parLevel: Math.max(0, editBeerPar),
    };
    onUpdateBeerCatalogItem(updated);
    setEditingBeerId(null);
    showToast(`Updated ${item.brand} style & par`);
  };

  // Save inline edit for spirit
  const handleSaveSpiritEdit = (item: SpiritItem) => {
    if (!onUpdateSpiritCatalogItem) return;
    const updated: SpiritItem = {
      ...item,
      category: editSpiritCategory.trim() || item.category,
      defaultPar: Math.max(0, editSpiritPar),
    };
    onUpdateSpiritCatalogItem(updated);
    setEditingSpiritSku(null);
    showToast(`Updated ${item.brand} category & par`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Toast */}
      {actionToast && (
        <div className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionToast}</span>
          </div>
          <span className="text-[11px] text-slate-400">Syncing with Google Sheets</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1/2 BBL */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-white">{halfBblCount} Kegs</div>
            <div className="text-xs text-slate-400 font-medium">1/2 BBL Full Kegs</div>
          </div>
        </div>

        {/* 1/6 BBL */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-white">{sixthBblCount} Kegs</div>
            <div className="text-xs text-slate-400 font-medium">1/6 BBL Sixtels</div>
          </div>
        </div>

        {/* Packaged 16oz Cans Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-white">{totalPackagedCans} Cans</div>
            <div className="text-xs text-emerald-400 font-medium">
              {Math.floor(totalPackagedCans / 24)} Cases, {Math.floor((totalPackagedCans % 24) / 4)} 4-Packs
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center font-bold">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-white">{lowStockItems.length} SKUs</div>
            <div className="text-xs text-rose-300 font-medium">Low Par Stock Alert</div>
          </div>
        </div>
      </div>

      {/* Main Bar Navigation & Catalog Toggle Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Left: Mode Title & Search */}
          <div className="flex items-center gap-3 flex-1">
            <div className="relative min-w-[220px] flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search catalog by brand, SKU, or style..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Right: Manage Catalog, Orders Toggle, + Add Order, and + New Product Button */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Orders drawer toggle */}
            <button
              type="button"
              onClick={() => setIsOrdersViewOpen(!isOrdersViewOpen)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                isOrdersViewOpen
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/25 ring-2 ring-blue-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:border-slate-600'
              }`}
              title="View purchase orders and incoming deliveries"
            >
              <ClipboardList className="w-3.5 h-3.5 text-blue-400" />
              <span>Orders</span>
              {openOrdersCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-mono text-[10px] font-black">
                  {openOrdersCount} open
                </span>
              )}
            </button>

            {isManager && (
              <button
                type="button"
                onClick={() => setIsManageCatalogOpen(!isManageCatalogOpen)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isManageCatalogOpen
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/25 ring-2 ring-purple-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:border-slate-600'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{isManageCatalogOpen ? 'Exit Catalog' : 'Catalog Pars & Archive'}</span>
                {totalArchivedCatalogCount > 0 && !isManageCatalogOpen && (
                  <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono text-[10px] font-black">
                    {totalArchivedCatalogCount} arch
                  </span>
                )}
              </button>
            )}

            {isManager && (
              <button
                type="button"
                onClick={() => setIsBulkOrderModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-md shadow-blue-600/25 transition-all cursor-pointer whitespace-nowrap"
                title="Create a high-velocity bulk purchase & restock order"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>+ Bulk Order</span>
              </button>
            )}

            {isManager && onOpenNewProductModal && (
              <button
                type="button"
                onClick={() => onOpenNewProductModal()}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-md transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>+ New Product</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW: PURCHASE & RESTOCK ORDERS DRAWER / SUB-VIEW (Manager Only / Staff)   */}
        {/* ========================================================================= */}
        {isOrdersViewOpen && (
          <div className="space-y-4 pt-3 border-t border-slate-800 animate-in fade-in duration-150">
            {/* Top Control Bar: Info + Live Vendor/Brand Search + Segmented Filter Pills */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-extrabold text-white text-xs tracking-tight flex items-center gap-2">
                    <span>📋 Purchase & Restock Orders</span>
                    {openOrdersCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-black">
                        {openOrdersCount} open
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Track deliveries from distributors. Click <strong className="text-emerald-400 font-bold">✓ Receive</strong> to auto-increment cooler stock.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Live Vendor / Brand / PO Search */}
                <div className="relative min-w-[210px] flex-1 sm:flex-initial">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search brand, vendor, PO#..."
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  {orderSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setOrderSearchQuery('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-white"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Segmented Filter Pills */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setOrdersFilter('OPEN')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                      ordersFilter === 'OPEN'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Open Orders ({openOrdersCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrdersFilter('ALL')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                      ordersFilter === 'ALL'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All History ({purchaseOrders.length})
                  </button>
                </div>
              </div>
            </div>

            {/* High-Density Tabular Orders Table */}
            {displayedOrders.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs bg-slate-900/50 rounded-2xl border border-slate-800">
                <Truck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="font-semibold text-slate-300">
                  No {ordersFilter === 'OPEN' ? 'open' : ''} purchase orders found
                  {orderSearchQuery && ` matching "${orderSearchQuery}"`}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Use the "+ Bulk Order" button above to log an upcoming delivery.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/90 border-b border-slate-700/80 text-slate-400 text-xs font-semibold uppercase tracking-wider select-none sticky top-0 z-10 backdrop-blur-sm">
                      <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">PO / Batch ID</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Date Placed</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Brand & Product Name</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">SKU & Style</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Format</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Qty Ordered</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Supplier / Vendor</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Logged By</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {displayedOrders.map((order, idx) => {
                      const isOrdered = order.status === 'Ordered';
                      const matchedItem = coolerStock.find(
                        (c) =>
                          c.sku.toLowerCase() === order.sku.toLowerCase() ||
                          c.brand.toLowerCase() === order.brand.toLowerCase()
                      );
                      const style = matchedItem?.style || 'Craft Beer';

                      return (
                        <tr
                          key={order.id}
                          className={`transition-colors hover:bg-slate-700/40 ${
                            idx % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-800/30'
                          }`}
                        >
                          {/* 1. Status */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            {isOrdered ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                <span>Ordered</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>Received</span>
                              </span>
                            )}
                          </td>

                          {/* 2. PO / Batch ID */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="font-mono text-xs font-bold text-blue-400 bg-blue-950/70 border border-blue-800/70 px-2 py-0.5 rounded-md">
                              {order.id}
                            </span>
                          </td>

                          {/* 3. Date Placed */}
                          <td className="py-2 px-3 whitespace-nowrap font-mono text-slate-400 text-xs">
                            {order.timestamp}
                          </td>

                          {/* 4. Brand & Product Name */}
                          <td className="py-2 px-3">
                            <span className="font-bold text-white text-sm whitespace-nowrap">
                              {order.brand}
                            </span>
                          </td>

                          {/* 5. SKU & Style */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-slate-300 font-medium">{style}</span>
                              <span className="font-mono text-[10px] text-slate-500">{order.sku}</span>
                            </div>
                          </td>

                          {/* 6. Format */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200">
                              {order.format}
                            </span>
                          </td>

                          {/* 7. Qty Ordered (centered, high-contrast) */}
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <span className="font-mono font-black text-sm text-white bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-0.5 inline-block min-w-[34px] shadow-inner">
                              {order.quantity}
                            </span>
                          </td>

                          {/* 8. Supplier / Vendor */}
                          <td className="py-2 px-3 whitespace-nowrap text-slate-300 font-medium">
                            {order.vendor || 'In-House Brewery'}
                          </td>

                          {/* 9. Logged By */}
                          <td className="py-2 px-3 whitespace-nowrap text-slate-400">
                            {order.loggedBy}
                          </td>

                          {/* 10. Action */}
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            {isOrdered ? (
                              isManager && onReceivePurchaseOrder ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onReceivePurchaseOrder(order.id);
                                    showToast(
                                      `Received ${order.brand} (+${order.quantity} ${order.format}). Stock updated!`
                                    );
                                  }}
                                  className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white inline-flex items-center gap-1 transition-all cursor-pointer shadow-sm shadow-emerald-600/30 whitespace-nowrap active:scale-95"
                                  title="Confirm delivery received and increment cooler stock"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>✓ Receive</span>
                                </button>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                                  Manager Only
                                </span>
                              )
                            ) : (
                              <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400/80">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="font-semibold text-[11px]">Received</span>
                                {order.receivedAt && (
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    ({order.receivedAt.split(' ')[0]})
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW A: MANAGER CATALOG MANAGEMENT & INACTIVE ARCHIVE CONSOLE             */}
        {/* ========================================================================= */}
        {isManageCatalogOpen && isManager ? (
          <div className="space-y-4 pt-3 border-t border-slate-800 animate-in fade-in duration-150">
            {/* Top Segmented Status Filter: Active Catalog vs Deactivated / Archived */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCatalogStatusFilter('ACTIVE')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    catalogStatusFilter === 'ACTIVE'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Active Catalog ({totalActiveCatalogCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCatalogStatusFilter('ARCHIVED')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    catalogStatusFilter === 'ARCHIVED'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Archive className="w-3.5 h-3.5 text-purple-400" />
                  <span>Deactivated / Archived ({totalArchivedCatalogCount})</span>
                </button>
              </div>

              {/* Subtabs for Active vs Archived Catalog */}
              {catalogStatusFilter === 'ACTIVE' ? (
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setManageSubtab('BEER')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                      manageSubtab === 'BEER'
                        ? 'bg-purple-600 text-white'
                        : 'text-purple-300 hover:text-white'
                    }`}
                  >
                    Beer / Cans ({activeCoolerStock.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setManageSubtab('SPIRITS')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                      manageSubtab === 'SPIRITS'
                        ? 'bg-purple-600 text-white'
                        : 'text-purple-300 hover:text-white'
                    }`}
                  >
                    Spirits ({activeSpiritsCatalog.length})
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setArchivedSubtab('ALL')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                      archivedSubtab === 'ALL'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Inactive ({totalArchivedCatalogCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setArchivedSubtab('BEER')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                      archivedSubtab === 'BEER'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Draft & Cans ({inactiveCoolerStock.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setArchivedSubtab('SPIRITS')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                      archivedSubtab === 'SPIRITS'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Spirits ({inactiveSpiritsCatalog.length})
                  </button>
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* SUBVIEW 1: ACTIVE CATALOG (With Red/Amber Deactivate Buttons)             */}
            {/* ========================================================================= */}
            {catalogStatusFilter === 'ACTIVE' && (
              <>
                {/* Active Beer / Cooler Catalog Table */}
                {manageSubtab === 'BEER' && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Beer className="w-3.5 h-3.5 text-amber-400" />
                        <span>Active Beer & Packaged Catalog ({activeCoolerStock.length})</span>
                      </div>
                      <span className="text-[11px] font-normal text-slate-500">
                        Deactivating removes item immediately from all operational screens
                      </span>
                    </div>

                    <div className="space-y-2">
                      {activeCoolerStock.map((item) => {
                        const isEditing = editingBeerId === item.id;

                        return (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-xl border bg-slate-850/80 border-slate-750 transition-all hover:border-slate-700"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              {/* Item Identity */}
                              <div className="flex items-center gap-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span>Active</span>
                                </span>

                                <div>
                                  <div className="font-bold text-white text-sm flex items-center gap-2">
                                    <span>{item.brand}</span>
                                    <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                      {item.sku}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span>Format: {item.format}</span>
                                    <span>•</span>
                                    <span>Style: <strong className="text-slate-300">{item.style}</strong></span>
                                    <span>•</span>
                                    <span>Par: <strong className="text-amber-400">{item.parLevel}</strong></span>
                                    <span>•</span>
                                    <span>On-Hand: <strong className="text-emerald-400">{item.baseCanCount ?? item.count}</strong></span>
                                  </div>
                                </div>
                              </div>

                              {/* Quick Actions: Edit Par / Style & Deactivate Button */}
                              <div className="flex items-center gap-2 shrink-0">
                                {isEditing ? (
                                  <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-purple-500/50">
                                    <div className="w-44">
                                      <label className="text-[10px] text-slate-400 block mb-0.5">Style (dynamic)</label>
                                      <SearchableStyleSelect
                                        value={editBeerStyle}
                                        onChange={setEditBeerStyle}
                                        onAddNewStyle={(newStyle) => {
                                          setEditBeerStyle(newStyle);
                                          if (onAddNewBeerStyle) onAddNewBeerStyle(newStyle);
                                        }}
                                        styles={beerStyles}
                                        placeholder="Style..."
                                        inputClassName="!py-1 !text-xs !bg-slate-800"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-slate-400 block">Par</label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={editBeerPar}
                                        onChange={(e) => setEditBeerPar(parseInt(e.target.value) || 0)}
                                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white w-14 text-center focus:outline-none focus:border-purple-500"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveBeerEdit(item)}
                                      className="p-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white mt-3"
                                      title="Save Changes"
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingBeerId(null)}
                                      className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 mt-3"
                                      title="Cancel"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingBeerId(item.id);
                                      setEditBeerStyle(item.style);
                                      setEditBeerPar(item.parLevel);
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                                  >
                                    <Edit3 className="w-3 h-3 text-purple-400" />
                                    <span>Edit Par / Style</span>
                                  </button>
                                )}

                                {/* Red / Amber Deactivate Button */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleBeerStatus(item)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 hover:border-rose-400 flex items-center gap-1.5 transition-all cursor-pointer"
                                  title="Deactivate item (immediately hides from all operational screens)"
                                >
                                  <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Deactivate</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Active Spirits Catalog Table */}
                {manageSubtab === 'SPIRITS' && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wine className="w-3.5 h-3.5 text-purple-400" />
                        <span>Active Master Spirits Catalog ({activeSpiritsCatalog.length})</span>
                      </div>
                      <span className="text-[11px] font-normal text-slate-500">
                        Deactivating removes bottle immediately from Fast Pick and Station views
                      </span>
                    </div>

                    <div className="space-y-2">
                      {activeSpiritsCatalog.map((item) => {
                        const isEditing = editingSpiritSku === item.sku;

                        return (
                          <div
                            key={item.sku}
                            className="p-3.5 rounded-xl border bg-slate-850/80 border-slate-750 transition-all hover:border-slate-700"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              {/* Item Identity */}
                              <div className="flex items-center gap-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span>Active</span>
                                </span>

                                <div>
                                  <div className="font-bold text-white text-sm flex items-center gap-2">
                                    <span>{item.brand}</span>
                                    <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                      {item.sku}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                                    <span>Category: <strong className="text-slate-300">{item.category}</strong></span>
                                    <span>•</span>
                                    <span>Par: <strong className="text-amber-400">{item.defaultPar}</strong></span>
                                  </div>
                                </div>
                              </div>

                              {/* Fast Pick toggle, inline edit, and Deactivate */}
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSpiritFastSelect(item)}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                    item.fastSelect
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                                  }`}
                                  title="Toggle Fast Pick button on Bartender grid"
                                >
                                  Fast Pick: {item.fastSelect ? 'YES' : 'NO'}
                                </button>

                                {isEditing ? (
                                  <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-purple-500/50">
                                    <div>
                                      <label className="text-[10px] text-slate-400 block">Category</label>
                                      <input
                                        type="text"
                                        value={editSpiritCategory}
                                        onChange={(e) => setEditSpiritCategory(e.target.value)}
                                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white w-28 focus:outline-none focus:border-purple-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-slate-400 block">Par</label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={editSpiritPar}
                                        onChange={(e) => setEditSpiritPar(parseInt(e.target.value) || 0)}
                                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white w-14 text-center focus:outline-none focus:border-purple-500"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveSpiritEdit(item)}
                                      className="p-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white mt-3"
                                      title="Save Changes"
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingSpiritSku(null)}
                                      className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 mt-3"
                                      title="Cancel"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSpiritSku(item.sku);
                                      setEditSpiritCategory(item.category);
                                      setEditSpiritPar(item.defaultPar);
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                                  >
                                    <Edit3 className="w-3 h-3 text-purple-400" />
                                    <span>Edit Par / Category</span>
                                  </button>
                                )}

                                {/* Red / Amber Deactivate Button */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleSpiritStatus(item)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 hover:border-rose-400 flex items-center gap-1.5 transition-all cursor-pointer"
                                  title="Deactivate spirit (immediately hides from all operational screens)"
                                >
                                  <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Deactivate</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ========================================================================= */}
            {/* SUBVIEW 2: DEACTIVATED / ARCHIVED CATALOG (With Prominent Green Reactivate)*/}
            {/* ========================================================================= */}
            {catalogStatusFilter === 'ARCHIVED' && (
              <div className="space-y-3">
                <div className="bg-purple-950/20 border border-purple-800/40 rounded-xl p-3.5 flex items-center gap-3 text-xs text-purple-200">
                  <Archive className="w-4 h-4 text-purple-400 shrink-0" />
                  <div>
                    <strong className="text-white font-bold">Deactivated / Archived Items Console:</strong>{' '}
                    These items are strictly excluded from Cooler Stock, Tap Swaps, Fast Spirit Pulls, and Bulk Ordering.
                    Click <span className="text-emerald-400 font-bold">✓ Reactivate</span> below to immediately restore any item back to operational screens.
                  </div>
                </div>

                {totalArchivedCatalogCount === 0 ? (
                  <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl text-xs text-slate-500">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500/50 mx-auto mb-2" />
                    <p className="font-bold text-slate-400">No Deactivated Items in Archive</p>
                    <p className="text-[11px] mt-0.5">All master beers, kegs, packaged cans, and spirits are active.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Render Inactive Beers */}
                    {(archivedSubtab === 'ALL' || archivedSubtab === 'BEER') &&
                      inactiveCoolerStock.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 hover:bg-slate-900 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                              <span>Deactivated</span>
                            </span>

                            <div>
                              <div className="font-bold text-white text-sm flex items-center gap-2">
                                <span>{item.brand}</span>
                                <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                  {item.sku}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                  Beer
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                                <span>Format: <strong className="text-slate-300">{item.format}</strong></span>
                                <span>•</span>
                                <span>Style: {item.style}</span>
                                <span>•</span>
                                <span>Last Known Stock: <strong className="text-slate-300">{item.baseCanCount ?? item.count}</strong></span>
                                <span>•</span>
                                <span>Par: {item.parLevel}</span>
                              </div>
                            </div>
                          </div>

                          {/* Prominent Green Reactivate Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleBeerStatus(item)}
                            className="px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                            title="Reactivate item (restores to all operational screens)"
                          >
                            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                            <span>✓ Reactivate</span>
                          </button>
                        </div>
                      ))}

                    {/* Render Inactive Spirits */}
                    {(archivedSubtab === 'ALL' || archivedSubtab === 'SPIRITS') &&
                      inactiveSpiritsCatalog.map((item) => (
                        <div
                          key={item.sku}
                          className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 hover:bg-slate-900 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                              <span>Deactivated</span>
                            </span>

                            <div>
                              <div className="font-bold text-white text-sm flex items-center gap-2">
                                <span>{item.brand}</span>
                                <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                  {item.sku}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                  Spirit
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                                <span>Category: <strong className="text-slate-300">{item.category}</strong></span>
                                <span>•</span>
                                <span>Format: 750ml Bottle</span>
                                <span>•</span>
                                <span>Default Par: {item.defaultPar}</span>
                              </div>
                            </div>
                          </div>

                          {/* Prominent Green Reactivate Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleSpiritStatus(item)}
                            className="px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                            title="Reactivate spirit (restores to all operational screens)"
                          >
                            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                            <span>✓ Reactivate</span>
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW B: STANDARD STOCK OVERVIEW (PACKAGED + DRAFT)                       */
          /* ========================================================================= */
          <div className="space-y-8">
            {/* Bar Staff Read-Only Notice */}
            {!isManager && (
              <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-blue-200 text-xs flex items-center gap-3 shadow-md animate-in fade-in duration-150">
                <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <span className="font-bold text-white">Bar Staff Read-Only Access:</span> Cooler inventory is displayed for stock lookup only. Bar staff permissions permit changing kegs on taps, pulling spirits, and processing keg deposits. Manual stock count adjustments, packaged audits, and catalog modifications are restricted to Management.
                </div>
              </div>
            )}

            {/* 1. DEDICATED SECTION: PACKAGED BEER (16OZ CANS / 4-PACKS / CASES) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
                    <Archive className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      <span>Packaged Beer (16oz Cans)</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {filteredPackaged.length} SKUs
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Atomic single can tracking: 1 Case = 24 cans • 1 Four-Pack = 4 cans
                    </p>
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <span className="text-xs text-slate-400 font-medium block">Total Base Inventory</span>
                  <span className="text-sm font-extrabold text-emerald-400">
                    {totalPackagedCans} Total Cans
                  </span>
                </div>
              </div>

              {/* Packaged Beer Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredPackaged.map((item) => {
                  const currentTotalCans = item.baseCanCount ?? item.count ?? 0;
                  const breakdown = getPackagedBreakdown(currentTotalCans);
                  const isLow = currentTotalCans <= (item.parLevel || 24);
                  const onOrderQty = getOnOrderQuantity(item.sku, item.brand);

                  return (
                    <div
                      key={item.id}
                      className="bg-slate-850 border border-slate-750 hover:border-slate-650 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between gap-4 transition-all"
                    >
                      {/* Card Header: Brand, SKU, and Status */}
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-extrabold text-white text-base leading-tight">
                              {item.brand}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                              <span className="font-mono text-emerald-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                {item.sku}
                              </span>
                              <span>•</span>
                              <span>{item.style}</span>
                              <span>•</span>
                              <span>Par: {item.parLevel} cans</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {item.status === 'Inactive' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                Inactive
                              </span>
                            )}
                            {isManager ? (
                              <button
                                type="button"
                                onClick={() => setAuditItem(item)}
                                className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer"
                                title="Open Physical Count & Audit Modal"
                              >
                                <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Audit Count</span>
                              </button>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-400 bg-slate-800/90 px-2 py-1 rounded-lg border border-slate-700">
                                View Only
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Breakdown Display: X Cases, Y 4-Packs, Z Singles (Total: N cans) */}
                        <div className="mt-3.5 p-3 rounded-xl bg-slate-900 border border-slate-800">
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                            <span>Current Stock Breakdown</span>
                            <div className="flex items-center gap-2">
                              {onOrderQty > 0 && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-700 text-blue-300 border border-slate-600 flex items-center gap-1 shadow-sm">
                                  <span>🚚</span>
                                  <span>{onOrderQty} on order</span>
                                </span>
                              )}
                              <span className={isLow ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                                {isLow ? '⚠️ Low Par' : 'Optimal'}
                              </span>
                            </div>
                          </div>

                          <div className="text-sm sm:text-base font-black text-white">
                            {breakdown.formatted}
                          </div>

                          {/* Visual Quantity Pill Badges */}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              {breakdown.cases} Cases
                            </span>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                              {breakdown.fourPacks} 4-Packs
                            </span>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {breakdown.singles} Singles
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Depletion Buttons for Retail / To-Go Pulls (Immediate Log to Sheet) */}
                      <div className="pt-2 border-t border-slate-800/80">
                        <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <Archive className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Retail / To-Go Pull</span>
                          </span>
                          <span className="text-[10px] text-slate-400">Logs directly to sheet</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            disabled={currentTotalCans < 4}
                            onClick={() => handleQuickPull(item, 4, '4-Pack (-4)')}
                            className="py-2.5 px-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 active:bg-cyan-900/40 text-slate-200 hover:text-white border border-slate-700 hover:border-cyan-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer text-center"
                          >
                            <span className="block text-[11px] text-cyan-400 font-mono font-black">-4 cans</span>
                            <span className="font-bold">Pull 4-Pack</span>
                          </button>

                          <button
                            type="button"
                            disabled={currentTotalCans < 24}
                            onClick={() => handleQuickPull(item, 24, 'Full Case (-24)')}
                            className="py-2.5 px-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 active:bg-emerald-900/40 text-slate-200 hover:text-white border border-slate-700 hover:border-emerald-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer text-center"
                          >
                            <span className="block text-[11px] text-emerald-400 font-mono font-black">-24 cans</span>
                            <span className="font-bold">Pull Case</span>
                          </button>

                          <button
                            type="button"
                            disabled={currentTotalCans < 1}
                            onClick={() => handleQuickPull(item, 1, 'Single Can (-1)')}
                            className="py-2.5 px-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 active:bg-amber-900/40 text-slate-200 hover:text-white border border-slate-700 hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer text-center"
                          >
                            <span className="block text-[11px] text-amber-400 font-mono font-black">-1 can</span>
                            <span className="font-bold">Pull Single</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. DRAFT & COOLER KEG INVENTORY SECTION */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
                    <Beer className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Cooler Draft Keg Inventory</h3>
                    <p className="text-xs text-slate-400">1/2 BBL Full Kegs & 1/6 BBL Specialty Sixtels</p>
                  </div>
                </div>

                {/* Format Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setFormatFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      formatFilter === 'ALL'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    All Kegs
                  </button>
                  <button
                    onClick={() => setFormatFilter('1/2 BBL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      formatFilter === '1/2 BBL'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    1/2 BBL ({halfBblCount})
                  </button>
                  <button
                    onClick={() => setFormatFilter('1/6 BBL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      formatFilter === '1/6 BBL'
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    1/6 BBL ({sixthBblCount})
                  </button>
                </div>
              </div>

              {/* Keg items list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {kegItems.map((item) => {
                  const isZero = item.count === 0;
                  const isLow = item.count === 1;
                  const onOrderQty = getOnOrderQuantity(item.sku, item.brand);

                  return (
                    <div
                      key={item.id}
                      className="bg-slate-850 border border-slate-750 hover:border-slate-650 rounded-xl p-3.5 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                            item.format === '1/2 BBL'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          {item.format === '1/2 BBL' ? '1/2' : '1/6'}
                        </div>

                        <div>
                          <div className="font-bold text-white text-sm leading-snug flex items-center gap-2">
                            <span>{item.brand}</span>
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                              {item.sku}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{item.style}</span>
                            <span>•</span>
                            <span className="text-slate-300 font-medium">{item.format}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {/* On Order Pill Badge */}
                        {onOrderQty > 0 && (
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-700 text-blue-300 border border-slate-600 flex items-center gap-1 shrink-0 shadow-sm"
                            title={`${onOrderQty} on order`}
                          >
                            <span>🚚</span>
                            <span>{onOrderQty} on order</span>
                          </span>
                        )}

                        {/* Stock count badge */}
                        <div className="text-right">
                          <span
                            className={`text-sm sm:text-base font-extrabold px-3 py-1 rounded-xl block leading-tight ${
                              isZero
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : isLow
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {item.count} {item.unit}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            Par: {item.parLevel}
                          </span>
                        </div>

                        {/* Adjust buttons */}
                        {isManager && onAdjustStock ? (
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => onAdjustStock(item.id, 1)}
                              className="p-1 rounded bg-slate-750 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
                              title="Add 1 keg"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={item.count <= 0}
                              onClick={() => onAdjustStock(item.id, -1)}
                              className="p-1 rounded bg-slate-750 hover:bg-slate-700 text-slate-200 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
                              title="Deduct 1 keg"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-800/90 px-1.5 py-1 rounded-md border border-slate-750">
                            Locked
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Packaged Beer Audit Modal */}
      <PackagedAuditModal
        isOpen={Boolean(auditItem)}
        onClose={() => setAuditItem(null)}
        item={auditItem}
        currentStaff={currentStaff}
        onConfirmAudit={(params) => {
          if (onAuditPackagedStock) {
            onAuditPackagedStock(params);
            showToast(`Physical audit recorded: ${params.brand} = ${params.newBaseCans} cans`);
          }
        }}
      />

      {/* High-Velocity Bulk Purchase & Restock Order Matrix Modal */}
      <BulkOrderMatrixModal
        isOpen={isBulkOrderModalOpen}
        onClose={() => setIsBulkOrderModalOpen(false)}
        coolerStock={coolerStock}
        spiritsCatalog={spiritsCatalog}
        currentStaff={currentStaff}
        onSubmitBatchOrders={(orders) => {
          if (onSubmitBatchOrders) {
            onSubmitBatchOrders(orders);
          } else if (onAddPurchaseOrder) {
            orders.forEach((o) => onAddPurchaseOrder(o));
          }
          showToast(`Submitted purchase order batch: ${orders[0]?.id || ''} (${orders.length} items)`);
        }}
      />
    </div>
  );
};
