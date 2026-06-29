const FALLBACK_TTL_MS = 30 * 60 * 1000; // 30 min, used only when Canvas returns no ETag

export interface CacheEntry {
  value: any;
  etag?: string;
  lastModified?: string;
  expiresAt: number;
}

export class SimpleCache {
  private store = new Map<string, CacheEntry>();

  get(key: string): CacheEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    // TTL only applies when there are no conditional-GET validators
    if (!entry.etag && !entry.lastModified && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, value: any, etag?: string, lastModified?: string): void {
    this.store.set(key, { value, etag, lastModified, expiresAt: Date.now() + FALLBACK_TTL_MS });
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}
