import type { Application } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import express from 'express';
import { Prisma } from '@prisma/client';
import { sanitizeInput } from '@middlewares/sanitize.middleware';
import { prisma } from '@repositories/prisma';
import { getRedisClient } from '@config/redis.client';
import { getRuntimeHttpConfig } from './runtime-http-config';
import { globalRateLimitMiddleware } from './http-rate-limit-wrappers';

let lastHealthCheckAt = 0;
let lastHealthHttpStatus = 503;
let lastHealthBody: Record<string, unknown> | null = null;

function isSwaggerUiPath(path: string): boolean {
  return path.startsWith('/api/v1/docs');
}

export function configureHttpLayer(app: Application): void {
  app.set('trust proxy', 1);

  const helmetMiddleware = helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  app.use((req, res, next) => {
    if (isSwaggerUiPath(req.path)) {
      return next();
    }
    return helmetMiddleware(req, res, next);
  });

  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(sanitizeInput);

  app.use((req, res, next) => {
    const allowedOrigins = getRuntimeHttpConfig().cors.allowedOrigins;
    const origin = req.headers.origin;
    const isAllowedOrigin = Boolean(origin && allowedOrigins.includes(origin));

    if (isAllowedOrigin && origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    res.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    );
    const baseAllow =
      'Origin, X-Requested-With, Content-Type, Accept, Authorization';
    res.header(
      'Access-Control-Allow-Headers',
      isAllowedOrigin ? `${baseAllow}, X-API-Key` : baseAllow,
    );

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });

  app.get('/api/v1/health', async (_req, res) => {
    const healthCacheTtlMs = getRuntimeHttpConfig().ttl.healthcheckMs;
    const now = Date.now();
    if (lastHealthBody && now - lastHealthCheckAt < healthCacheTtlMs) {
      return res.status(lastHealthHttpStatus).json(lastHealthBody);
    }

    try {
      await prisma.$queryRaw(Prisma.sql`SELECT 1`);
      const redis = getRedisClient();
      const redisOk = redis ? (await redis.ping()) === 'PONG' : false;
      lastHealthHttpStatus = 200;
      lastHealthBody = {
        status: 'ok',
        database: 'connected',
        redis: redisOk ? 'connected' : 'unavailable',
      };
      lastHealthCheckAt = now;
      res.status(200).json(lastHealthBody);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      lastHealthHttpStatus = 503;
      lastHealthBody = {
        status: 'unhealthy',
        database: 'error',
        error: message,
      };
      lastHealthCheckAt = now;
      res.status(503).json(lastHealthBody);
    }
  });

  app.use(globalRateLimitMiddleware);
}
