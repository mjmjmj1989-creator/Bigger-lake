export type KegFormat = '1/2 BBL' | '1/6 BBL';
export type Station = 'Service Well' | 'Inside Main Bar' | 'Patio Bar';
export type DepositTransaction = 'Deposit Charged $30' | 'Deposit Refunded $30';
export type DepositStatus = 'Active' | 'Returned & Refunded';
export type StaffRole = 'Manager' | 'Shift Supervisor' | 'Bartender';
export type StaffStatus = 'Active' | 'Inactive';

export interface StaffUser {
  id: string;
  name: string;
  role: StaffRole;
  status: StaffStatus;
  title?: string;
  pin?: string;
}

export type StaffMember = StaffUser;

export function isManagerOrSupervisor(role: StaffRole): boolean {
  return role === 'Manager' || role === 'Shift Supervisor';
}

export type OnDeckType = 'AUTO_SAME_BRAND' | 'IMMEDIATE_REPLACEMENT' | 'SCHEDULED_ROTATION';

export interface Tap {
  tapNumber: number;
  location: 'Inside' | 'Patio';
  sku: string;
  brand: string;
  style: string;
  format: KegFormat;
  abv?: string;
  coolerStockHalfBbl: number;
  coolerStockSixthBbl: number;
  lastChanged: string;
  changedBy: string;
  // On-Deck Pre-Assigned Keg fields & Scheduling
  onDeckSku?: string;
  onDeckBrand?: string;
  onDeckFormat?: KegFormat;
  onDeckStyle?: string;
  onDeckType?: OnDeckType;
  onDeckScheduledDate?: string;
  onDeckNotes?: string;
}

export type ProductStatus = 'Active' | 'Inactive';

export interface CoolerItem {
  id: string; // SKU identifier
  sku: string;
  brand: string;
  style: string;
  format: '1/2 BBL' | '1/6 BBL' | '16oz Can' | 'Packaged 4-Pk' | 'Packaged Case' | 'Packaged 16oz';
  count: number; // For kegs: # of kegs; for packaged: base total cans
  parLevel: number;
  unit: string;
  status?: ProductStatus;
  abv?: string;
  baseCanCount?: number; // Total single cans
}

export interface SpiritItem {
  sku: string;
  brand: string;
  category: string;
  defaultPar: number;
  fastSelect: boolean;
  status?: ProductStatus;
}

export interface PackagedMovementEntry {
  id: string;
  timestamp: string;
  sku: string;
  brand: string;
  formatPulled: 'Full Case (-24)' | '4-Pack (-4)' | 'Single Can (-1)' | 'Audit Adjustment' | string;
  cansChanged: number;
  remainingCans: number;
  staffMember: string;
  synced?: boolean;
}

export function getPackagedBreakdown(totalCans: number) {
  const safeTotal = Math.max(0, Math.round(totalCans || 0));
  const cases = Math.floor(safeTotal / 24);
  const remainderAfterCases = safeTotal % 24;
  const fourPacks = Math.floor(remainderAfterCases / 4);
  const singles = remainderAfterCases % 4;
  return {
    cases,
    fourPacks,
    singles,
    totalCans: safeTotal,
    formatted: `${cases} Cases, ${fourPacks} 4-Packs, ${singles} Singles (Total: ${safeTotal} cans)`,
  };
}

export interface KegChangeLogEntry {
  id: string;
  timestamp: string;
  tapNumber: number;
  oldSku: string;
  oldBrand: string;
  newSku: string;
  newBrand: string;
  format: KegFormat;
  staffMember: string;
  synced?: boolean;
}

export interface SpiritRemovalEntry {
  id: string;
  timestamp: string;
  station: Station;
  spiritSku: string;
  spiritBrand: string;
  bottleCount: number;
  staffMember: string;
  synced?: boolean;
}

export interface KegDepositEntry {
  id: string;
  date: string;
  customerName: string;
  phone: string;
  transaction: DepositTransaction;
  amount: number;
  status: DepositStatus;
  loggedBy: string;
  synced?: boolean;
}

export type OrderStatus = 'Ordered' | 'Received';

export interface PurchaseOrder {
  id: string; // Order ID, e.g. PO-101
  timestamp: string;
  sku: string;
  brand: string;
  format: string;
  quantity: number;
  vendor?: string;
  status: OrderStatus;
  loggedBy: string;
  receivedAt?: string;
  synced?: boolean;
}

export interface QueueItem {
  id: string;
  type:
    | 'TAP_SWAP'
    | 'SPIRIT_PULL'
    | 'KEG_DEPOSIT'
    | 'STOCK_ADJUST'
    | 'ON_DECK_UPDATE'
    | 'ADD_BEER_PRODUCT'
    | 'ADD_SPIRIT_PRODUCT'
    | 'PACKAGED_MOVEMENT'
    | 'CATALOG_UPDATE'
    | 'ADD_BEER_STYLE'
    | 'ADD_PURCHASE_ORDER'
    | 'RECEIVE_PURCHASE_ORDER'
    | 'BATCH_PURCHASE_ORDERS'
    | 'UPDATE_STAFF_PIN';
  payload: any;
  timestamp: number;
  retryCount: number;
}

export interface SpreadsheetConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  lastSyncedAt?: string;
  autoSync: boolean;
}
