import Redis from 'ioredis';
import { RedisRepository } from '../repositories/redis.repository';
import { CacheService } from '../../../core/services/redis.service';

export const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
});

export const redisRepository = new RedisRepository();
export const cacheService = new CacheService(redisRepository);
