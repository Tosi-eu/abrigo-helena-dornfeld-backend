import type { Response, NextFunction } from 'express';
import crypto from 'crypto';
import type { AuthRequest } from './auth.middleware';
import { authMiddleware } from './auth.middleware';
import { enforceTenantMiddleware } from './tenant.middleware';
import { tenantRequestContextLogMiddleware } from './tenant-request-log.middleware';
import { enforceResourcePermissions } from './resource-permission.middleware';
import { rlsContextMiddleware } from './rls.middleware';
import { bindRequestToRlsTransaction } from './request-rls-transaction.middleware';
import { auditLog } from './audit.middleware';
import { requireAdmin } from './admin.middleware';

const HEADER_NAMES = ['x-api-key', 'X-API-Key'];

function readApiKeyFromRequest(req: AuthRequest): string {
  for (const name of HEADER_NAMES) {
    const v = req.header(name);
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function safeEqualApiKey(provided: string, expected: string): boolean {
  const p = Buffer.from(provided, 'utf8');
  const e = Buffer.from(expected, 'utf8');
  if (p.length !== e.length) return false;
  return crypto.timingSafeEqual(p, e);
}

function getClientIp(req: AuthRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function isIpAllowed(req: AuthRequest): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  const raw = String(process.env.SUPERADMIN_APIKEY_IP_ALLOWLIST ?? '').trim();
  if (!raw) return true;
  const allowed = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  const ip = getClientIp(req);
  return allowed.includes(ip);
}

function isLocalDevOrigin(origin: string): boolean {
  const o = origin.trim().toLowerCase();
  return (
    o.startsWith('http://localhost:') ||
    o.startsWith('http://127.0.0.1:') ||
    o === 'http://localhost' ||
    o === 'http://127.0.0.1'
  );
}

type Done = (err?: unknown) => void;

export function adminConfigAccessMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const expected = process.env.X_API_KEY?.trim();
  if (expected) {
    const origin =
      typeof req.headers.origin === 'string' ? req.headers.origin : '';
    if (origin && process.env.NODE_ENV === 'production') {
      res.status(403).json({
        error: 'API key não é permitida via browser (Origin presente).',
      });
      return;
    }
    if (
      origin &&
      process.env.NODE_ENV !== 'production' &&
      !isLocalDevOrigin(origin)
    ) {
      res.status(403).json({
        error: 'API key não é permitida via browser (Origin não-local).',
      });
      return;
    }

    const provided = readApiKeyFromRequest(req);
    if (provided && safeEqualApiKey(provided, expected)) {
      if (!isIpAllowed(req)) {
        res.status(403).json({
          error: 'API key rejeitada: IP não autorizado.',
        });
        return;
      }
      (
        req as AuthRequest & { adminConfigViaApiKey?: boolean }
      ).adminConfigViaApiKey = true;
      next();
      return;
    }
  }

  const chain: Array<
    (req: AuthRequest, res: Response, next: Done) => void | Promise<void>
  > = [
    authMiddleware,
    enforceTenantMiddleware,
    tenantRequestContextLogMiddleware,
    enforceResourcePermissions,
    rlsContextMiddleware,
    bindRequestToRlsTransaction,
    auditLog,
    requireAdmin,
  ];

  let i = 0;
  const run = (err?: unknown): void => {
    if (err !== undefined && err !== null) {
      next(err as Error);
      return;
    }
    if (i >= chain.length) {
      next();
      return;
    }
    const mw = chain[i++];
    try {
      void Promise.resolve(mw(req, res, run)).catch(run);
    } catch (e) {
      run(e);
    }
  };
  run();
}
