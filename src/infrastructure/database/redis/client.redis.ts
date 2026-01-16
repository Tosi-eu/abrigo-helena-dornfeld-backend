import Redis from 'ioredis';
import { RedisRepository } from '../repositories/redis.repository';
import { CacheService } from '../../../core/services/redis.service';

let redisAvailable = false;
let redisClient: Redis | null = null;

const createRedisClient = (): Redis | null => {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = Number(process.env.REDIS_PORT) || 6379;

  try {
    const client = new Redis({
      host,
      port,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (process.env.NODE_ENV === 'development' && times > 3) {
          console.warn('[Redis] Disabled after retries (dev mode)');
          redisAvailable = false;
          return null; 
        }

        return Math.min(times * 100, 2000);
      },
    });

    client.on('connect', () => {
      redisAvailable = true;
      console.log('[Redis] Connected');
    });

    client.on('error', (err) => {
      redisAvailable = false;

      if (process.env.NODE_ENV === 'development') {
        console.warn('[Redis] Error – cache disabled:', err.message);
      } else {
        console.error('[Redis] Error:', err);
      }
    });

    client.connect().catch(() => {
      redisAvailable = false;
    });

    return client;
  } catch (error) {
    console.error('[Redis] Failed to initialize:', error);
    return null;
  }
};

redisClient = createRedisClient();

export const getRedisClient = (): Redis | null => {
  return redisAvailable ? redisClient : null;
};

export const isRedisAvailable = (): boolean => {
  return redisAvailable;
};
export const redisRepository = new RedisRepository();
export const cacheService = new CacheService(redisRepository);