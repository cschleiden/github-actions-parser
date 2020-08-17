interface CacheEntry<T> {
  cachedAt: number;
  content: T;
}

export class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  constructor(private defaultTTLinMS: number = 10 * 60 * 1000) {}

  async get(
    key: string,
    ttlInMS: number | undefined,
    getter: () => Promise<T>
  ): Promise<T> {
    const e = this.cache.get(key);
    if (e && e.cachedAt > Date.now() - (ttlInMS || this.defaultTTLinMS)) {
      return e.content;
    }

    try {
      const content = await getter();

      this.cache.set(key, {
        cachedAt: Date.now(),
        content,
      });

      return content;
    } catch (e) {
      this.cache.delete(key);
      throw e;
    }
  }
}
