interface CacheEntry<V> {
  value: V;
  expiresAt: number;
  lastAccessAt: number;
}

export class TtlCache<K, V> {
  private readonly maxEntries: number;
  private readonly store = new Map<K, CacheEntry<V>>();

  constructor(maxEntries: number) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error(`maxEntries must be >= 1, received ${maxEntries}`);
    }
    this.maxEntries = maxEntries;
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    const now = Date.now();
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return undefined;
    }

    entry.lastAccessAt = now;
    return entry.value;
  }

  set(key: K, value: V, ttlMs: number): void {
    const safeTtlMs = Math.max(1, ttlMs);
    const now = Date.now();

    this.store.set(key, {
      value,
      expiresAt: now + safeTtlMs,
      lastAccessAt: now
    });

    this.prune();
  }

  private prune(): void {
    this.sweepExpired();

    if (this.store.size <= this.maxEntries) {
      return;
    }

    const entries = [...this.store.entries()];
    entries.sort(([, a], [, b]) => a.lastAccessAt - b.lastAccessAt);

    for (const [key] of entries) {
      if (this.store.size <= this.maxEntries) {
        break;
      }
      this.store.delete(key);
    }
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }
}
