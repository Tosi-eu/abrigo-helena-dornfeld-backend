import crypto from 'crypto';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';

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

/**
 * Gestão de tenants no painel (browser): cookie JWT + `is_super_admin` no DB.
 * Automação / scripts: header `X-API-Key` igual a `X_API_KEY` (sem expor no frontend).
 * Requer `optionalAuthMiddleware` antes desta função nas rotas públicas (antes do auth global).
 */
export function requireSuperAdminOrApiKey(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const expected = process.env.X_API_KEY?.trim();

  if (expected) {
    const provided = readApiKeyFromRequest(req);
    if (provided && safeEqualApiKey(provided, expected)) {
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
