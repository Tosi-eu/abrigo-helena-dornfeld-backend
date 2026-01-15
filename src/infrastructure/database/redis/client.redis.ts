import Redis from 'ioredis';
import { RedisRepository } from '../repositories/redis.repository';
import { CacheService } from '../../../core/services/redis.service';

const createRedisClient = () => {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = Number(process.env.REDIS_PORT) || 6379;

  const client = new Redis({
    host,
    port,
    retryStrategy: (times) => {
      if (process.env.NODE_ENV === 'development' && times > 3) {
        console.warn('Redis connection failed. Running without cache.');
        return null; 
      }
      return Math.min(times * 50, 2000);
    },
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
  });

  client.on('error', (err) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Redis connection error (cache will be disabled):', err.message);
    } else {
      console.error('Redis connection error:', err);
    }
  });

  client.on('connect', () => {
    console.log('Redis connected successfully');
  });

  return client;
};

export const redisClient = createRedisClient();

export const isRedisAvailable = async (): Promise<boolean> => {
  try {
    await redisClient.ping();
    return true;
  } catch {
    return false;
  }
};

export const redisRepository = new RedisRepository();
export const cacheService = new CacheService(redisRepository);
