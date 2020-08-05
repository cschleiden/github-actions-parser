interface CacheEntry<T> {
  cachedAt: number;
  content: T;
}

export class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  constructor(private ttlInMS: number) {}

  async get(key: string, getter: () => Promise<T>): Promise<T> {
    const e = this.cache.get(key);
    if (e && e.cachedAt > Date.now() - this.ttlInMS) {
      return e.content;
    }

    const content = await getter();
    this.cache.set(key, {
      cachedAt: Date.now(),
      content,
    });

    return content;
  }
}
