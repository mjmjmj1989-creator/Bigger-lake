import { Tap, CoolerItem, KegFormat, OnDeckType } from '../types/taproom';

export interface ResolvedOnDeck {
  hasOnDeck: boolean;
  onDeckBrand?: string;
  onDeckSku?: string;
  onDeckFormat?: KegFormat;
  onDeckStyle?: string;
  onDeckType: OnDeckType | 'NONE';
  isManagerOverride: boolean;
  scheduledDate?: string;
  notes?: string;
  badgeLabel: string;
  badgeType: 'scheduled' | 'immediate' | 'auto' | 'empty';
  statusText: string;
  hasCoolerBackup: boolean;
  backupCount: number;
}

/**
 * Resolves the effective On-Deck keg for a tap line.
 * 
 * Rules:
 * 1. Manager Overrides (Scheduled Rotation or Immediate Replacement) take priority.
 * 2. If no manager override is set, automatically falls back to same-brand backup in cooler.
 * 3. If cooler stock for that brand is 0, flags "No Backup In Cooler".
 */
export function resolveTapOnDeck(tap: Tap, coolerStock: CoolerItem[]): ResolvedOnDeck {
  // 1. Check for Manager Override
  const isExplicitManagerOverride =
    Boolean(tap.onDeckBrand && tap.onDeckSku) &&
    (tap.onDeckType === 'SCHEDULED_ROTATION' ||
      tap.onDeckType === 'IMMEDIATE_REPLACEMENT' ||
      tap.onDeckBrand?.toLowerCase() !== tap.brand.toLowerCase());

  if (isExplicitManagerOverride && tap.onDeckBrand && tap.onDeckSku) {
    const isScheduled = tap.onDeckType === 'SCHEDULED_ROTATION';
    const assignedFormat = (tap.onDeckFormat || tap.format) as KegFormat;

    // Check stock count of the manager-assigned keg in cooler
    const assignedItem = coolerStock.find(
      (c) =>
        (c.sku === tap.onDeckSku || c.brand.toLowerCase() === tap.onDeckBrand?.toLowerCase()) &&
        c.format === assignedFormat
    );

    // If the assigned item has been deactivated, do NOT resolve it as active on-deck
    if (!assignedItem || assignedItem.status !== 'Inactive') {
      const backupCount = assignedItem ? assignedItem.count : 1;

      return {
        hasOnDeck: true,
        onDeckBrand: tap.onDeckBrand,
        onDeckSku: tap.onDeckSku,
        onDeckFormat: assignedFormat,
        onDeckStyle: tap.onDeckStyle || tap.style,
        onDeckType: isScheduled ? 'SCHEDULED_ROTATION' : 'IMMEDIATE_REPLACEMENT',
        isManagerOverride: true,
        scheduledDate: tap.onDeckScheduledDate,
        notes: tap.onDeckNotes,
        badgeLabel: isScheduled ? 'Scheduled Rotation' : 'Immediate Replacement',
        badgeType: isScheduled ? 'scheduled' : 'immediate',
        statusText: isScheduled
          ? `Scheduled Rotation${tap.onDeckScheduledDate ? ` • ${tap.onDeckScheduledDate}` : ''}`
          : 'Immediate Replacement Queued',
        hasCoolerBackup: backupCount > 0,
        backupCount,
      };
    }
  }

  // 2. Auto-Resolution: Find same brand in cooler stock
  // Look for keg formats (1/2 BBL or 1/6 BBL) matching brand with count > 0
  const sameBrandKegs = coolerStock.filter((item) => {
    if (item.status === 'Inactive') return false;
    if (item.format !== '1/2 BBL' && item.format !== '1/6 BBL') return false;
    const matchesBrand =
      item.brand.trim().toLowerCase() === tap.brand.trim().toLowerCase() ||
      (tap.sku && item.sku === tap.sku);
    return matchesBrand && item.count > 0;
  });

  // Prefer exact same format first, otherwise any keg format of same brand
  const bestMatch =
    sameBrandKegs.find((item) => item.format === tap.format) || sameBrandKegs[0];

  if (bestMatch && bestMatch.count > 0) {
    return {
      hasOnDeck: true,
      onDeckBrand: bestMatch.brand,
      onDeckSku: bestMatch.sku,
      onDeckFormat: bestMatch.format as KegFormat,
      onDeckStyle: bestMatch.style || tap.style,
      onDeckType: 'AUTO_SAME_BRAND',
      isManagerOverride: false,
      scheduledDate: undefined,
      notes: undefined,
      badgeLabel: 'Auto On-Deck',
      badgeType: 'auto',
      statusText: `${bestMatch.count} backup ${bestMatch.format} in cooler`,
      hasCoolerBackup: true,
      backupCount: bestMatch.count,
    };
  }

  // 3. Fallback: 0 units of same brand in cooler
  return {
    hasOnDeck: false,
    onDeckBrand: undefined,
    onDeckSku: undefined,
    onDeckFormat: undefined,
    onDeckStyle: undefined,
    onDeckType: 'NONE',
    isManagerOverride: false,
    scheduledDate: undefined,
    notes: undefined,
    badgeLabel: 'No Backup In Cooler',
    badgeType: 'empty',
    statusText: 'No Backup In Cooler',
    hasCoolerBackup: false,
    backupCount: 0,
  };
}
