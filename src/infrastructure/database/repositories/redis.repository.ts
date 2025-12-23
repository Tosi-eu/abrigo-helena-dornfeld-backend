import { redisClient } from '../redis/client.redis';

export class RedisRepository {
  async get<T>(key: string): Promise<T | null> {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const payload = JSON.stringify(value);

    if (ttlSeconds) {
      await redisClient.set(key, payload, 'EX', ttlSeconds);
    } else {
      await redisClient.set(key, payload);
    }
  }

  async del(key: string): Promise<void> {
    await redisClient.del(key);
  }

  async delByPattern(pattern: string): Promise<void> {
    const keys = await redisClient.keys(pattern);
    if (keys.length) {
      await redisClient.del(keys);
    }
  }

  async exists(key: string): Promise<boolean> {
    return (await redisClient.exists(key)) === 1;
  }
}
