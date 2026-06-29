const TTL_MS = 5 * 60 * 1000; // 5 minutes

export class SimpleCache {
  private store = new Map<string, { value: any; expiresAt: number }>();

  get(key: string): any {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: any): void {
    this.store.set(key, { value, expiresAt: Date.now() + TTL_MS });
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}
