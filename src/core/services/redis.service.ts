import { RedisRepository } from '../../infrastructure/database/repositories/redis.repository';

export class CacheService {
  constructor(private readonly redis: RedisRepository) {}

  async getOrSet<T>(
    key: string,
    resolver: () => Promise<T>,
    ttlSeconds = 60,
  ): Promise<T> {
    const cached = await this.redis.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const lockKey = `lock:${key}`;
    const lockAcquired = await this.redis.setIfNotExists(
      lockKey,
      '1',
      5,
    );

    if (!lockAcquired) {
      await new Promise(resolve => setTimeout(resolve, 50));

      const retry = await this.redis.get<T>(key);
      if (retry !== null) {
        return retry;
      }
    }

    const value = await resolver();

    if (value !== null && value !== undefined) {
      await this.redis.set(key, value, ttlSeconds);
    }

    return value;
  }

  async invalidate(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async invalidateByPattern(pattern: string): Promise<void> {
    await this.redis.delByPattern(pattern);
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<void> {
    await this.redis.set(key, value, ttlSeconds);
  }

  async get<T>(key: string): Promise<T | null> {
    return this.redis.get<T>(key);
  }
}