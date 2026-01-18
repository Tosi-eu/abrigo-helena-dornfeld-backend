import Redis from 'ioredis';
import { RedisRepository } from '../repositories/redis.repository';
import { CacheService } from '../../../core/services/redis.service';
import { logger } from '../../helpers/logger.helper';

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
      retryStrategy: times => {
        if (process.env.NODE_ENV === 'development' && times > 3) {
          logger.warn('[Redis] Disabled after retries (dev mode)');
          redisAvailable = false;
          return null;
        }

        return Math.min(times * 100, 2000);
      },
    });

    client.on('connect', () => {
      redisAvailable = true;
      logger.info('[Redis] Connected');
    });

    client.on('error', err => {
      redisAvailable = false;

      if (process.env.NODE_ENV === 'development') {
        logger.warn('[Redis] Error – cache disabled', { error: err });
      } else {
        logger.error('[Redis] Error', { error: err });
      }
    });

    client.connect().catch(err => {
      redisAvailable = false;
      logger.error('[Redis] Failed to connect', { error: err });
    });

    return client;
  } catch (error) {
    redisAvailable = false;
    logger.error('[Redis] Failed to initialize', { error });
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
