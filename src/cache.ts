const FALLBACK_TTL_MS = 30 * 60 * 1000; // hard expiry for entries with no ETag/Last-Modified
const FRESH_MS = 60 * 1000; // serve any cached entry without revalidation for this long
const MAX_ENTRIES = 500; // LRU cap to keep memory bounded on a long-lived server

export interface CacheEntry {
  value: any;
  etag?: string;
  lastModified?: string;
  freshUntil: number; // serve without a network call until this time
  expiresAt: number; // hard expiry, only applied to entries without a validator
}

export class SimpleCache {
  private store = new Map<string, CacheEntry>();

  get(key: string): CacheEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    const hasValidator = !!(entry.etag || entry.lastModified);
    // TTL only applies when there are no conditional-GET validators
    if (!hasValidator && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    // Mark as most-recently used (re-insert to move to the end of the Map)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry;
  }

  set(key: string, value: any, etag?: string, lastModified?: string): void {
    const now = Date.now();
    this.store.delete(key);
    this.store.set(key, { value, etag, lastModified, freshUntil: now + FRESH_MS, expiresAt: now + FALLBACK_TTL_MS });
    // Evict the least-recently-used entry (first key) once over capacity
    if (this.store.size > MAX_ENTRIES) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
  }

  // Whether an entry can be served without revalidating against Canvas
  isFresh(entry: CacheEntry): boolean {
    return Date.now() < entry.freshUntil;
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}
