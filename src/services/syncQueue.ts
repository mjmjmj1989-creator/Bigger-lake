import {
  QueueItem,
  Tap,
  KegChangeLogEntry,
  SpiritRemovalEntry,
  KegDepositEntry,
  CoolerItem,
  SpiritItem,
  PackagedMovementEntry,
  PurchaseOrder,
} from '../types/taproom';
import {
  updateTapRow,
  appendKegChangeRow,
  appendSpiritRemovalRow,
  appendKegDepositRow,
  appendCoolerItemRow,
  appendSpiritItemRow,
  appendPackagedMovementRow,
  updateCoolerItemRow,
  updateSpiritItemRow,
  appendPurchaseOrderRow,
  appendPurchaseOrdersBatch,
  updatePurchaseOrderStatus,
  updateStaffMemberPin,
} from './sheetsService';

export type QueueStatus = 'idle' | 'syncing' | 'offline' | 'error';

export interface QueueState {
  status: QueueStatus;
  pendingCount: number;
  lastSyncedAt: Date | null;
  lastError: string | null;
}

type QueueListener = (state: QueueState) => void;

class SyncQueueManager {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private listeners: Set<QueueListener> = new Set();
  private lastSyncedAt: Date | null = null;
  private lastError: string | null = null;
  private status: QueueStatus = 'idle';
  private getAuthToken: (() => Promise<string | null>) | null = null;
  private getSpreadsheetId: (() => string | null) | null = null;

  constructor() {
    this.loadFromStorage();
    this.clearStalledItems();
  }

  public init(
    getAuthToken: () => Promise<string | null>,
    getSpreadsheetId: () => string | null
  ) {
    this.getAuthToken = getAuthToken;
    this.getSpreadsheetId = getSpreadsheetId;
    this.clearStalledItems();
    this.processQueue();
  }

  public clearStalledItems(): number {
    const originalCount = this.queue.length;
    // Drop jobs that failed repeatedly, are unrecoverable, or are older than 5 minutes
    this.queue = this.queue.filter((item) => {
      const isRetryingTooMuch = item.retryCount >= 2;
      const isTooOld = Date.now() - item.timestamp > 5 * 60 * 1000;
      return !isRetryingTooMuch && !isTooOld;
    });

    if (this.queue.length === 0) {
      this.status = 'idle';
      this.lastError = null;
    }
    this.isProcessing = false;
    this.saveToStorage();
    this.notify();
    return originalCount - this.queue.length;
  }

  public subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  public getState(): QueueState {
    return {
      status: this.status,
      pendingCount: this.queue.length,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('Queue listener error:', err);
      }
    });
  }

  private saveToStorage() {
    try {
      localStorage.setItem('tapflow_queue_v1', JSON.stringify(this.queue));
    } catch (e) {
      console.warn('Could not save queue to localStorage', e);
    }
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem('tapflow_queue_v1');
      if (data) {
        this.queue = JSON.parse(data);
      }
    } catch (e) {
      console.warn('Could not parse queue from localStorage', e);
      this.queue = [];
    }
  }

  public enqueue(
    type: QueueItem['type'],
    payload: any
  ) {
    const item: QueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(item);
    this.saveToStorage();
    this.notify();
    this.processQueue();
  }

  public retry() {
    this.lastError = null;
    this.processQueue();
  }

  public clearQueue() {
    this.queue = [];
    this.lastError = null;
    this.status = 'idle';
    this.saveToStorage();
    this.notify();
  }

  private async processQueue() {
    if (this.isProcessing) return;
    if (this.queue.length === 0) {
      this.status = 'idle';
      this.notify();
      return;
    }

    if (!this.getAuthToken || !this.getSpreadsheetId) {
      // Offline/Local demo mode: Items stay queued or can be considered locally applied
      this.status = 'offline';
      this.notify();
      return;
    }

    const token = await this.getAuthToken();
    const spreadsheetId = this.getSpreadsheetId();

    if (!token || !spreadsheetId) {
      this.status = 'offline';
      this.notify();
      return;
    }

    this.isProcessing = true;
    this.status = 'syncing';
    this.notify();

    while (this.queue.length > 0) {
      const item = this.queue[0];

      try {
        await this.executeJob(item, token, spreadsheetId);
        // Remove item on success
        this.queue.shift();
        this.saveToStorage();
        this.lastSyncedAt = new Date();
        this.lastError = null;
        this.notify();

        // Brief cooldown to avoid Google Sheets API rate-limit spikes
        await new Promise((res) => setTimeout(res, 250));
      } catch (err: any) {
        console.error('Queue job failed:', item, err);
        const errMsg = String(err?.message || '');
        const isFatal =
          errMsg.includes('400') ||
          errMsg.includes('404') ||
          errMsg.includes('Unable to parse range') ||
          item.retryCount >= 2;

        if (isFatal) {
          // Drop stalled or unrecoverable item so subsequent syncs and reads are never blocked
          console.warn('Auto-clearing stalled queue item to unblock sync:', item);
          this.queue.shift();
          this.saveToStorage();
          this.lastError = errMsg ? `Skipped invalid job: ${errMsg}` : null;
          this.notify();
          continue;
        }

        item.retryCount += 1;
        this.saveToStorage();
        this.notify();
        await new Promise((res) => setTimeout(res, 1000));
      }
    }

    this.status = 'idle';
    this.isProcessing = false;
    this.notify();
  }

  private async executeJob(item: QueueItem, token: string, spreadsheetId: string) {
    switch (item.type) {
      case 'TAP_SWAP': {
        const { tap, logEntry }: { tap: Tap; logEntry: KegChangeLogEntry } = item.payload;
        // 1. Update the tap line in On-Tap tab
        await updateTapRow(token, spreadsheetId, tap);
        // 2. Append entry into Keg Change Log tab
        await appendKegChangeRow(token, spreadsheetId, logEntry);
        break;
      }
      case 'SPIRIT_PULL': {
        const entry: SpiritRemovalEntry = item.payload;
        await appendSpiritRemovalRow(token, spreadsheetId, entry);
        break;
      }
      case 'ON_DECK_UPDATE': {
        const tap: Tap = item.payload;
        await updateTapRow(token, spreadsheetId, tap);
        break;
      }
      case 'KEG_DEPOSIT': {
        const entry: KegDepositEntry = item.payload;
        await appendKegDepositRow(token, spreadsheetId, entry);
        break;
      }
      case 'ADD_BEER_PRODUCT': {
        const beerItem: CoolerItem = item.payload;
        await appendCoolerItemRow(token, spreadsheetId, beerItem);
        break;
      }
      case 'ADD_SPIRIT_PRODUCT': {
        const spiritItem: SpiritItem = item.payload;
        await appendSpiritItemRow(token, spreadsheetId, spiritItem);
        break;
      }
      case 'PACKAGED_MOVEMENT': {
        const movement: PackagedMovementEntry = item.payload;
        await appendPackagedMovementRow(token, spreadsheetId, movement);
        break;
      }
      case 'CATALOG_UPDATE': {
        const { type, item: catalogItem, rowIndex } = item.payload;
        if (type === 'BEER') {
          await updateCoolerItemRow(token, spreadsheetId, catalogItem, rowIndex);
        } else if (type === 'SPIRIT') {
          await updateSpiritItemRow(token, spreadsheetId, catalogItem, rowIndex);
        }
        break;
      }
      case 'ADD_PURCHASE_ORDER': {
        const order: PurchaseOrder = item.payload;
        await appendPurchaseOrderRow(token, spreadsheetId, order);
        break;
      }
      case 'BATCH_PURCHASE_ORDERS': {
        const orders: PurchaseOrder[] = item.payload;
        await appendPurchaseOrdersBatch(token, spreadsheetId, orders);
        break;
      }
      case 'RECEIVE_PURCHASE_ORDER': {
        const { orderId, newStatus, rowIndex } = item.payload;
        await updatePurchaseOrderStatus(token, spreadsheetId, orderId, newStatus, rowIndex);
        break;
      }
      case 'UPDATE_STAFF_PIN': {
        const { staffName, newPin } = item.payload;
        await updateStaffMemberPin(token, spreadsheetId, staffName, newPin);
        break;
      }
      default:
        console.warn('Unknown queue item type', item.type);
    }
  }
}

export const syncQueue = new SyncQueueManager();
