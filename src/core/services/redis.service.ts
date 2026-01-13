import { RedisRepository } from '../../infrastructure/database/repositories/redis.repository';

export class CacheService {
  constructor(private readonly redis: RedisRepository) {}

  async getOrSet<T>(
    key: string,
    resolver: () => Promise<T>,
    ttlSeconds = 60,
  ): Promise<T> {
    const cached = await this.redis.get<T>(key);
    if (cached) {
      return cached;
    }

    const value = await resolver();
    await this.redis.set(key, value, ttlSeconds);

    return value;
  }

  async invalidate(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async invalidateByPattern(pattern: string): Promise<void> {
    await this.redis.delByPattern(pattern);
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.redis.set(key, value, ttlSeconds);
  }

  async get<T>(key: string): Promise<T | null> {
    return this.redis.get<T>(key);
  }
}
