import { getRedisClient, isRedisAvailable } from '../redis/client.redis';

export class RedisRepository {
  private get client() {
    return getRedisClient();
  }

  async setIfNotExists(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    if (!isRedisAvailable()) return false;

    const client = this.client;
    if (!client) return false;

    try {
      const result = await client.set(
        key,
        value,
        'EX',
        ttlSeconds,
        'NX',
      );

      return result === 'OK';
    } catch {
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!isRedisAvailable()) return null;

    const client = this.client;
    if (!client) return null;

    try {
      const value = await client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<void> {
    if (!isRedisAvailable()) return;

    const client = this.client;
    if (!client) return;

    try {
      const payload = JSON.stringify(value);

      if (ttlSeconds) {
        await client.set(key, payload, 'EX', ttlSeconds);
      } else {
        await client.set(key, payload);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'development') {
        console.error('Redis set error:', error);
      }
    }
  }

  async del(key: string): Promise<void> {
    if (!isRedisAvailable()) return;

    const client = this.client;
    if (!client) return;

    try {
      await client.del(key);
    } catch (error) {
      if (process.env.NODE_ENV !== 'development') {
        console.error('Redis del error:', error);
      }
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!isRedisAvailable()) return;

    const client = this.client;
    if (!client) return;

    let cursor = '0';

    try {
      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );

        cursor = nextCursor;

        if (keys.length > 0) {
          await client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      if (process.env.NODE_ENV !== 'development') {
        console.error('Redis delByPattern error:', error);
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!isRedisAvailable()) return false;

    const client = this.client;
    if (!client) return false;

    try {
      return (await client.exists(key)) === 1;
    } catch {
      return false;
    }
  }
}