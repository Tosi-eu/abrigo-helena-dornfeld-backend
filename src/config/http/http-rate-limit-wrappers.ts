import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { getRuntimeHttpConfig } from './runtime-http-config';

let globalLimiterImpl = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => req.method === 'OPTIONS',
  keyGenerator: req => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return ip;
  },
});

export const globalRateLimitMiddleware: RequestHandler = (req, res, next) => {
  return globalLimiterImpl(req, res, next);
};

export function rebuildGlobalRateLimiterFromConfig(): void {
  const rl = getRuntimeHttpConfig().rateLimits.global;
  globalLimiterImpl = rateLimit({
    windowMs: rl.windowMs,
    max: rl.max,
    message: {
      error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: req => req.method === 'OPTIONS',
    keyGenerator: req => {
      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      return ip;
    },
  });
}
