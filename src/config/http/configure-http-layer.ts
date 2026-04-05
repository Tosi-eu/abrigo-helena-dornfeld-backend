import type { Application } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import express from 'express';
import { Prisma } from '@prisma/client';
import { sanitizeInput } from '@middlewares/sanitize.middleware';
import { prisma } from '@repositories/prisma';
import { getRedisClient } from '@config/redis.client';

let lastHealthCheckAt = 0;
let lastHealthHttpStatus = 503;
let lastHealthBody: Record<string, unknown> | null = null;
const healthCacheTtlMs = Number(process.env.HEALTHCHECK_CACHE_TTL_MS) || 10_000;

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

  if (!process.env.ALLOWED_ORIGINS) {
    throw new Error(
      'ALLOWED_ORIGINS environment variable is required. Please set it in your .env file.',
    );
  }

  const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin =>
    origin.trim(),
  );

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    res.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    );
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    );

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });

  app.get('/api/v1/health', async (_req, res) => {
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

  const limiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 1000,
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: req => req.method === 'OPTIONS',
    keyGenerator: req => {
      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      return ip;
    },
  });

  app.use(limiter);
}
