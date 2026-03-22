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
 * Credencial do **operador do sistema** (só quem tem o valor no `.env` do servidor).
 * Não depende de usuário JWT: quem conhece a chave é tratado como administrador da plataforma.
 * Rotas de gestão de tenants usam só este middleware + handler.
 */
export function requireSuperAdminApiKey(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const expected = process.env.X_API_KEY?.trim();
  if (!expected) {
    return res.status(503).json({
      error:
        'Servidor não configurado: defina X_API_KEY no ambiente para gestão de tenants.',
    });
  }
  const provided = readApiKeyFromRequest(req);
  if (!provided || !safeEqualApiKey(provided, expected)) {
    return res.status(401).json({
      error: 'API key inválida ou ausente (header X-API-Key).',
    });
  }
  next();
}

/** Usuário logado como super-admin no banco (além de JWT admin). */
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
