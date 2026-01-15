import { redisClient, isRedisAvailable } from '../redis/client.redis';

export class RedisRepository {
  private async checkRedis(): Promise<boolean> {
    try {
      return await isRedisAvailable();
    } catch {
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!(await this.checkRedis())) {
      return null;
    }
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!(await this.checkRedis())) {
      return;
    }
    try {
      const payload = JSON.stringify(value);
      if (ttlSeconds) {
        await redisClient.set(key, payload, 'EX', ttlSeconds);
      } else {
        await redisClient.set(key, payload);
      }
    } catch (error) {
      // Silently fail in development if Redis is not available
      if (process.env.NODE_ENV !== 'development') {
        console.error('Redis set error:', error);
      }
    }
  }

  async del(key: string): Promise<void> {
    if (!(await this.checkRedis())) {
      return;
    }
    try {
      await redisClient.del(key);
    } catch (error) {
      if (process.env.NODE_ENV !== 'development') {
        console.error('Redis del error:', error);
      }
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!(await this.checkRedis())) {
      return;
    }
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length) {
        await redisClient.del(keys);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'development') {
        console.error('Redis delByPattern error:', error);
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!(await this.checkRedis())) {
      return false;
    }
    try {
      return (await redisClient.exists(key)) === 1;
    } catch {
      return false;
    }
  }
}
