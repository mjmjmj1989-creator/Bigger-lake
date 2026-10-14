/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  Tap,
  CoolerItem,
  SpiritItem,
  KegChangeLogEntry,
  SpiritRemovalEntry,
  KegDepositEntry,
  PackagedMovementEntry,
  SpreadsheetConfig,
  KegFormat,
  Station,
  DepositTransaction,
  StaffRole,
  StaffUser,
  OnDeckType,
  PurchaseOrder,
} from './types/taproom';
import {
  INITIAL_TAPS,
  INITIAL_COOLER_STOCK,
  INITIAL_SPIRITS,
  INITIAL_KEG_CHANGES,
  INITIAL_SPIRIT_REMOVALS,
  INITIAL_KEG_DEPOSITS,
  INITIAL_STAFF_USERS,
  INITIAL_PACKAGED_MOVEMENTS,
  INITIAL_BEER_STYLES,
  INITIAL_PURCHASE_ORDERS,
} from './data/initialData';
import { initAuth, googleSignIn, logout, getAccessToken } from './services/auth';
import { syncQueue, QueueState } from './services/syncQueue';
import { fetchSpreadsheetData } from './services/sheetsService';
import { Header } from './components/Header';
import { TabNavigation, ActiveTab } from './components/TabNavigation';
import { TapGrid } from './components/TapManager/TapGrid';
import { FastSpiritPulls } from './components/SpiritPulls/FastSpiritPulls';
import { KegDeposits } from './components/KegDeposits/KegDeposits';
import { CoolerStockOverview } from './components/CoolerOverview/CoolerStockOverview';
import { ActivityLogs } from './components/LogsView/ActivityLogs';
import { GoogleConnectModal } from './components/GoogleConnectModal';
import { ProductCreatorModal, ProductType } from './components/ProductCreator/ProductCreatorModal';
import { PinLoginModal } from './components/Auth/PinLoginModal';
import { ManageStaffModal } from './components/StaffManager/ManageStaffModal';

export default function App() {
  // Authentication & Google Sheets state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Spreadsheet Configuration state - persisted across app reloads and rebuilds
  const [spreadsheetConfig, setSpreadsheetConfig] = useState<SpreadsheetConfig>(() => {
    try {
      const saved = localStorage.getItem('tapflow_sheet_config_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.spreadsheetId) {
          return {
            spreadsheetId: parsed.spreadsheetId,
            spreadsheetUrl:
              parsed.spreadsheetUrl ||
              `https://docs.google.com/spreadsheets/d/${parsed.spreadsheetId}/edit`,
            title: parsed.title || 'Taproom Master Inventory',
            lastSyncedAt: parsed.lastSyncedAt,
            autoSync: parsed.autoSync !== false,
          };
        }
      }

      // Standalone spreadsheet ID fallback key (resilient across rebuilds)
      const standaloneId = localStorage.getItem('tapflow_spreadsheet_id');
      if (standaloneId && standaloneId.trim()) {
        const trimmed = standaloneId.trim();
        return {
          spreadsheetId: trimmed,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${trimmed}/edit`,
          title: 'Connected Taproom Master Sheet',
          autoSync: true,
        };
      }
    } catch (e) {
      console.warn('Failed to load sheet config from storage', e);
    }
    return {
      spreadsheetId: '',
      spreadsheetUrl: '',
      title: 'Taproom Master Inventory',
      autoSync: true,
    };
  });

  // Dynamic Staff Members & Role-Based Permissions (Connected to 👥 Staff & Permissions)
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>(() => {
    try {
      const saved = localStorage.getItem('tapflow_staff_users_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load staff from storage', e);
    }
    return INITIAL_STAFF_USERS;
  });

  // Active PIN Session state: 'Bartender' | 'Manager' | 'Shift Supervisor' | null
  const [sessionRole, setSessionRole] = useState<StaffRole | null>(() => {
    try {
      const saved = localStorage.getItem('tapflow_session_role');
      if (saved === 'Bartender' || saved === 'Manager' || saved === 'Shift Supervisor') {
        return saved as StaffRole;
      }
    } catch (e) {
      console.warn('Failed to load session role', e);
    }
    return null;
  });

  const [currentStaff, setCurrentStaff] = useState<string>(() => {
    const saved = localStorage.getItem('tapflow_active_staff');
    if (saved) return saved;
    const activeFirst = INITIAL_STAFF_USERS.find((u) => u.status === 'Active');
    return activeFirst ? activeFirst.name : 'Staff';
  });

  // Current effective staff role reflects sessionRole (or fallback 'Bartender' for underlying types)
  const currentRole: StaffRole = sessionRole || 'Bartender';

  // If no active session exists in localStorage, show the PIN pad automatically on app launch
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tapflow_session_role');
      return !saved;
    } catch {
      return true;
    }
  });

  const handlePinSuccess = (role: StaffRole, staffName: string) => {
    setSessionRole(role);
    setCurrentStaff(staffName);
    localStorage.setItem('tapflow_session_role', role);
    localStorage.setItem('tapflow_active_role', role);
    localStorage.setItem('tapflow_active_staff', staffName);
    setIsPinModalOpen(false);

    // If logging in as Bartender, route the tap manager to the fast speed view
    if (role === 'Bartender') {
      setActiveTab('taps');
    }
  };

  const handleLock = () => {
    setSessionRole(null);
    localStorage.removeItem('tapflow_session_role');
    setIsPinModalOpen(true);
  };

  // Manage Staff & PINs Modal state (Manager Only)
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  const handleUpdateStaffPin = (staffName: string, newPin: string) => {
    setStaffUsers((prev) => {
      const updated = prev.map((u) => (u.name === staffName ? { ...u, pin: newPin } : u));
      try {
        localStorage.setItem('tapflow_staff_users_v2', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save staff users to storage', e);
      }
      return updated;
    });

    syncQueue.enqueue('UPDATE_STAFF_PIN', { staffName, newPin });
  };

  // Product Creator Modal state (Manager Only tool)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productModalType, setProductModalType] = useState<ProductType>('BEER');

  const handleOpenProductModal = (type: ProductType) => {
    setProductModalType(type);
    setIsProductModalOpen(true);
  };

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('taps');

  // Queue State
  const [queueState, setQueueState] = useState<QueueState>(syncQueue.getState());

  // Master Taproom State (Initialized from localStorage or authentic Big Lake Brewing seed)
  const [taps, setTaps] = useState<Tap[]>(() => {
    try {
      const saved =
        localStorage.getItem('tapflow_taps_biglake_v2') || localStorage.getItem('tapflow_taps_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure no legacy placeholder mock beers exist in local cache
        const hasLegacyPlaceholders =
          Array.isArray(parsed) &&
          parsed.some((t: Tap) =>
            /hop hysteria|ghost town|cyber lager|neon haze|retro ipa|leroy brown|penny pinching|patio sunset|patio blonde|patio crisp|cottage wheat|belly float|great lakes pilsner|campers|ryecar|sparta$/i.test(
              t.brand || ''
            )
          );
        if (!hasLegacyPlaceholders && Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load taps from storage', e);
    }
    return INITIAL_TAPS;
  });

  const [coolerStock, setCoolerStock] = useState<CoolerItem[]>(() => {
    try {
      const saved =
        localStorage.getItem('tapflow_cooler_biglake_v2') || localStorage.getItem('tapflow_cooler_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasLegacyPlaceholders =
          Array.isArray(parsed) &&
          parsed.some((c: CoolerItem) =>
            /hop hysteria|ghost town|cyber lager|neon haze|retro ipa|leroy brown|penny pinching|patio sunset|patio blonde|patio crisp|cottage wheat|belly float|great lakes pilsner|campers|ryecar|sparta$/i.test(
              c.brand || ''
            )
          );
        if (!hasLegacyPlaceholders && Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load cooler stock from storage', e);
    }
    return INITIAL_COOLER_STOCK;
  });

  const [spiritsCatalog, setSpiritsCatalog] = useState<SpiritItem[]>(() => {
    try {
      const saved = localStorage.getItem('tapflow_spirits_catalog_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load spirits catalog from storage', e);
    }
    return INITIAL_SPIRITS;
  });

  const [kegChanges, setKegChanges] = useState<KegChangeLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('tapflow_keg_changes_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load keg changes from storage', e);
    }
    return INITIAL_KEG_CHANGES;
  });

  const [spiritRemovals, setSpiritRemovals] = useState<SpiritRemovalEntry[]>(() => {
    try {
      const saved = localStorage.getItem('tapflow_spirit_removals_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load spirit removals from storage', e);
    }
    return INITIAL_SPIRIT_REMOVALS;
  });

  const [kegDeposits, setKegDeposits] = useState<KegDepositEntry[]>(() => {
    try {
      const saved = localStorage.getItem('tapflow_keg_deposits_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load keg deposits from storage', e);
    }
    return INITIAL_KEG_DEPOSITS;
  });

  const [packagedMovements, setPackagedMovements] = useState<PackagedMovementEntry[]>(() => {
    try {
      const saved = localStorage.getItem('tapflow_packaged_movements_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load packaged movements from storage', e);
    }
    return INITIAL_PACKAGED_MOVEMENTS;
  });

  // Master Purchase & Restock Orders State
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    try {
      const saved = localStorage.getItem('tapflow_purchase_orders_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load purchase orders from storage', e);
    }
    return INITIAL_PURCHASE_ORDERS;
  });

  // Dynamic Beer Styles list (Loaded from "⚙️ Settings & Categories" or dynamic unique styles)
  const [beerStyles, setBeerStyles] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tapflow_beer_styles_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load beer styles from storage', e);
    }
    return INITIAL_BEER_STYLES;
  });

  const handleAddNewBeerStyle = useCallback((newStyle: string) => {
    const trimmed = newStyle.trim();
    if (!trimmed) return;
    setBeerStyles((prev) => {
      if (prev.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      const updated = [...prev, trimmed];
      try {
        localStorage.setItem('tapflow_beer_styles_v1', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save beer styles to storage', e);
      }
      // Enqueue job to append new style to master Google Sheet
      syncQueue.enqueue('ADD_BEER_STYLE', trimmed);
      return updated;
    });
  }, []);

  // Sync state to localStorage whenever modified
  useEffect(() => {
    localStorage.setItem('tapflow_beer_styles_v1', JSON.stringify(beerStyles));
  }, [beerStyles]);
  useEffect(() => {
    localStorage.setItem('tapflow_staff_users_v2', JSON.stringify(staffUsers));
  }, [staffUsers]);

  useEffect(() => {
    localStorage.setItem('tapflow_taps_biglake_v2', JSON.stringify(taps));
    localStorage.setItem('tapflow_taps_v1', JSON.stringify(taps));
  }, [taps]);

  useEffect(() => {
    localStorage.setItem('tapflow_cooler_biglake_v2', JSON.stringify(coolerStock));
    localStorage.setItem('tapflow_cooler_v1', JSON.stringify(coolerStock));
  }, [coolerStock]);

  useEffect(() => {
    localStorage.setItem('tapflow_spirits_catalog_v1', JSON.stringify(spiritsCatalog));
  }, [spiritsCatalog]);

  useEffect(() => {
    localStorage.setItem('tapflow_keg_changes_v1', JSON.stringify(kegChanges));
  }, [kegChanges]);

  useEffect(() => {
    localStorage.setItem('tapflow_spirit_removals_v1', JSON.stringify(spiritRemovals));
  }, [spiritRemovals]);

  useEffect(() => {
    localStorage.setItem('tapflow_keg_deposits_v1', JSON.stringify(kegDeposits));
  }, [kegDeposits]);

  useEffect(() => {
    localStorage.setItem('tapflow_packaged_movements_v1', JSON.stringify(packagedMovements));
  }, [packagedMovements]);

  useEffect(() => {
    localStorage.setItem('tapflow_purchase_orders_v1', JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);

  // Persist spreadsheet configuration in localStorage across reloads and rebuilds
  useEffect(() => {
    try {
      localStorage.setItem('tapflow_sheet_config_v1', JSON.stringify(spreadsheetConfig));
      if (spreadsheetConfig.spreadsheetId) {
        localStorage.setItem('tapflow_spreadsheet_id', spreadsheetConfig.spreadsheetId);
      }
    } catch (e) {
      console.warn('Failed to persist sheet config', e);
    }
  }, [spreadsheetConfig]);

  // Dedicated config updater that immediately guarantees persistent storage in localStorage
  const handleUpdateSpreadsheetConfig = useCallback((newConfig: SpreadsheetConfig) => {
    setSpreadsheetConfig(newConfig);
    try {
      localStorage.setItem('tapflow_sheet_config_v1', JSON.stringify(newConfig));
      if (newConfig.spreadsheetId) {
        localStorage.setItem('tapflow_spreadsheet_id', newConfig.spreadsheetId);
      } else {
        localStorage.removeItem('tapflow_spreadsheet_id');
      }
    } catch (e) {
      console.warn('Failed to save sheet config to localStorage', e);
    }
  }, []);

  // Subscribe to queue changes
  useEffect(() => {
    const unsubscribe = syncQueue.subscribe((state) => {
      setQueueState(state);
    });
    return unsubscribe;
  }, []);

  // Initialize Auth and Queue Connectors
  useEffect(() => {
    syncQueue.init(
      () => getAccessToken(),
      () => spreadsheetConfig.spreadsheetId || localStorage.getItem('tapflow_spreadsheet_id') || null
    );

    const unsubscribeAuth = initAuth(
      (user) => {
        setCurrentUser(user);
        syncQueue.retry();
      },
      () => {
        setCurrentUser(null);
      }
    );

    return () => {
      unsubscribeAuth();
    };
  }, [spreadsheetConfig.spreadsheetId]);

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setCurrentUser(result.user);
        syncQueue.retry();
      }
    } catch (err) {
      console.error('Sign in error:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Google Sign Out
  const handleGoogleSignOut = async () => {
    await logout();
    setCurrentUser(null);
  };

  const spreadsheetConfigRef = useRef(spreadsheetConfig);
  spreadsheetConfigRef.current = spreadsheetConfig;

  const currentStaffRef = useRef(currentStaff);
  currentStaffRef.current = currentStaff;

  const lastSyncTimestampRef = useRef<number>(0);
  const syncInProgressRef = useRef<boolean>(false);
  const initialSyncedKeyRef = useRef<string>('');

  // Handle Manual or Auto Force Sync with Google Sheets (Throttled & Protected against 429 loops)
  const handleTriggerSync = useCallback(async (overrideConfig?: SpreadsheetConfig, force: boolean = false) => {
    const activeConfig = overrideConfig || spreadsheetConfigRef.current;
    const targetSpreadsheetId =
      activeConfig.spreadsheetId || localStorage.getItem('tapflow_spreadsheet_id') || '';
    if (!targetSpreadsheetId) return;

    // Prevent redundant sync spam or overlapping requests
    const now = Date.now();
    if (!force && now - lastSyncTimestampRef.current < 15000) {
      console.log('[Sync] Throttled: Sync ran less than 15s ago, skipping redundant fetch.');
      return;
    }
    if (syncInProgressRef.current) {
      console.log('[Sync] Sync already in progress, skipping.');
      return;
    }

    syncInProgressRef.current = true;
    lastSyncTimestampRef.current = now;

    // Clear any stalled background sync queue items that might block reads
    syncQueue.clearStalledItems();
    setIsSyncing(true);
    try {
      const token = await getAccessToken();
      if (!token) return;

      const sheetData = await fetchSpreadsheetData(token, targetSpreadsheetId, force);

      // If rate limited by Google Sheets API, do not attempt to overwrite local state
      if (sheetData.rateLimited) {
        console.warn('[Sync] Google Sheets rate limited (429). Using local inventory.');
        return;
      }

      // Dynamically update taps from sheet (including on-deck columns)
      if (sheetData.taps && sheetData.taps.length > 0) {
        setTaps(sheetData.taps);
      }

      // Dynamically update cooler inventory / keg catalog from sheet
      if (sheetData.coolerStock && sheetData.coolerStock.length > 0) {
        setCoolerStock(sheetData.coolerStock);
      }

      // Dynamically update spirits catalog & fast pick from sheet
      if (sheetData.spiritsCatalog && sheetData.spiritsCatalog.length > 0) {
        setSpiritsCatalog(sheetData.spiritsCatalog);
      }

      // Dynamically update staff users & roles from 👥 Staff & Permissions tab
      if (sheetData.staffUsers && sheetData.staffUsers.length > 0) {
        setStaffUsers(sheetData.staffUsers);
        const activeList = sheetData.staffUsers.filter((s: StaffUser) => s.status === 'Active');
        if (!activeList.some((s: StaffUser) => s.name === currentStaffRef.current) && activeList.length > 0) {
          setCurrentStaff(activeList[0].name);
          setSessionRole(activeList[0].role);
        }
      }

      // Merge logs
      if (sheetData.kegChanges && sheetData.kegChanges.length > 0) {
        setKegChanges((prev) => {
          const existingIds = new Set(prev.map((k: KegChangeLogEntry) => k.id));
          const newEntries = sheetData.kegChanges.filter((k: KegChangeLogEntry) => !existingIds.has(k.id));
          return [...newEntries, ...prev];
        });
      }
      if (sheetData.spiritRemovals && sheetData.spiritRemovals.length > 0) {
        setSpiritRemovals((prev) => {
          const existingIds = new Set(prev.map((s: SpiritRemovalEntry) => s.id));
          const newEntries = sheetData.spiritRemovals.filter((s: SpiritRemovalEntry) => !existingIds.has(s.id));
          return [...newEntries, ...prev];
        });
      }
      if (sheetData.kegDeposits && sheetData.kegDeposits.length > 0) {
        setKegDeposits((prev) => {
          const existingIds = new Set(prev.map((d: KegDepositEntry) => d.id));
          const newEntries = sheetData.kegDeposits.filter((d: KegDepositEntry) => !existingIds.has(d.id));
          return [...newEntries, ...prev];
        });
      }
      if (sheetData.packagedMovements && sheetData.packagedMovements.length > 0) {
        setPackagedMovements((prev) => {
          const existingIds = new Set(prev.map((m: PackagedMovementEntry) => m.id));
          const newEntries = sheetData.packagedMovements.filter((m: PackagedMovementEntry) => !existingIds.has(m.id));
          return [...newEntries, ...prev];
        });
      }
      if (sheetData.purchaseOrders && sheetData.purchaseOrders.length > 0) {
        setPurchaseOrders((prev) => {
          const existingIds = new Set(prev.map((o: PurchaseOrder) => o.id));
          const newEntries = sheetData.purchaseOrders.filter((o: PurchaseOrder) => !existingIds.has(o.id));
          return [...newEntries, ...prev];
        });
      }
      if (sheetData.beerStyles && sheetData.beerStyles.length > 0) {
        setBeerStyles(sheetData.beerStyles);
        try {
          localStorage.setItem('tapflow_beer_styles_v1', JSON.stringify(sheetData.beerStyles));
        } catch (e) {
          console.warn('Failed to save beer styles to storage', e);
        }
      }

      const updatedTimestamp = new Date().toISOString();
      setSpreadsheetConfig((prev) => {
        const next = {
          ...prev,
          spreadsheetId: targetSpreadsheetId,
          spreadsheetUrl:
            prev.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${targetSpreadsheetId}/edit`,
          lastSyncedAt: updatedTimestamp,
        };
        try {
          localStorage.setItem('tapflow_sheet_config_v1', JSON.stringify(next));
          localStorage.setItem('tapflow_spreadsheet_id', targetSpreadsheetId);
        } catch (e) {
          console.warn('Failed to update sheet config in storage', e);
        }
        return next;
      });
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
      syncInProgressRef.current = false;
    }
  }, []);

  // Auto-fetch active lines and inventory directly from Google Sheet ONCE on initial connect or account change
  useEffect(() => {
    const syncKey = `${currentUser?.email || currentUser?.uid || ''}:${spreadsheetConfig.spreadsheetId || ''}`;
    if (currentUser && spreadsheetConfig.spreadsheetId && initialSyncedKeyRef.current !== syncKey) {
      initialSyncedKeyRef.current = syncKey;
      handleTriggerSync();
    }
  }, [currentUser, spreadsheetConfig.spreadsheetId, handleTriggerSync]);

  // Tab 1: Tap Manager - Swap Keg Operation (Optimistic UI + Background Sheet Sync)
  const handleSwapKeg = ({
    tapNumber,
    newSku,
    newBrand,
    newStyle,
    newFormat,
    staffMember,
    deductCoolerStock,
    clearOnDeck,
  }: {
    tapNumber: number;
    newSku: string;
    newBrand: string;
    newStyle: string;
    newFormat: KegFormat;
    staffMember: string;
    deductCoolerStock: boolean;
    clearOnDeck?: boolean;
  }) => {
    const currentTap = taps.find((t) => t.tapNumber === tapNumber);
    const oldBrand = currentTap ? currentTap.brand : 'Unknown Brand';
    const oldSku = currentTap?.sku || `KEG-${String(tapNumber).padStart(3, '0')}`;
    const nowStr = new Date().toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    // 1. Deduct cooler stock if requested by SKU or brand name
    if (deductCoolerStock) {
      setCoolerStock((prev) =>
        prev.map((item) => {
          if (
            item.sku === newSku ||
            (item.brand.toLowerCase() === newBrand.toLowerCase() && item.format === newFormat)
          ) {
            return { ...item, count: Math.max(0, item.count - 1) };
          }
          return item;
        })
      );
    }

    // 2. Optimistic Tap Update with immutable SKU and current Brand
    // If clearOnDeck is true, clear the on-deck slot!
    const shouldClearOnDeck = clearOnDeck ?? (currentTap?.onDeckSku === newSku);
    const updatedTap: Tap = {
      tapNumber,
      location: tapNumber <= 26 ? 'Inside' : 'Patio',
      sku: newSku,
      brand: newBrand,
      style: newStyle,
      format: newFormat,
      abv: currentTap?.abv || '',
      coolerStockHalfBbl:
        newFormat === '1/2 BBL' && deductCoolerStock
          ? Math.max(0, (currentTap?.coolerStockHalfBbl || 1) - 1)
          : currentTap?.coolerStockHalfBbl || 0,
      coolerStockSixthBbl:
        newFormat === '1/6 BBL' && deductCoolerStock
          ? Math.max(0, (currentTap?.coolerStockSixthBbl || 1) - 1)
          : currentTap?.coolerStockSixthBbl || 0,
      lastChanged: nowStr,
      changedBy: staffMember,
      onDeckSku: shouldClearOnDeck ? undefined : currentTap?.onDeckSku,
      onDeckBrand: shouldClearOnDeck ? undefined : currentTap?.onDeckBrand,
      onDeckFormat: shouldClearOnDeck ? undefined : currentTap?.onDeckFormat,
      onDeckStyle: shouldClearOnDeck ? undefined : currentTap?.onDeckStyle,
      onDeckType: shouldClearOnDeck ? undefined : currentTap?.onDeckType,
      onDeckScheduledDate: shouldClearOnDeck ? undefined : currentTap?.onDeckScheduledDate,
      onDeckNotes: shouldClearOnDeck ? undefined : currentTap?.onDeckNotes,
    };

    setTaps((prev) => prev.map((t) => (t.tapNumber === tapNumber ? updatedTap : t)));

    // 3. Optimistic Keg Change Log Entry (Saving BOTH SKU and Brand for historical resilience)
    const logEntry: KegChangeLogEntry = {
      id: `kc-${Date.now()}`,
      timestamp: nowStr,
      tapNumber,
      oldSku,
      oldBrand,
      newSku,
      newBrand,
      format: newFormat,
      staffMember,
      synced: false,
    };

    setKegChanges((prev) => [logEntry, ...prev]);

    // 4. Enqueue background sync to Google Sheets
    syncQueue.enqueue('TAP_SWAP', {
      tap: updatedTap,
      logEntry,
    });
  };

  // Tab 1: Manager Assign / Reschedule On-Deck Beer (Immediate Replacement or Scheduled Rotation)
  const handleAssignOnDeck = (params: {
    tapNumber: number;
    onDeckSku: string;
    onDeckBrand: string;
    onDeckFormat: KegFormat;
    onDeckStyle: string;
    onDeckType?: OnDeckType;
    onDeckScheduledDate?: string;
    onDeckNotes?: string;
  }) => {
    const currentTap = taps.find((t) => t.tapNumber === params.tapNumber);
    if (!currentTap) return;

    const updatedTap: Tap = {
      ...currentTap,
      onDeckSku: params.onDeckSku,
      onDeckBrand: params.onDeckBrand,
      onDeckFormat: params.onDeckFormat,
      onDeckStyle: params.onDeckStyle,
      onDeckType: params.onDeckType || 'IMMEDIATE_REPLACEMENT',
      onDeckScheduledDate: params.onDeckScheduledDate,
      onDeckNotes: params.onDeckNotes,
    };

    setTaps((prev) => prev.map((t) => (t.tapNumber === params.tapNumber ? updatedTap : t)));

    // Enqueue background sync to update columns in Google Sheets
    syncQueue.enqueue('ON_DECK_UPDATE', updatedTap);
  };

  // Tab 1: Manager Clear On-Deck Slot (Reverts to Automatic Same-Brand Fallback)
  const handleClearOnDeck = (tapNumber: number) => {
    const currentTap = taps.find((t) => t.tapNumber === tapNumber);
    if (!currentTap) return;

    const updatedTap: Tap = {
      ...currentTap,
      onDeckSku: undefined,
      onDeckBrand: undefined,
      onDeckFormat: undefined,
      onDeckStyle: undefined,
      onDeckType: undefined,
      onDeckScheduledDate: undefined,
      onDeckNotes: undefined,
    };

    setTaps((prev) => prev.map((t) => (t.tapNumber === tapNumber ? updatedTap : t)));

    syncQueue.enqueue('ON_DECK_UPDATE', updatedTap);
  };

  // In-App Product Creator Handlers (Manager / Shift Supervisor tool)
  const handleAddBeerProduct = (newBeer: CoolerItem & { abv?: string }) => {
    // 1. Optimistic state update in Cooler & Draft Inventory
    setCoolerStock((prev) => [newBeer, ...prev]);

    // 2. Enqueue background sync to Google Sheets tab 📦 Cooler & Draft Inventory
    syncQueue.enqueue('ADD_BEER_PRODUCT', newBeer);
  };

  const handleAddSpiritProduct = (newSpirit: SpiritItem) => {
    // 1. Optimistic state update in Master Spirits Catalog
    setSpiritsCatalog((prev) => [newSpirit, ...prev]);

    // 2. Enqueue background sync to Google Sheets tab 🥃 Master Spirits Catalog
    syncQueue.enqueue('ADD_SPIRIT_PRODUCT', newSpirit);
  };

  // Tab 2: Fast Spirit Pull Operation (Optimistic UI + Background Sheet Sync)
  const handleLogSpiritPull = ({
    station,
    spiritSku,
    spiritBrand,
    bottleCount,
    staffMember,
  }: {
    station: Station;
    spiritSku: string;
    spiritBrand: string;
    bottleCount: number;
    staffMember: string;
  }) => {
    const nowStr = new Date().toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    // Save BOTH immutable SKU and Product Name to log entry
    const entry: SpiritRemovalEntry = {
      id: `sr-${Date.now()}`,
      timestamp: nowStr,
      station,
      spiritSku,
      spiritBrand,
      bottleCount,
      staffMember,
      synced: false,
    };

    // Optimistic state update
    setSpiritRemovals((prev) => [entry, ...prev]);

    // Enqueue to Sheets sync queue
    syncQueue.enqueue('SPIRIT_PULL', entry);
  };

  const handleUndoSpiritPull = (id: string) => {
    setSpiritRemovals((prev) => prev.filter((s) => s.id !== id));
  };

  // Tab 3: $30 Keg Deposits Operation (Optimistic UI + Background Sheet Sync)
  const handleLogDeposit = ({
    customerName,
    phone,
    transaction,
    status,
    loggedBy,
  }: {
    customerName: string;
    phone: string;
    transaction: DepositTransaction;
    status: 'Active' | 'Returned & Refunded';
    loggedBy: string;
  }) => {
    const nowStr = new Date().toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const entry: KegDepositEntry = {
      id: `kd-${Date.now()}`,
      date: nowStr,
      customerName,
      phone,
      transaction,
      amount: 30,
      status,
      loggedBy,
      synced: false,
    };

    setKegDeposits((prev) => [entry, ...prev]);

    // Enqueue to Sheets sync queue
    syncQueue.enqueue('KEG_DEPOSIT', entry);
  };

  // Process Quick Return / Refund for an existing active deposit
  const handleProcessReturn = (depositId: string, staffMember: string) => {
    const existing = kegDeposits.find((d) => d.id === depositId);
    if (!existing) return;

    // Mark existing as Returned & Refunded
    setKegDeposits((prev) =>
      prev.map((d) => (d.id === depositId ? { ...d, status: 'Returned & Refunded' } : d))
    );

    // Also log the refund transaction entry
    const nowStr = new Date().toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const refundEntry: KegDepositEntry = {
      id: `kd-${Date.now()}`,
      date: nowStr,
      customerName: existing.customerName,
      phone: existing.phone,
      transaction: 'Deposit Refunded $30',
      amount: 30,
      status: 'Returned & Refunded',
      loggedBy: staffMember,
      synced: false,
    };

    setKegDeposits((prev) => [refundEntry, ...prev]);

    // Enqueue to Sheets sync queue
    syncQueue.enqueue('KEG_DEPOSIT', refundEntry);
  };

  // Tab 4: Cooler stock adjustment
  const handleAdjustStock = (id: string, delta: number) => {
    setCoolerStock((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, count: Math.max(0, item.count + delta) } : item
      )
    );
  };

  // Packaged Beer Quick Pulls (-24 cans Case, -4 cans 4-Pack, -1 can Single)
  const handleQuickPackagedPull = ({
    sku,
    brand,
    cansToDeduct,
    formatLabel,
  }: {
    sku: string;
    brand: string;
    cansToDeduct: number;
    formatLabel: string;
  }) => {
    const targetItem = coolerStock.find((c) => c.sku === sku);
    if (!targetItem) return;

    const currentCans = targetItem.baseCanCount ?? targetItem.count ?? 0;
    const remainingCans = Math.max(0, currentCans - cansToDeduct);

    const updatedItem: CoolerItem = {
      ...targetItem,
      count: remainingCans,
      baseCanCount: remainingCans,
    };

    setCoolerStock((prev) => prev.map((c) => (c.sku === sku ? updatedItem : c)));

    const nowStr = new Date().toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const entry: PackagedMovementEntry = {
      id: `pkg-mv-${Date.now()}`,
      timestamp: nowStr,
      sku,
      brand,
      formatPulled: formatLabel,
      cansChanged: -cansToDeduct,
      remainingCans,
      staffMember: currentStaff,
      synced: false,
    };

    setPackagedMovements((prev) => [entry, ...prev]);

    // 1. Enqueue to Sheets Packaged Movement Log
    syncQueue.enqueue('PACKAGED_MOVEMENT', entry);

    // 2. Sync updated stock count row in 📦 Cooler & Draft Inventory
    const rowIndex = coolerStock.findIndex((c) => c.sku === sku) + 2;
    syncQueue.enqueue('CATALOG_UPDATE', { type: 'BEER', item: updatedItem, rowIndex });
  };

  // Packaged Beer Physical Audit Count
  const handleAuditPackagedStock = ({
    sku,
    brand,
    newBaseCans,
    delta,
    staffMember,
  }: {
    sku: string;
    brand: string;
    newBaseCans: number;
    delta: number;
    staffMember: string;
  }) => {
    const targetItem = coolerStock.find((c) => c.sku === sku);
    if (!targetItem) return;

    const updatedItem: CoolerItem = {
      ...targetItem,
      count: newBaseCans,
      baseCanCount: newBaseCans,
    };

    setCoolerStock((prev) => prev.map((c) => (c.sku === sku ? updatedItem : c)));

    const nowStr = new Date().toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const entry: PackagedMovementEntry = {
      id: `pkg-audit-${Date.now()}`,
      timestamp: nowStr,
      sku,
      brand,
      formatPulled: 'Audit Adjustment',
      cansChanged: delta,
      remainingCans: newBaseCans,
      staffMember,
      synced: false,
    };

    setPackagedMovements((prev) => [entry, ...prev]);

    // 1. Enqueue audit entry
    syncQueue.enqueue('PACKAGED_MOVEMENT', entry);

    // 2. Sync updated stock count row
    const rowIndex = coolerStock.findIndex((c) => c.sku === sku) + 2;
    syncQueue.enqueue('CATALOG_UPDATE', { type: 'BEER', item: updatedItem, rowIndex });
  };

  // Manager Catalog Update: Beer / Packaged Item (Active/Inactive, Par, Style)
  const handleUpdateBeerCatalogItem = (updatedItem: CoolerItem) => {
    setCoolerStock((prev) => prev.map((c) => (c.id === updatedItem.id ? updatedItem : c)));
    const rowIndex = coolerStock.findIndex((c) => c.id === updatedItem.id) + 2;
    syncQueue.enqueue('CATALOG_UPDATE', { type: 'BEER', item: updatedItem, rowIndex });
  };

  // Manager Catalog Update: Spirit Item (Active/Inactive, Par, Category, Fast Pick)
  const handleUpdateSpiritCatalogItem = (updatedItem: SpiritItem) => {
    setSpiritsCatalog((prev) => prev.map((s) => (s.sku === updatedItem.sku ? updatedItem : s)));
    const rowIndex = spiritsCatalog.findIndex((s) => s.sku === updatedItem.sku) + 2;
    syncQueue.enqueue('CATALOG_UPDATE', { type: 'SPIRIT', item: updatedItem, rowIndex });
  };

  // Manager Purchase & Restock Orders
  const handleAddPurchaseOrder = (newOrder: PurchaseOrder) => {
    setPurchaseOrders((prev) => [newOrder, ...prev]);
    syncQueue.enqueue('ADD_PURCHASE_ORDER', newOrder);
  };

  const handleAddPurchaseOrdersBatch = (orders: PurchaseOrder[]) => {
    if (!orders || orders.length === 0) return;
    setPurchaseOrders((prev) => [...orders, ...prev]);
    syncQueue.enqueue('BATCH_PURCHASE_ORDERS', orders);
  };

  const handleReceivePurchaseOrder = (orderId: string) => {
    const order = purchaseOrders.find((o) => o.id === orderId);
    if (!order || order.status === 'Received') return;

    // 1. Mark order as Received
    const updatedOrder: PurchaseOrder = {
      ...order,
      status: 'Received',
      receivedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      synced: false,
    };
    setPurchaseOrders((prev) =>
      prev.map((o) => (o.id === orderId ? updatedOrder : o))
    );

    // 2. Increment active cooler stock
    const targetCoolerItem = coolerStock.find(
      (c) =>
        c.sku.toLowerCase() === order.sku.toLowerCase() ||
        c.brand.toLowerCase() === order.brand.toLowerCase()
    );

    if (targetCoolerItem) {
      const isPackaged =
        (targetCoolerItem.format || '').toLowerCase().includes('pack') ||
        (targetCoolerItem.format || '').toLowerCase().includes('can') ||
        (targetCoolerItem.format || '').toLowerCase().includes('16oz') ||
        (targetCoolerItem.sku || '').toLowerCase().startsWith('pkg-');

      let incrementAmount = order.quantity;
      if (isPackaged) {
        const formatLower = (order.format || '').toLowerCase();
        if (formatLower.includes('case')) {
          incrementAmount = order.quantity * 24;
        } else if (formatLower.includes('4-pk') || formatLower.includes('four')) {
          incrementAmount = order.quantity * 4;
        }
      }

      const updatedCount = (targetCoolerItem.count || 0) + incrementAmount;
      const updatedBaseCans = isPackaged
        ? (targetCoolerItem.baseCanCount ?? targetCoolerItem.count ?? 0) + incrementAmount
        : targetCoolerItem.baseCanCount;

      const updatedItem: CoolerItem = {
        ...targetCoolerItem,
        count: updatedCount,
        baseCanCount: updatedBaseCans,
      };

      setCoolerStock((prev) =>
        prev.map((c) => (c.id === targetCoolerItem.id ? updatedItem : c))
      );

      const rowIndex = coolerStock.findIndex((c) => c.id === targetCoolerItem.id) + 2;
      syncQueue.enqueue('CATALOG_UPDATE', { type: 'BEER', item: updatedItem, rowIndex });
    }

    // 3. Enqueue order status update to Sheets
    syncQueue.enqueue('RECEIVE_PURCHASE_ORDER', {
      orderId,
      newStatus: 'Received',
    });
  };

  const pendingDepositsCount = kegDeposits.filter((d) => d.status === 'Active').length;
  const lowStockCount = coolerStock.filter((c) => c.count <= 1).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* App Header with Active Role Badge and Integrated Navigation Tabs (< 40px height) */}
      <Header
        currentRole={sessionRole}
        onLock={handleLock}
        onOpenStaffModal={() => setIsStaffModalOpen(true)}
        queueState={queueState}
        spreadsheetConfig={spreadsheetConfig}
        onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
        onManualSync={() => handleTriggerSync(undefined, true)}
        isSyncing={isSyncing}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingDepositsCount={pendingDepositsCount}
        lowStockCount={lowStockCount}
      />

      {/* Main Taproom Operations Surface - Zero-scroll optimized */}
      <main className="flex-1 max-w-[1680px] w-full mx-auto px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5">
        {activeTab === 'taps' && (
          <TapGrid
            taps={taps}
            coolerStock={coolerStock}
            currentStaff={currentStaff}
            currentRole={currentRole}
            onSwapKeg={handleSwapKeg}
            onAssignOnDeck={handleAssignOnDeck}
            onClearOnDeck={handleClearOnDeck}
          />
        )}

        {activeTab === 'spirits' && (
          <FastSpiritPulls
            currentStaff={currentStaff}
            currentRole={currentRole}
            recentRemovals={spiritRemovals}
            spiritsCatalog={spiritsCatalog}
            onLogSpiritPull={handleLogSpiritPull}
            onUndoSpiritPull={handleUndoSpiritPull}
            onOpenNewProductModal={() => handleOpenProductModal('SPIRIT')}
          />
        )}

        {activeTab === 'deposits' && (
          <KegDeposits
            currentStaff={currentStaff}
            deposits={kegDeposits}
            onLogDeposit={handleLogDeposit}
            onProcessReturn={handleProcessReturn}
          />
        )}

        {activeTab === 'cooler' && (
          <CoolerStockOverview
            coolerStock={coolerStock}
            spiritsCatalog={spiritsCatalog}
            purchaseOrders={purchaseOrders}
            currentStaff={currentStaff}
            currentRole={currentRole}
            beerStyles={beerStyles}
            onAddNewBeerStyle={handleAddNewBeerStyle}
            onAdjustStock={handleAdjustStock}
            onOpenNewProductModal={() => handleOpenProductModal('BEER')}
            onAddPurchaseOrder={handleAddPurchaseOrder}
            onSubmitBatchOrders={handleAddPurchaseOrdersBatch}
            onReceivePurchaseOrder={handleReceivePurchaseOrder}
            onQuickPackagedPull={handleQuickPackagedPull}
            onAuditPackagedStock={handleAuditPackagedStock}
            onUpdateBeerCatalogItem={handleUpdateBeerCatalogItem}
            onUpdateSpiritCatalogItem={handleUpdateSpiritCatalogItem}
          />
        )}

        {activeTab === 'logs' && (
          <ActivityLogs
            kegChanges={kegChanges}
            spiritRemovals={spiritRemovals}
            kegDeposits={kegDeposits}
            packagedMovements={packagedMovements}
            currentRole={currentRole}
          />
        )}
      </main>

      {/* Product & SKU Creator Modal (Manager Only Tool) */}
      <ProductCreatorModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        initialType={productModalType}
        existingCoolerItems={coolerStock}
        existingSpirits={spiritsCatalog}
        beerStyles={beerStyles}
        onAddNewBeerStyle={handleAddNewBeerStyle}
        onAddBeer={handleAddBeerProduct}
        onAddSpirit={handleAddSpiritProduct}
      />

      {/* Google Sheets Connection Modal */}
      <GoogleConnectModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        currentUser={currentUser}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        isLoggingIn={isLoggingIn}
        spreadsheetConfig={spreadsheetConfig}
        onUpdateSpreadsheetConfig={handleUpdateSpreadsheetConfig}
        queueState={queueState}
        onTriggerSync={(cfg) => handleTriggerSync(cfg, true)}
        getAccessToken={getAccessToken}
      />

      {/* Staff PIN Login Modal / Overlay */}
      <PinLoginModal
        isOpen={isPinModalOpen}
        onSuccess={handlePinSuccess}
        onClose={sessionRole ? () => setIsPinModalOpen(false) : undefined}
        currentRole={sessionRole}
        staffUsers={staffUsers}
      />

      {/* Manage Staff & PINs Modal (Manager Only) */}
      <ManageStaffModal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        staffUsers={staffUsers}
        onUpdateStaffPin={handleUpdateStaffPin}
      />
    </div>
  );
}
