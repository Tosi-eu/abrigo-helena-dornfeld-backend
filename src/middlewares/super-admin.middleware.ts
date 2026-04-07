import crypto from 'crypto';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';

const HEADER_NAMES = ['x-api-key', 'X-API-Key'];

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
  if (!raw) return false;
  const allowed = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  const ip = getClientIp(req);
  return allowed.includes(ip);
}

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

export function requireSuperAdminOrApiKey(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const expected = process.env.X_API_KEY?.trim();

  if (expected) {
    if (req.headers.origin) {
      return res.status(403).json({
        error: 'API key não é permitida via browser (Origin presente).',
      });
    }

    const provided = readApiKeyFromRequest(req);
    if (provided && safeEqualApiKey(provided, expected)) {
      if (!isIpAllowed(req)) {
        return res.status(403).json({
          error: 'API key rejeitada: IP não autorizado.',
        });
      }
      return next();
    }
  }

  if (req.user?.isSuperAdmin) {
    return next();
  }

  if (req.user) {
    return res.status(403).json({
      error: 'Acesso negado. Apenas super-admin pode gerenciar tenants.',
    });
  }

  if (!expected) {
    return res.status(503).json({
      error:
        'Servidor não configurado: defina X_API_KEY no ambiente para gestão de tenants via API, ou faça login como super-admin.',
    });
  }

  return res.status(401).json({
    error: 'API key inválida ou ausente (header X-API-Key).',
  });
}

export function requireSuperAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({
      error: 'Acesso negado. Apenas super-admin pode gerenciar tenants.',
    });
  }
  next();
}
