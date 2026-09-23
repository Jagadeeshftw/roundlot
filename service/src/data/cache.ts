// Small TTL cache with in-flight de-duplication: concurrent callers for the
// same key share one upstream request, which is what keeps us far inside the
// OKX per-IP limits and the X Layer RPC limits regardless of traffic.
export class TtlCache {
  private entries = new Map<string, { value: unknown; expires: number }>();
  private inflight = new Map<string, Promise<unknown>>();
  hits = 0;
  misses = 0;

  async get<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.entries.get(key);
    if (hit && hit.expires > now) {
      this.hits++;
      return hit.value as T;
    }
    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<T>;

    this.misses++;
    const p = load()
      .then((value) => {
        this.entries.set(key, { value, expires: Date.now() + ttlMs });
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  stats() {
    return { entries: this.entries.size, hits: this.hits, misses: this.misses };
  }
}

export const cache = new TtlCache();
