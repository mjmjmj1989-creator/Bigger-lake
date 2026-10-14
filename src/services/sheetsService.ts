import {
  Tap,
  KegFormat,
  KegChangeLogEntry,
  SpiritRemovalEntry,
  KegDepositEntry,
  CoolerItem,
  SpiritItem,
  StaffUser,
  StaffRole,
  StaffStatus,
  ProductStatus,
  PackagedMovementEntry,
  OnDeckType,
  PurchaseOrder,
  OrderStatus,
} from '../types/taproom';
import {
  INITIAL_TAPS,
  INITIAL_COOLER_STOCK,
  INITIAL_SPIRITS,
  INITIAL_STAFF_USERS,
  INITIAL_PACKAGED_MOVEMENTS,
  INITIAL_BEER_STYLES,
  INITIAL_PURCHASE_ORDERS,
} from '../data/initialData';

export const SHEET_NAMES = {
  ON_TAP: '🍻 On-Tap & Line Flow',
  COOLER_INVENTORY: '📦 Cooler & Draft Inventory',
  SPIRITS_CATALOG: '🥃 Master Spirits Catalog',
  KEG_LOG: '🍻 Keg Change Log',
  SPIRIT_LOG: '🥃 Spirit Removals Log',
  DEPOSITS: '🏷️ Keg Deposits',
  STAFF: '👥 Staff & Permissions',
  PACKAGED_LOG: '🥫 Packaged Movement Log',
  SETTINGS: '⚙️ Settings & Categories',
  PURCHASE_ORDERS: '📋 Purchase & Restock Orders',
};

const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

// In-memory cache of resolved tab names per spreadsheetId to minimize API calls
const tabTitleCache: Record<string, Record<string, string>> = {};

// In-memory response cache to prevent redundant read requests within 30 seconds
interface SheetDataCacheEntry {
  timestamp: number;
  data: any;
}
const sheetDataCache: Record<string, SheetDataCacheEntry> = {};

// Quota backoff timestamp (if 429 encountered, pause requests for 60 seconds)
let quotaExceededCooldownUntil = 0;

/**
 * Ensures that a sheet tab exists in the user's spreadsheet.
 * If the exact title or an alias regex matches an existing tab, returns that tab's title.
 * If no matching tab exists, creates the tab with preferredTitle and defaultHeaders.
 */
export async function ensureSheetTabExists(
  token: string,
  spreadsheetId: string,
  preferredTitle: string,
  aliasRegex: RegExp,
  defaultHeaders?: string[],
  forceRefresh: boolean = false
): Promise<string> {
  if (!tabTitleCache[spreadsheetId]) {
    tabTitleCache[spreadsheetId] = {};
  }

  // Check cache first (unless forceRefresh)
  if (!forceRefresh && tabTitleCache[spreadsheetId][preferredTitle]) {
    return tabTitleCache[spreadsheetId][preferredTitle];
  }

  // Fetch current spreadsheet tab titles
  const metaRes = await fetch(`${BASE_URL}/${spreadsheetId}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  let existingTitles: string[] = [];
  if (metaRes.ok) {
    const meta = await metaRes.json();
    existingTitles = (meta.sheets || []).map((s: any) => s.properties?.title || '');
  }

  // Check if title or alias already exists
  const exactMatch = existingTitles.find((t) => t === preferredTitle);
  if (exactMatch) {
    tabTitleCache[spreadsheetId][preferredTitle] = exactMatch;
    return exactMatch;
  }

  const aliasMatch = existingTitles.find((t) => aliasRegex.test(t));
  if (aliasMatch) {
    tabTitleCache[spreadsheetId][preferredTitle] = aliasMatch;
    return aliasMatch;
  }

  // Tab does not exist yet in this spreadsheet: create it via batchUpdate addSheet
  try {
    const addRes = await fetch(`${BASE_URL}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: preferredTitle,
                gridProperties: {
                  frozenRowCount: 1,
                },
              },
            },
          },
        ],
      }),
    });

    if (addRes.ok && defaultHeaders && defaultHeaders.length > 0) {
      // Append initial header row
      const headerRange = `'${preferredTitle}'!A1`;
      await fetch(
        `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(headerRange)}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [defaultHeaders] }),
        }
      );
    }
  } catch (err) {
    console.warn(`Failed to auto-create missing sheet tab "${preferredTitle}":`, err);
  }

  tabTitleCache[spreadsheetId][preferredTitle] = preferredTitle;
  return preferredTitle;
}

interface SpreadsheetCreateResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
  properties: {
    title: string;
  };
}

/**
 * Creates the master taproom spreadsheet with all required tabs and initial headers.
 */
export async function createMasterSpreadsheet(
  token: string,
  title: string = '🍻 Taproom Master Inventory & Operations'
): Promise<SpreadsheetCreateResponse> {
  const payload = {
    properties: {
      title,
    },
    sheets: [
      { properties: { title: SHEET_NAMES.ON_TAP, gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: SHEET_NAMES.COOLER_INVENTORY, gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: SHEET_NAMES.SPIRITS_CATALOG, gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: SHEET_NAMES.KEG_LOG, gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: SHEET_NAMES.SPIRIT_LOG, gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: SHEET_NAMES.DEPOSITS, gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: SHEET_NAMES.STAFF, gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: SHEET_NAMES.PACKAGED_LOG, gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: SHEET_NAMES.SETTINGS, gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: SHEET_NAMES.PURCHASE_ORDERS, gridProperties: { frozenRowCount: 1 } } },
    ],
  };

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create spreadsheet: ${res.status} ${errorText}`);
  }

  const created: SpreadsheetCreateResponse = await res.json();
  const spreadsheetId = created.spreadsheetId;

  // Initialize headers and default master data across all tabs
  await populateInitialSheetData(token, spreadsheetId);

  return created;
}

/**
 * Populates initial header rows and data into the tabs.
 */
export async function populateInitialSheetData(token: string, spreadsheetId: string) {
  // 1. Headers & rows for On-Tap (including On-Deck columns)
  const onTapData = [
    [
      'Tap #',
      'Location',
      'Current SKU',
      'Currently Tapped Brand',
      'Style',
      'Format',
      'ABV',
      'Cooler Stock (1/2 BBL)',
      'Cooler Stock (1/6 BBL)',
      'Last Changed',
      'Changed By',
      'On-Deck SKU',
      'On-Deck Brand',
      'On-Deck Format',
      'On-Deck Style',
      'On-Deck Type',
      'On-Deck Schedule',
    ],
    ...INITIAL_TAPS.map((t) => [
      t.tapNumber,
      t.location,
      t.sku || `KEG-${String(t.tapNumber).padStart(3, '0')}`,
      t.brand,
      t.style,
      t.format,
      t.abv || '',
      t.coolerStockHalfBbl,
      t.coolerStockSixthBbl,
      t.lastChanged,
      t.changedBy,
      t.onDeckSku || '',
      t.onDeckBrand || '',
      t.onDeckFormat || '',
      t.onDeckStyle || '',
      t.onDeckType || '',
      t.onDeckScheduledDate || t.onDeckNotes || '',
    ]),
  ];

  // 2. Headers & rows for Master Cooler & Draft Inventory (Column H is Status)
  const coolerData = [
    ['SKU', 'Brand / Beer Name', 'Style', 'Format', 'Current Stock', 'Par Level', 'Unit', 'Status'],
    ...INITIAL_COOLER_STOCK.map((c) => [
      c.sku,
      c.brand,
      c.style,
      c.format,
      c.baseCanCount ?? c.count,
      c.parLevel,
      c.unit,
      c.status || 'Active',
    ]),
  ];

  // 3. Headers & rows for Master Spirits Catalog (Column F is Status)
  const spiritsCatalogData = [
    ['Spirit SKU', 'Brand / Product Name', 'Category', 'Default Par', 'Fast Pick (TRUE/FALSE)', 'Status'],
    ...INITIAL_SPIRITS.map((s) => [
      s.sku,
      s.brand,
      s.category,
      s.defaultPar,
      s.fastSelect ? 'TRUE' : 'FALSE',
      s.status || 'Active',
    ]),
  ];

  // 4. Headers & rows for Keg Change Log
  const kegLogData = [
    ['Timestamp', 'Tap #', 'Old SKU', 'Old Brand', 'New SKU', 'New Brand', 'Format', 'Staff Member'],
    ['2026-10-02 16:10', 8, 'KEG-018', 'Blackberry Tart Gose', 'KEG-017', 'Canyon Raspberry Kettle Sour', '1/6 BBL', 'Alex Rivera'],
    ['2026-10-02 15:45', 23, 'KEG-008', 'Pacific Coast Pale Ale', 'KEG-013', 'Honey Kolsch Crisp', '1/2 BBL', 'Alex Rivera'],
    ['2026-10-02 13:10', 18, 'KEG-004', 'Copper Mountain Amber Ale', 'KEG-012', 'Summit Italian Pilsner', '1/2 BBL', 'Jordan Bell'],
  ];

  // 5. Headers & rows for Spirit Removals Log
  const spiritLogData = [
    ['Timestamp', 'Station', 'Spirit SKU', 'Spirit Brand', 'Bottle Count', 'Staff Member'],
    ['2026-10-02 20:45', 'Service Well', 'SPR-001', "Tito's Handmade Vodka", 1, 'Alex Rivera'],
    ['2026-10-02 19:30', 'Inside Main Bar', 'SPR-004', 'Casamigos Reposado Tequila', 1, 'Jordan Bell'],
    ['2026-10-02 18:15', 'Patio Bar', 'SPR-003', 'Espolòn Tequila Blanco', 2, 'Taylor Davis'],
  ];

  // 6. Headers & rows for Keg Deposits
  const depositsData = [
    ['Date', 'Customer Name', 'Phone', 'Transaction', 'Amount', 'Status', 'Logged By'],
    ['2026-10-02 18:20', 'Marcus Vance', '(555) 234-8901', 'Deposit Charged $30', '$30', 'Active', 'Alex Rivera'],
    ['2026-10-02 16:40', 'Elena Rostova', '(555) 876-5432', 'Deposit Charged $30', '$30', 'Active', 'Taylor Davis'],
    ['2026-10-01 19:10', 'David Kelling', '(555) 432-1098', 'Deposit Refunded $30', '$30', 'Returned & Refunded', 'Sam Chen'],
  ];

  // 7. Headers & rows for Staff & Permissions
  const staffData = [
    ['Staff Name', 'Role', 'Status', 'PIN'],
    ...INITIAL_STAFF_USERS.map((u) => [
      u.name,
      u.role,
      u.status,
      u.pin || (u.role === 'Manager' || u.role === 'Shift Supervisor' ? '9999' : '1234'),
    ]),
  ];

  // 8. Headers & rows for Packaged Movement Log
  const packagedLogData = [
    ['Timestamp', 'SKU', 'Brand', 'Format Pulled', 'Cans Changed', 'Remaining Cans', 'Staff Member'],
    ...INITIAL_PACKAGED_MOVEMENTS.map((m) => [
      m.timestamp,
      m.sku,
      m.brand,
      m.formatPulled,
      m.cansChanged,
      m.remainingCans,
      m.staffMember,
    ]),
  ];

  // 9. Headers & rows for Settings & Categories (Beer Styles)
  const settingsData = [
    ['Beer Styles', 'Spirit Categories', 'Stations'],
    ...INITIAL_BEER_STYLES.map((style, idx) => [
      style,
      idx === 0 ? 'Vodka' : idx === 1 ? 'Whiskey' : idx === 2 ? 'Tequila' : idx === 3 ? 'Bourbon' : idx === 4 ? 'Gin' : idx === 5 ? 'Rum' : idx === 6 ? 'Aperitif' : idx === 7 ? 'Liqueur' : '',
      idx === 0 ? 'Service Well' : idx === 1 ? 'Inside Main Bar' : idx === 2 ? 'Patio Bar' : '',
    ]),
  ];

  // 10. Headers & rows for Purchase & Restock Orders
  const purchaseOrdersData = [
    ['Order ID', 'Timestamp', 'SKU', 'Brand', 'Format', 'Quantity', 'Vendor', 'Status', 'Logged By'],
    ...INITIAL_PURCHASE_ORDERS.map((p) => [
      p.id,
      p.timestamp,
      p.sku,
      p.brand,
      p.format,
      p.quantity,
      p.vendor || '',
      p.status,
      p.loggedBy,
    ]),
  ];

  const batchData = [
    { range: `'${SHEET_NAMES.ON_TAP}'!A1:O${onTapData.length}`, values: onTapData },
    { range: `'${SHEET_NAMES.COOLER_INVENTORY}'!A1:H${coolerData.length}`, values: coolerData },
    { range: `'${SHEET_NAMES.SPIRITS_CATALOG}'!A1:F${spiritsCatalogData.length}`, values: spiritsCatalogData },
    { range: `'${SHEET_NAMES.KEG_LOG}'!A1:H${kegLogData.length}`, values: kegLogData },
    { range: `'${SHEET_NAMES.SPIRIT_LOG}'!A1:F${spiritLogData.length}`, values: spiritLogData },
    { range: `'${SHEET_NAMES.DEPOSITS}'!A1:G${depositsData.length}`, values: depositsData },
    { range: `'${SHEET_NAMES.STAFF}'!A1:C${staffData.length}`, values: staffData },
    { range: `'${SHEET_NAMES.PACKAGED_LOG}'!A1:G${packagedLogData.length}`, values: packagedLogData },
    { range: `'${SHEET_NAMES.SETTINGS}'!A1:C${settingsData.length}`, values: settingsData },
    { range: `'${SHEET_NAMES.PURCHASE_ORDERS}'!A1:I${purchaseOrdersData.length}`, values: purchaseOrdersData },
  ];

  const updateRes = await fetch(`${BASE_URL}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: batchData,
    }),
  });

  if (!updateRes.ok) {
    const errorText = await updateRes.text();
    console.error('Initial sheet population error:', errorText);
  }
}

/**
 * Reads all data from the spreadsheet in a single batch request.
 * Reads:
 * 1. On-Tap lines
 * 2. Cooler / Keg Master Inventory & SKUs
 * 3. Master Spirits Catalog & Fast-Pick flags
 * 4. Keg Change Log
 * 5. Spirit Removals Log
 * 6. Keg Deposits
 * 7. Staff & Permissions
 */
export async function fetchSpreadsheetData(
  token: string,
  spreadsheetId: string,
  force: boolean = false
) {
  // 1. Quota cooldown check: If 429 occurred recently, protect quota and return cached data
  if (Date.now() < quotaExceededCooldownUntil) {
    const remainingSec = Math.ceil((quotaExceededCooldownUntil - Date.now()) / 1000);
    console.warn(`[Google Sheets] Rate limit cooldown active. Skipping API fetch for ${remainingSec}s.`);
    if (sheetDataCache[spreadsheetId]) {
      return sheetDataCache[spreadsheetId].data;
    }
    return {
      taps: null,
      coolerStock: null,
      spiritsCatalog: null,
      staffUsers: null,
      beerStyles: INITIAL_BEER_STYLES,
      kegChanges: [],
      spiritRemovals: [],
      kegDeposits: [],
      packagedMovements: [],
      rateLimited: true,
    };
  }

  // 2. In-memory response cache check (30 seconds)
  if (!force && sheetDataCache[spreadsheetId]) {
    const ageMs = Date.now() - sheetDataCache[spreadsheetId].timestamp;
    if (ageMs < 30000) {
      return sheetDataCache[spreadsheetId].data;
    }
  }

  // 3. Inspect which tabs exist (use cached titles if known to save an API read request)
  let existingTitles: string[] = [];
  const knownCache = tabTitleCache[spreadsheetId];
  const hasCachedTitles = knownCache && Object.keys(knownCache).length >= 4;

  if (!hasCachedTitles) {
    try {
      const metaRes = await fetch(`${BASE_URL}/${spreadsheetId}?fields=sheets.properties.title`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (metaRes.status === 429) {
        quotaExceededCooldownUntil = Date.now() + 60000;
        console.warn('[Google Sheets] 429 Quota Exceeded on metadata read. Cooldown active for 60s.');
        if (sheetDataCache[spreadsheetId]) {
          return sheetDataCache[spreadsheetId].data;
        }
        return {
          taps: null,
          coolerStock: null,
          spiritsCatalog: null,
          staffUsers: null,
          beerStyles: INITIAL_BEER_STYLES,
          kegChanges: [],
          spiritRemovals: [],
          kegDeposits: [],
          packagedMovements: [],
          purchaseOrders: [],
          rateLimited: true,
        };
      }

      if (metaRes.ok) {
        const meta = await metaRes.json();
        existingTitles = (meta.sheets || []).map((s: any) => s.properties?.title || '');
      }
    } catch (err) {
      console.warn('[Google Sheets] Metadata fetch failed, proceeding with cache/defaults:', err);
    }
  }

  const findTitle = (preferred: string, regex: RegExp): string | null => {
    if (knownCache && knownCache[preferred]) return knownCache[preferred];
    const exact = existingTitles.find((t) => t === preferred);
    if (exact) return exact;
    return existingTitles.find((t) => regex.test(t)) || null;
  };

  const onTapTitle = findTitle(SHEET_NAMES.ON_TAP, /on-?tap|line.*flow|tap/i);
  const coolerTitle = findTitle(SHEET_NAMES.COOLER_INVENTORY, /cooler|draft.*inventory/i);
  const spiritsTitle = findTitle(SHEET_NAMES.SPIRITS_CATALOG, /spirit.*catalog|spirits/i);
  const kegLogTitle = findTitle(SHEET_NAMES.KEG_LOG, /keg.*(change|log)/i);
  const spiritLogTitle = findTitle(SHEET_NAMES.SPIRIT_LOG, /spirit.*(removal|pull|log)/i);
  const depositsTitle = findTitle(SHEET_NAMES.DEPOSITS, /deposit/i);
  const staffTitle = findTitle(SHEET_NAMES.STAFF, /staff|permission/i);
  const packagedLogTitle = findTitle(SHEET_NAMES.PACKAGED_LOG, /packaged/i);
  const settingsTitle = findTitle(SHEET_NAMES.SETTINGS, /settings|categor/i);
  const purchaseOrdersTitle = findTitle(SHEET_NAMES.PURCHASE_ORDERS, /purchase|restock|order/i);

  // Cache resolved titles for this spreadsheet
  if (!tabTitleCache[spreadsheetId]) tabTitleCache[spreadsheetId] = {};
  if (onTapTitle) tabTitleCache[spreadsheetId][SHEET_NAMES.ON_TAP] = onTapTitle;
  if (coolerTitle) tabTitleCache[spreadsheetId][SHEET_NAMES.COOLER_INVENTORY] = coolerTitle;
  if (spiritsTitle) tabTitleCache[spreadsheetId][SHEET_NAMES.SPIRITS_CATALOG] = spiritsTitle;
  if (kegLogTitle) tabTitleCache[spreadsheetId][SHEET_NAMES.KEG_LOG] = kegLogTitle;
  if (spiritLogTitle) tabTitleCache[spreadsheetId][SHEET_NAMES.SPIRIT_LOG] = spiritLogTitle;
  if (depositsTitle) tabTitleCache[spreadsheetId][SHEET_NAMES.DEPOSITS] = depositsTitle;
  if (staffTitle) tabTitleCache[spreadsheetId][SHEET_NAMES.STAFF] = staffTitle;
  if (packagedLogTitle) tabTitleCache[spreadsheetId][SHEET_NAMES.PACKAGED_LOG] = packagedLogTitle;
  if (settingsTitle) tabTitleCache[spreadsheetId][SHEET_NAMES.SETTINGS] = settingsTitle;
  if (purchaseOrdersTitle) tabTitleCache[spreadsheetId][SHEET_NAMES.PURCHASE_ORDERS] = purchaseOrdersTitle;

  // Construct batch ranges for existing tabs
  const rangesToFetch: { key: string; range: string }[] = [];
  if (onTapTitle) rangesToFetch.push({ key: 'onTap', range: `'${onTapTitle}'!A1:Q60` });
  if (coolerTitle) rangesToFetch.push({ key: 'cooler', range: `'${coolerTitle}'!A2:H150` });
  if (spiritsTitle) rangesToFetch.push({ key: 'spirits', range: `'${spiritsTitle}'!A2:F150` });
  if (kegLogTitle) rangesToFetch.push({ key: 'kegLog', range: `'${kegLogTitle}'!A2:H500` });
  if (spiritLogTitle) rangesToFetch.push({ key: 'spiritLog', range: `'${spiritLogTitle}'!A2:F500` });
  if (depositsTitle) rangesToFetch.push({ key: 'deposits', range: `'${depositsTitle}'!A2:G500` });
  if (staffTitle) rangesToFetch.push({ key: 'staff', range: `'${staffTitle}'!A2:D100` });
  if (packagedLogTitle) rangesToFetch.push({ key: 'packagedLog', range: `'${packagedLogTitle}'!A2:G500` });
  if (settingsTitle) rangesToFetch.push({ key: 'settings', range: `'${settingsTitle}'!A2:A100` });
  if (purchaseOrdersTitle) rangesToFetch.push({ key: 'purchaseOrders', range: `'${purchaseOrdersTitle}'!A2:I300` });

  if (rangesToFetch.length === 0) {
    return {
      taps: null,
      coolerStock: null,
      spiritsCatalog: null,
      staffUsers: null,
      beerStyles: INITIAL_BEER_STYLES,
      kegChanges: [],
      spiritRemovals: [],
      kegDeposits: [],
      packagedMovements: [],
      purchaseOrders: [],
    };
  }

  const encodedRanges = rangesToFetch.map((r) => encodeURIComponent(r.range)).join('&ranges=');
  const url = `${BASE_URL}/${spreadsheetId}/values:batchGet?ranges=${encodedRanges}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 429) {
    quotaExceededCooldownUntil = Date.now() + 60000;
    console.warn('[Google Sheets] 429 Quota Exceeded on values batch read. Cooldown active for 60s.');
    if (sheetDataCache[spreadsheetId]) {
      return sheetDataCache[spreadsheetId].data;
    }
    return {
      taps: null,
      coolerStock: null,
      spiritsCatalog: null,
      staffUsers: null,
      beerStyles: INITIAL_BEER_STYLES,
      kegChanges: [],
      spiritRemovals: [],
      kegDeposits: [],
      packagedMovements: [],
      purchaseOrders: [],
      rateLimited: true,
    };
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch spreadsheet data: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const valueRanges = data.valueRanges || [];

  // Map results back by key
  const valuesByKey: Record<string, any[][]> = {};
  rangesToFetch.forEach((item, index) => {
    valuesByKey[item.key] = valueRanges[index]?.values || [];
  });

  // 1. Parse Cooler / Keg Master Inventory (with Status and Base Cans)
  let coolerStock: CoolerItem[] | null = null;
  if (valuesByKey.cooler && valuesByKey.cooler.length > 0) {
    coolerStock = valuesByKey.cooler
      .filter((row) => row && row[0] && row[1]) // must have SKU and Brand
      .map((row) => {
        const sku = String(row[0]).trim();
        const brand = String(row[1]).trim();
        const style = String(row[2] || 'Craft Beer').trim();
        const formatStr = String(row[3] || '1/2 BBL').trim();
        const format: CoolerItem['format'] =
          formatStr === '1/6 BBL'
            ? '1/6 BBL'
            : formatStr.startsWith('Packaged Case')
            ? 'Packaged Case'
            : formatStr.startsWith('Packaged')
            ? 'Packaged 16oz'
            : '1/2 BBL';
        const count = Number(row[4]) || 0;
        const parLevel = Number(row[5]) || 2;
        const unit = String(row[6] || (format.startsWith('Packaged') ? 'Cans' : 'Kegs')).trim();
        const statusRaw = String(row[7] || 'Active').trim().toLowerCase();
        const status: ProductStatus = statusRaw === 'inactive' ? 'Inactive' : 'Active';
        const baseCanCount = format.startsWith('Packaged') ? count : undefined;

        return {
          id: sku,
          sku,
          brand,
          style,
          format,
          count,
          baseCanCount,
          parLevel,
          unit,
          status,
        };
      });
  }

  // 2. Parse Spirits Master Catalog (with Status)
  let spiritsCatalog: SpiritItem[] | null = null;
  if (valuesByKey.spirits && valuesByKey.spirits.length > 0) {
    spiritsCatalog = valuesByKey.spirits
      .filter((row) => row && row[0] && row[1])
      .map((row) => {
        const sku = String(row[0]).trim();
        const brand = String(row[1]).trim();
        const category = String(row[2] || 'Spirits').trim();
        const defaultPar = Number(row[3]) || 3;
        const fastSelect = String(row[4] || '').toUpperCase() === 'TRUE';
        const statusRaw = String(row[5] || 'Active').trim().toLowerCase();
        const status: ProductStatus = statusRaw === 'inactive' ? 'Inactive' : 'Active';

        return {
          sku,
          brand,
          category,
          defaultPar,
          fastSelect,
          status,
        };
      });
  }

  // 3. Parse Taps directly from "🍻 On-Tap & Line Flow"
  let taps: Tap[] | null = null;
  if (valuesByKey.onTap && valuesByKey.onTap.length > 0) {
    const rawRows = valuesByKey.onTap;
    const headerRow = (rawRows[0] || []).map((c: any) => String(c || '').trim().toLowerCase());
    const isFirstRowHeader = headerRow.some((c: string) => c.includes('tap') || c.includes('brand') || c.includes('beer'));
    const rows = isFirstRowHeader ? rawRows.slice(1) : rawRows;

    // Detect column positions dynamically from header row
    const tapCol = isFirstRowHeader ? headerRow.findIndex((c: string) => c.includes('tap')) : 0;
    const brandCol = isFirstRowHeader
      ? headerRow.findIndex(
          (c: string) =>
            (c.includes('brand') || c.includes('beer') || c.includes('name')) &&
            !c.includes('on-deck') &&
            !c.includes('on deck')
        )
      : 3;
    const styleCol = isFirstRowHeader
      ? headerRow.findIndex(
          (c: string) => c.includes('style') && !c.includes('on-deck') && !c.includes('on deck')
        )
      : 4;
    const formatCol = isFirstRowHeader
      ? headerRow.findIndex(
          (c: string) =>
            (c.includes('format') || c.includes('size')) &&
            !c.includes('on-deck') &&
            !c.includes('on deck')
        )
      : 5;
    const abvCol = isFirstRowHeader ? headerRow.findIndex((c: string) => c.includes('abv')) : 6;
    const skuCol = isFirstRowHeader
      ? headerRow.findIndex(
          (c: string) => c.includes('sku') && !c.includes('on-deck') && !c.includes('on deck')
        )
      : 2;
    const locCol = isFirstRowHeader ? headerRow.findIndex((c: string) => c.includes('loc')) : 1;
    const halfBblStockCol = isFirstRowHeader ? headerRow.findIndex((c: string) => c.includes('cooler') && c.includes('1/2')) : 7;
    const sixthBblStockCol = isFirstRowHeader ? headerRow.findIndex((c: string) => c.includes('cooler') && c.includes('1/6')) : 8;
    const changedCol = isFirstRowHeader ? headerRow.findIndex((c: string) => c.includes('changed') && !c.includes('by')) : 9;
    const changedByCol = isFirstRowHeader ? headerRow.findIndex((c: string) => c.includes('changed by') || c.includes('staff')) : 10;
    const onDeckSkuCol = isFirstRowHeader
      ? headerRow.findIndex((c: string) => (c.includes('on-deck') || c.includes('on deck')) && c.includes('sku'))
      : 11;
    const onDeckBrandCol = isFirstRowHeader
      ? headerRow.findIndex(
          (c: string) => (c.includes('on-deck') || c.includes('on deck')) && (c.includes('brand') || c.includes('beer') || c.includes('name'))
        )
      : 12;
    const onDeckFormatCol = isFirstRowHeader
      ? headerRow.findIndex(
          (c: string) => (c.includes('on-deck') || c.includes('on deck')) && (c.includes('format') || c.includes('size'))
        )
      : 13;
    const onDeckStyleCol = isFirstRowHeader
      ? headerRow.findIndex((c: string) => (c.includes('on-deck') || c.includes('on deck')) && c.includes('style'))
      : 14;
    const onDeckTypeCol = isFirstRowHeader
      ? headerRow.findIndex((c: string) => (c.includes('on-deck') || c.includes('on deck')) && c.includes('type'))
      : 15;
    const onDeckScheduleCol = isFirstRowHeader
      ? headerRow.findIndex(
          (c: string) => (c.includes('on-deck') || c.includes('on deck')) && (c.includes('sched') || c.includes('note'))
        )
      : 16;

    taps = rows
      .filter((row: any[]) => row && row.length > 0 && row.some((c: any) => String(c || '').trim() !== ''))
      .map((row: any[], i: number) => {
        const parsedNum =
          tapCol !== -1 && row[tapCol] !== undefined
            ? parseInt(String(row[tapCol]).replace(/[^0-9]/g, ''), 10)
            : i + 1;
        const tapNum = isNaN(parsedNum) || parsedNum <= 0 ? i + 1 : parsedNum;

        // Exact brand name directly from the sheet row
        const rawBrand = brandCol !== -1 && row[brandCol] !== undefined ? String(row[brandCol]).trim() : '';
        const brand = rawBrand || `Tap #${tapNum}`;

        const rawStyle = styleCol !== -1 && row[styleCol] !== undefined ? String(row[styleCol]).trim() : '';
        const style = rawStyle || 'Craft Beer';

        const rawAbv = abvCol !== -1 && row[abvCol] !== undefined ? String(row[abvCol]).trim() : '';
        const abv = rawAbv || undefined;

        const rawFormat = formatCol !== -1 && row[formatCol] !== undefined ? String(row[formatCol]).trim() : '';
        const format: KegFormat = rawFormat.toLowerCase().includes('1/6') || rawFormat.toLowerCase().includes('sixtel') ? '1/6 BBL' : '1/2 BBL';

        const rawSku = skuCol !== -1 && row[skuCol] !== undefined ? String(row[skuCol]).trim() : '';
        const sku = rawSku || `KEG-${String(tapNum).padStart(3, '0')}`;

        const rawLoc = locCol !== -1 && row[locCol] !== undefined ? String(row[locCol]).trim() : '';
        const location: 'Inside' | 'Patio' = rawLoc.toLowerCase().includes('patio') || tapNum > 26 ? 'Patio' : 'Inside';

        const coolerStockHalfBbl = halfBblStockCol !== -1 && row[halfBblStockCol] !== undefined ? Number(row[halfBblStockCol]) || 0 : 2;
        const coolerStockSixthBbl = sixthBblStockCol !== -1 && row[sixthBblStockCol] !== undefined ? Number(row[sixthBblStockCol]) || 0 : 1;
        const lastChanged = changedCol !== -1 && row[changedCol] !== undefined ? String(row[changedCol]).trim() || 'Active' : 'Active';
        const changedBy = changedByCol !== -1 && row[changedByCol] !== undefined ? String(row[changedByCol]).trim() || 'Staff' : 'Staff';

        const onDeckSku = onDeckSkuCol !== -1 && row[onDeckSkuCol] ? String(row[onDeckSkuCol]).trim() : undefined;
        const onDeckBrand = onDeckBrandCol !== -1 && row[onDeckBrandCol] ? String(row[onDeckBrandCol]).trim() : undefined;
        const onDeckFormatRaw = onDeckFormatCol !== -1 && row[onDeckFormatCol] ? String(row[onDeckFormatCol]).trim() : undefined;
        const onDeckFormat: KegFormat | undefined = onDeckFormatRaw?.toLowerCase().includes('1/6') ? '1/6 BBL' : onDeckFormatRaw ? '1/2 BBL' : undefined;
        const onDeckStyle = onDeckStyleCol !== -1 && row[onDeckStyleCol] ? String(row[onDeckStyleCol]).trim() : undefined;
        const onDeckTypeRaw = onDeckTypeCol !== -1 && row[onDeckTypeCol] ? String(row[onDeckTypeCol]).trim() : undefined;
        const onDeckType: OnDeckType | undefined =
          onDeckTypeRaw === 'SCHEDULED_ROTATION' || onDeckTypeRaw === 'IMMEDIATE_REPLACEMENT' || onDeckTypeRaw === 'AUTO_SAME_BRAND'
            ? (onDeckTypeRaw as OnDeckType)
            : undefined;
        const onDeckSchedule = onDeckScheduleCol !== -1 && row[onDeckScheduleCol] ? String(row[onDeckScheduleCol]).trim() : undefined;

        return {
          tapNumber: tapNum,
          location,
          sku,
          brand,
          style,
          format,
          abv,
          coolerStockHalfBbl,
          coolerStockSixthBbl,
          lastChanged,
          changedBy,
          onDeckSku,
          onDeckBrand,
          onDeckFormat,
          onDeckStyle,
          onDeckType,
          onDeckScheduledDate: onDeckType === 'SCHEDULED_ROTATION' ? onDeckSchedule : undefined,
          onDeckNotes: onDeckType !== 'SCHEDULED_ROTATION' ? onDeckSchedule : undefined,
        };
      });
  }

  // 4. Parse Keg Change Log
  const kegChanges: KegChangeLogEntry[] = (valuesByKey.kegLog || [])
    .map((row: any[], i: number) => {
      // Support 8-column [timestamp, tap, oldSku, oldBrand, newSku, newBrand, format, staff]
      // and older 6-column [timestamp, tap, oldSku, newSku, format, staff]
      const hasBrandCols = row.length >= 8;
      const oldSku = String(row[2] || '');
      const oldBrand = hasBrandCols ? String(row[3] || '') : oldSku;
      const newSku = hasBrandCols ? String(row[4] || '') : String(row[3] || '');
      const newBrand = hasBrandCols ? String(row[5] || '') : newSku;
      const format = (hasBrandCols ? row[6] : row[4]) || '1/2 BBL';
      const staffMember = (hasBrandCols ? row[7] : row[5]) || 'Staff';

      return {
        id: `kc-sheet-${i}`,
        timestamp: String(row[0] || ''),
        tapNumber: Number(row[1]) || 0,
        oldSku,
        oldBrand,
        newSku,
        newBrand,
        format,
        staffMember,
        synced: true,
      };
    })
    .reverse();

  // 5. Parse Spirit Removals Log
  const spiritRemovals: SpiritRemovalEntry[] = (valuesByKey.spiritLog || [])
    .map((row: any[], i: number) => {
      // Support 6-column [timestamp, station, spiritSku, spiritBrand, bottleCount, staff]
      // and older 5-column [timestamp, station, spiritBrand, bottleCount, staff]
      const hasSkuCol = row.length >= 6;
      const spiritSku = hasSkuCol ? String(row[2] || '') : `SPR-${String(i + 1).padStart(3, '0')}`;
      const spiritBrand = hasSkuCol ? String(row[3] || '') : String(row[2] || '');
      const bottleCount = Number(hasSkuCol ? row[4] : row[3]) || 1;
      const staffMember = String(hasSkuCol ? row[5] : row[4] || '');

      return {
        id: `sr-sheet-${i}`,
        timestamp: String(row[0] || ''),
        station: (row[1] as any) || 'Service Well',
        spiritSku,
        spiritBrand,
        bottleCount,
        staffMember,
        synced: true,
      };
    })
    .reverse();

  // Dynamic fallback: If no master spirits catalog tab existed, dynamically derive catalog from Spirit Removals!
  if (!spiritsCatalog && spiritRemovals.length > 0) {
    const brandMap = new Map<string, SpiritItem>();
    spiritRemovals.forEach((r, idx) => {
      if (r.spiritBrand && !brandMap.has(r.spiritBrand)) {
        brandMap.set(r.spiritBrand, {
          sku: r.spiritSku || `SPR-${String(idx + 1).padStart(3, '0')}`,
          brand: r.spiritBrand,
          category: 'Spirits',
          defaultPar: 3,
          fastSelect: idx < 8,
        });
      }
    });
    if (brandMap.size > 0) {
      spiritsCatalog = Array.from(brandMap.values());
    }
  }

  // 6. Parse Keg Deposits
  const kegDeposits: KegDepositEntry[] = (valuesByKey.deposits || [])
    .map((row: any[], i: number) => ({
      id: `kd-sheet-${i}`,
      date: String(row[0] || ''),
      customerName: String(row[1] || ''),
      phone: String(row[2] || ''),
      transaction: (row[3] as any) || 'Deposit Charged $30',
      amount: 30,
      status: (row[5] as any) || 'Active',
      loggedBy: String(row[6] || ''),
      synced: true,
    }))
    .reverse();

  // 7. Parse Staff & Permissions
  let staffUsers: StaffUser[] | null = null;
  if (valuesByKey.staff && valuesByKey.staff.length > 0) {
    staffUsers = valuesByKey.staff
      .filter((row: any[]) => row && row[0])
      .map((row: any[], i: number) => {
        const name = String(row[0]).trim();
        const rawRole = String(row[1] || 'Bartender').trim();
        const role: StaffRole =
          rawRole.toLowerCase().includes('super')
            ? 'Shift Supervisor'
            : rawRole.toLowerCase().includes('manage')
            ? 'Manager'
            : 'Bartender';
        const rawStatus = String(row[2] || 'Active').trim().toLowerCase();
        const status: StaffStatus = rawStatus === 'inactive' ? 'Inactive' : 'Active';
        const rawPin = row[3] !== undefined && row[3] !== null ? String(row[3]).trim() : '';
        const defaultPin = role === 'Manager' || role === 'Shift Supervisor' ? '9999' : '1234';
        const pin = rawPin || defaultPin;

        return {
          id: `staff-sheet-${i}-${name.replace(/\s+/g, '-').toLowerCase()}`,
          name,
          role,
          status,
          title: role,
          pin,
        };
      });
  }

  // 8. Parse Packaged Movement Log
  const packagedMovements: PackagedMovementEntry[] = (valuesByKey.packagedLog || [])
    .map((row: any[], i: number) => ({
      id: `pkg-sheet-${i}`,
      timestamp: String(row[0] || ''),
      sku: String(row[1] || ''),
      brand: String(row[2] || ''),
      formatPulled: (row[3] as any) || 'Single Can (-1)',
      cansChanged: Number(row[4]) || 0,
      remainingCans: Number(row[5]) || 0,
      staffMember: String(row[6] || 'Staff'),
      synced: true,
    }))
    .reverse();

  // 9. Parse Purchase & Restock Orders
  const purchaseOrders: PurchaseOrder[] = (valuesByKey.purchaseOrders || [])
    .map((row: any[], i: number) => ({
      id: String(row[0] || `PO-${i + 1}`).trim(),
      timestamp: String(row[1] || '').trim(),
      sku: String(row[2] || '').trim(),
      brand: String(row[3] || '').trim(),
      format: String(row[4] || '1/2 BBL').trim(),
      quantity: Number(row[5]) || 1,
      vendor: String(row[6] || '').trim(),
      status: (String(row[7] || 'Ordered').trim().toLowerCase() === 'received' ? 'Received' : 'Ordered') as OrderStatus,
      loggedBy: String(row[8] || 'Manager').trim(),
      synced: true,
    }))
    .reverse();

  const result = {
    taps,
    coolerStock,
    spiritsCatalog,
    staffUsers,
    kegChanges,
    spiritRemovals,
    kegDeposits,
    packagedMovements,
    purchaseOrders,
  };

  sheetDataCache[spreadsheetId] = {
    timestamp: Date.now(),
    data: result,
  };

  return result;
}

/**
 * Updates a tap row in "🍻 On-Tap & Line Flow"
 */
export async function updateTapRow(
  token: string,
  spreadsheetId: string,
  tap: Tap
) {
  const targetTitle = await ensureSheetTabExists(
    token,
    spreadsheetId,
    SHEET_NAMES.ON_TAP,
    /on-?tap|line.*flow|tap/i
  );
  // Row number is tapNumber + 1 (header is row 1)
  const rowNumber = tap.tapNumber + 1;
  const safeTitle = targetTitle.replace(/'/g, "''");
  const range = `'${safeTitle}'!A${rowNumber}:Q${rowNumber}`;
  const values = [
    [
      tap.tapNumber,
      tap.location,
      tap.sku || `KEG-${String(tap.tapNumber).padStart(3, '0')}`,
      tap.brand,
      tap.style,
      tap.format,
      tap.abv || '',
      tap.coolerStockHalfBbl,
      tap.coolerStockSixthBbl,
      tap.lastChanged,
      tap.changedBy,
      tap.onDeckSku || '',
      tap.onDeckBrand || '',
      tap.onDeckFormat || '',
      tap.onDeckStyle || '',
      tap.onDeckType || '',
      tap.onDeckScheduledDate || tap.onDeckNotes || '',
    ],
  ];

  let res = await fetch(
    `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to update tap row: ${res.status} ${errorText}`);
  }
}

/**
 * Safely appends rows to a spreadsheet tab:
 * 1. Verifies tab existence (creating it with default headers if missing).
 * 2. Escapes any single quotes in the tab title: range = `'${safeTitle}'!A1`.
 * 3. Catches 400 Bad Request, range parse errors, and 404s.
 * 4. On range error, forces tab verification/creation and retries appending.
 */
async function safeAppendRow(
  token: string,
  spreadsheetId: string,
  preferredTitle: string,
  aliasRegex: RegExp,
  defaultHeaders: string[],
  values: any[][],
  logContext: string
): Promise<void> {
  let targetTitle = await ensureSheetTabExists(
    token,
    spreadsheetId,
    preferredTitle,
    aliasRegex,
    defaultHeaders
  );

  const safeTitle = targetTitle.replace(/'/g, "''");
  let range = `'${safeTitle}'!A1`;

  try {
    let res = await fetch(
      `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      }
    );

    if (res.ok) return;

    const errorText = await res.text();
    // Safely catch 400 Bad Request range errors, missing tab (404), or range parse errors
    if (res.status === 400 || res.status === 404 || errorText.toLowerCase().includes('range')) {
      console.warn(`[Sheets] Append failed for ${logContext} (${res.status}), re-verifying tab and retrying...`);
      targetTitle = await ensureSheetTabExists(
        token,
        spreadsheetId,
        preferredTitle,
        aliasRegex,
        defaultHeaders,
        true
      );
      const retrySafeTitle = targetTitle.replace(/'/g, "''");
      range = `'${retrySafeTitle}'!A1`;

      res = await fetch(
        `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values }),
        }
      );

      if (res.ok) return;

      // Fallback: append using just sheet name without !A1
      const fallbackRange = `'${retrySafeTitle}'`;
      res = await fetch(
        `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(fallbackRange)}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values }),
        }
      );

      if (res.ok) return;

      const retryError = await res.text();
      console.warn(`[Sheets] Safe append recovery failed for ${logContext} (${res.status}): ${retryError}`);
      return;
    }

    throw new Error(`Failed to append ${logContext}: ${res.status} ${errorText}`);
  } catch (err: any) {
    console.warn(`[Sheets] Caught error during ${logContext} append:`, err?.message || err);
  }
}

/**
 * Appends a row to Keg Change Log with both SKU and Product Name
 */
export async function appendKegChangeRow(
  token: string,
  spreadsheetId: string,
  entry: KegChangeLogEntry
) {
  const values = [
    [
      entry.timestamp,
      entry.tapNumber,
      entry.oldSku || '',
      entry.oldBrand || entry.oldSku || '',
      entry.newSku || '',
      entry.newBrand || entry.newSku || '',
      entry.format,
      entry.staffMember,
    ],
  ];

  await safeAppendRow(
    token,
    spreadsheetId,
    SHEET_NAMES.KEG_LOG,
    /keg.*(change|log)/i,
    ['Timestamp', 'Tap #', 'Old SKU', 'Old Brand', 'New SKU', 'New Brand', 'Format', 'Staff Member'],
    values,
    'keg change'
  );
}

/**
 * Appends a row to Spirit Removals Log with both SKU and Product Name
 */
export async function appendSpiritRemovalRow(
  token: string,
  spreadsheetId: string,
  entry: SpiritRemovalEntry
) {
  const values = [
    [
      entry.timestamp,
      entry.station,
      entry.spiritSku || '',
      entry.spiritBrand,
      entry.bottleCount,
      entry.staffMember,
    ],
  ];

  await safeAppendRow(
    token,
    spreadsheetId,
    SHEET_NAMES.SPIRIT_LOG,
    /spirit.*(removal|pull|log)/i,
    ['Timestamp', 'Station', 'Spirit SKU', 'Spirit Brand', 'Bottle Count', 'Staff Member'],
    values,
    'spirit pull'
  );
}

/**
 * Appends a row to Keg Deposits
 */
export async function appendKegDepositRow(
  token: string,
  spreadsheetId: string,
  entry: KegDepositEntry
) {
  const values = [
    [
      entry.date,
      entry.customerName,
      entry.phone,
      entry.transaction,
      `$${entry.amount}`,
      entry.status,
      entry.loggedBy,
    ],
  ];

  await safeAppendRow(
    token,
    spreadsheetId,
    SHEET_NAMES.DEPOSITS,
    /deposit/i,
    ['Date', 'Customer Name', 'Phone', 'Transaction', 'Amount', 'Status', 'Logged By'],
    values,
    'keg deposit'
  );
}

/**
 * Appends a new beer / draft item to "📦 Cooler & Draft Inventory"
 */
export async function appendCoolerItemRow(
  token: string,
  spreadsheetId: string,
  item: CoolerItem
) {
  const values = [
    [
      item.sku,
      item.brand,
      item.style,
      item.format,
      item.baseCanCount ?? item.count,
      item.parLevel,
      item.unit,
      item.status || 'Active',
    ],
  ];

  await safeAppendRow(
    token,
    spreadsheetId,
    SHEET_NAMES.COOLER_INVENTORY,
    /cooler|draft.*inventory|inventory/i,
    ['SKU', 'Brand / Beer Name', 'Style', 'Format', 'Current Stock', 'Par Level', 'Unit', 'Status'],
    values,
    'cooler product'
  );
}

/**
 * Appends a new spirit item to "🥃 Master Spirits Catalog"
 */
export async function appendSpiritItemRow(
  token: string,
  spreadsheetId: string,
  item: SpiritItem
) {
  const values = [
    [
      item.sku,
      item.brand,
      item.category,
      item.defaultPar,
      item.fastSelect ? 'TRUE' : 'FALSE',
      item.status || 'Active',
    ],
  ];

  await safeAppendRow(
    token,
    spreadsheetId,
    SHEET_NAMES.SPIRITS_CATALOG,
    /spirit.*catalog|spirits/i,
    ['Spirit SKU', 'Brand / Product Name', 'Category', 'Default Par', 'Fast Pick (TRUE/FALSE)', 'Status'],
    values,
    'spirit product'
  );
}

/**
 * Appends a packaged movement entry to "🥫 Packaged Movement Log"
 */
export async function appendPackagedMovementRow(
  token: string,
  spreadsheetId: string,
  entry: PackagedMovementEntry
) {
  const values = [
    [
      entry.timestamp,
      entry.sku,
      entry.brand,
      entry.formatPulled,
      entry.cansChanged,
      entry.remainingCans,
      entry.staffMember,
    ],
  ];

  await safeAppendRow(
    token,
    spreadsheetId,
    SHEET_NAMES.PACKAGED_LOG,
    /packaged/i,
    ['Timestamp', 'SKU', 'Brand', 'Format Pulled', 'Cans Changed', 'Remaining Cans', 'Staff Member'],
    values,
    'packaged movement'
  );
}

/**
 * Updates a cooler product row in "📦 Cooler & Draft Inventory"
 */
export async function updateCoolerItemRow(
  token: string,
  spreadsheetId: string,
  item: CoolerItem,
  rowIndex: number
) {
  const targetTitle = await ensureSheetTabExists(
    token,
    spreadsheetId,
    SHEET_NAMES.COOLER_INVENTORY,
    /cooler|draft.*inventory|inventory/i
  );
  const safeTitle = targetTitle.replace(/'/g, "''");
  const range = `'${safeTitle}'!A${rowIndex}:H${rowIndex}`;
  const values = [
    [
      item.sku,
      item.brand,
      item.style,
      item.format,
      item.baseCanCount ?? item.count,
      item.parLevel,
      item.unit,
      item.status || 'Active',
    ],
  ];

  const res = await fetch(
    `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to update cooler row: ${res.status} ${errorText}`);
  }
}

/**
 * Updates a spirit product row in "🥃 Master Spirits Catalog"
 */
export async function updateSpiritItemRow(
  token: string,
  spreadsheetId: string,
  item: SpiritItem,
  rowIndex: number
) {
  const targetTitle = await ensureSheetTabExists(
    token,
    spreadsheetId,
    SHEET_NAMES.SPIRITS_CATALOG,
    /spirit.*catalog|spirits/i
  );
  const safeTitle = targetTitle.replace(/'/g, "''");
  const range = `'${safeTitle}'!A${rowIndex}:F${rowIndex}`;
  const values = [
    [
      item.sku,
      item.brand,
      item.category,
      item.defaultPar,
      item.fastSelect ? 'TRUE' : 'FALSE',
      item.status || 'Active',
    ],
  ];

  const res = await fetch(
    `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to update spirit row: ${res.status} ${errorText}`);
  }
}

/**
 * Appends a purchase order entry to "📋 Purchase & Restock Orders"
 */
export async function appendPurchaseOrderRow(
  token: string,
  spreadsheetId: string,
  order: PurchaseOrder
) {
  const values = [
    [
      order.id,
      order.timestamp,
      order.sku,
      order.brand,
      order.format,
      order.quantity,
      order.vendor || '',
      order.status,
      order.loggedBy,
    ],
  ];

  await safeAppendRow(
    token,
    spreadsheetId,
    SHEET_NAMES.PURCHASE_ORDERS,
    /purchase|restock|order/i,
    ['Order ID', 'Timestamp', 'SKU', 'Brand', 'Format', 'Quantity', 'Vendor', 'Status', 'Logged By'],
    values,
    'purchase order'
  );
}

/**
 * Appends multiple purchase order entries in a single batch to "📋 Purchase & Restock Orders"
 */
export async function appendPurchaseOrdersBatch(
  token: string,
  spreadsheetId: string,
  orders: PurchaseOrder[]
) {
  if (!orders || orders.length === 0) return;

  const values = orders.map((order) => [
    order.id,
    order.timestamp,
    order.sku,
    order.brand,
    order.format,
    order.quantity,
    order.vendor || '',
    order.status,
    order.loggedBy,
  ]);

  await safeAppendRow(
    token,
    spreadsheetId,
    SHEET_NAMES.PURCHASE_ORDERS,
    /purchase|restock|order/i,
    ['Order ID', 'Timestamp', 'SKU', 'Brand', 'Format', 'Quantity', 'Vendor', 'Status', 'Logged By'],
    values,
    `batch purchase orders (${orders.length} items)`
  );
}

/**
 * Updates the status of a purchase order row (e.g. from 'Ordered' to 'Received')
 */
export async function updatePurchaseOrderStatus(
  token: string,
  spreadsheetId: string,
  orderId: string,
  newStatus: OrderStatus,
  rowIndex?: number
) {
  const targetTitle = await ensureSheetTabExists(
    token,
    spreadsheetId,
    SHEET_NAMES.PURCHASE_ORDERS,
    /purchase|restock|order/i,
    ['Order ID', 'Timestamp', 'SKU', 'Brand', 'Format', 'Quantity', 'Vendor', 'Status', 'Logged By']
  );

  const safeTitle = targetTitle.replace(/'/g, "''");

  // If exact rowIndex is provided, update Column H (Status) directly
  if (rowIndex && rowIndex > 1) {
    const range = `'${safeTitle}'!H${rowIndex}`;
    await fetch(
      `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [[newStatus]] }),
      }
    );
    return;
  }

  // Otherwise, lookup row by Order ID in Column A
  try {
    const readRes = await fetch(
      `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(`'${safeTitle}'!A2:A300`)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (readRes.ok) {
      const data = await readRes.json();
      const rows = data.values || [];
      const idx = rows.findIndex((r: any[]) => String(r[0]).trim() === orderId.trim());
      if (idx !== -1) {
        const actualRow = idx + 2;
        const range = `'${safeTitle}'!H${actualRow}`;
        await fetch(
          `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ values: [[newStatus]] }),
          }
        );
      }
    }
  } catch (err) {
    console.warn(`[Sheets] Failed to update purchase order ${orderId} status:`, err);
  }
}

/**
 * Public Fallback: Fetch tap lines directly from public Google Sheet tab
 * Uses Google Visualization API to read rows without requiring active OAuth sign-in.
 */
export async function fetchSpreadsheetDataPublic(spreadsheetId: string): Promise<Tap[] | null> {
  if (!spreadsheetId) return null;
  const tabNames = ['🍻 On-Tap & Line Flow', 'On-Tap & Line Flow', 'On-Tap', 'Line Flow', 'Taps', 'Sheet1'];

  for (const tab of tabNames) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
      if (!match || !match[1]) continue;
      const json = JSON.parse(match[1]);
      const table = json.table;
      if (!table || !table.rows || table.rows.length === 0) continue;

      const cols = (table.cols || []).map((c: any) => String(c?.label || c?.id || '').trim().toLowerCase());
      const tapCol = cols.findIndex((c: string) => c.includes('tap'));
      const brandCol = cols.findIndex(
        (c: string) =>
          (c.includes('brand') || c.includes('beer') || c.includes('name')) &&
          !c.includes('on-deck') &&
          !c.includes('on deck')
      );
      const styleCol = cols.findIndex((c: string) => c.includes('style') && !c.includes('on-deck'));
      const formatCol = cols.findIndex((c: string) => (c.includes('format') || c.includes('size')) && !c.includes('on-deck'));
      const abvCol = cols.findIndex((c: string) => c.includes('abv'));
      const skuCol = cols.findIndex((c: string) => c.includes('sku') && !c.includes('on-deck'));
      const locCol = cols.findIndex((c: string) => c.includes('loc'));

      const parsedTaps: Tap[] = table.rows
        .filter((r: any) => r && r.c)
        .map((r: any, i: number) => {
          const c = r.c || [];
          const rawTap = tapCol !== -1 && c[tapCol]?.v !== undefined ? Number(c[tapCol]?.v) : i + 1;
          const tapNum = isNaN(rawTap) || rawTap <= 0 ? i + 1 : rawTap;

          // Exact brand name from the public sheet row
          const rawBrand = brandCol !== -1 && c[brandCol]?.v !== undefined ? String(c[brandCol]?.v).trim() : '';
          const brand = rawBrand || `Tap #${tapNum}`;

          const rawStyle = styleCol !== -1 && c[styleCol]?.v !== undefined ? String(c[styleCol]?.v).trim() : '';
          const style = rawStyle || 'Craft Beer';

          const rawAbv = abvCol !== -1 && c[abvCol]?.v !== undefined ? String(c[abvCol]?.v).trim() : '';
          const abv = rawAbv || undefined;

          const rawFormat = formatCol !== -1 && c[formatCol]?.v !== undefined ? String(c[formatCol]?.v).trim() : '';
          const format: KegFormat = rawFormat.toLowerCase().includes('1/6') ? '1/6 BBL' : '1/2 BBL';

          const rawSku = skuCol !== -1 && c[skuCol]?.v !== undefined ? String(c[skuCol]?.v).trim() : '';
          const sku = rawSku || `KEG-${String(tapNum).padStart(3, '0')}`;

          const rawLoc = locCol !== -1 && c[locCol]?.v !== undefined ? String(c[locCol]?.v).trim() : '';
          const location: 'Inside' | 'Patio' =
            rawLoc.toLowerCase().includes('patio') || tapNum > 26 ? 'Patio' : 'Inside';

          return {
            tapNumber: tapNum,
            location,
            sku,
            brand,
            style,
            format,
            abv,
            coolerStockHalfBbl: 2,
            coolerStockSixthBbl: 1,
            lastChanged: 'Live Sheet',
            changedBy: 'Google Sheet',
          };
        });

      if (parsedTaps.length > 0) {
        return parsedTaps;
      }
    } catch (err) {
      console.warn(`Public GViz fetch for tab "${tab}":`, err);
    }
  }

  return null;
}

/**
 * Updates Column D ("PIN") for the specified staff member in "👥 Staff & Permissions"
 */
export async function updateStaffMemberPin(
  token: string,
  spreadsheetId: string,
  staffName: string,
  newPin: string
) {
  const staffTitle = await ensureSheetTabExists(
    token,
    spreadsheetId,
    SHEET_NAMES.STAFF,
    /staff|permission|employee/i,
    ['Staff Name', 'Role', 'Status', 'PIN']
  );

  const safeTitle = staffTitle.replace(/'/g, "''");
  const readUrl = `${BASE_URL}/${spreadsheetId}/values/'${safeTitle}'!A1:D100`;
  const res = await fetch(readUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to read staff tab: ${res.statusText}`);
  }

  const data = await res.json();
  const rows = data.values || [];

  // Find 1-based row index for matching staff name
  let targetRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const rowName = rows[i] && rows[i][0] ? String(rows[i][0]).trim().toLowerCase() : '';
    if (rowName === staffName.trim().toLowerCase()) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) {
    console.warn(`Staff member "${staffName}" not found in sheet to update PIN`);
    return;
  }

  // Update cell D{targetRow}
  const updateRange = `'${safeTitle}'!D${targetRow}`;
  const updateUrl = `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`;

  const updateRes = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [[newPin]],
    }),
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(`Failed to update staff PIN: ${updateRes.status} ${errText}`);
  }
}

