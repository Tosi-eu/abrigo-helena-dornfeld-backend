import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { jwtConfig } from '../infrastructure/helpers/auth.helper';
import LoginModel from '../infrastructure/database/models/login.model';
import type { UserPermissions } from '../infrastructure/database/models/login.model';
import { JWTPayload } from '../infrastructure/types/jwt.types';
import { cacheService } from '../infrastructure/database/redis/client.redis';

const DEFAULT_PERMISSIONS: UserPermissions = {
  read: true,
  create: false,
  update: false,
  delete: false,
};

export interface AuthRequest extends Request {
  user?: {
    id: number;
    login: string;
    role?: 'admin' | 'user';
    permissions?: UserPermissions;
    tenantId?: number;
    isSuperAdmin?: boolean;
  };
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  let token: string | undefined;
  const authCacheTtlSeconds = Number(process.env.AUTH_CACHE_TTL_SECONDS) || 30;

  if (req.cookies && req.cookies.authToken) {
    token = req.cookies.authToken;
  } else {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const [, headerToken] = authHeader.split(' ');
      if (headerToken) {
        token = headerToken;
      }
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, jwtConfig.secret) as JWTPayload;

    type AuthCacheEntry = {
      role: 'admin' | 'user';
      permissions: UserPermissions;
      tenantId: number;
      isSuperAdmin: boolean;
    };

    const tokenFingerprint = crypto
      .createHash('sha1')
      .update(token)
      .digest('hex');

    const cacheKey = `auth:token:${tokenFingerprint}`;

    const cached = await cacheService.getOrSet<AuthCacheEntry | null>(
      cacheKey,
      async () => {
        const user = await LoginModel.findOne({
          where: { refresh_token: token },
          attributes: [
            'id',
            'login',
            'role',
            'permissions',
            'tenant_id',
            'is_super_admin',
          ],
        });

        if (!user) return null;

        const role = user.role as 'admin' | 'user';
        const permissions: UserPermissions =
          role === 'admin'
            ? { read: true, create: true, update: true, delete: true }
            : { ...DEFAULT_PERMISSIONS, ...(user.permissions ?? {}) };

        return {
          role,
          permissions,
          tenantId: Number(user.tenant_id) || 1,
          isSuperAdmin: Boolean(
            (user as unknown as { is_super_admin?: boolean }).is_super_admin,
          ),
        } as AuthCacheEntry;
      },
      authCacheTtlSeconds,
    );

    if (!cached) return res.status(401).json({ error: 'Sessão inválida' });

    req.user = {
      id: Number(decoded.sub),
      login: decoded.login,
      role: cached.role,
      permissions: cached.permissions,
      tenantId: cached.tenantId,
      isSuperAdmin: cached.isSuperAdmin,
    };

    next();
  } catch {
    return res.status(401).json({ error: 'Token expirado ou inválido' });
  }
}

export async function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  let token: string | undefined;
  const authCacheTtlSeconds = Number(process.env.AUTH_CACHE_TTL_SECONDS) || 30;

  if (req.cookies && req.cookies.authToken) {
    token = req.cookies.authToken;
  } else {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const [, headerToken] = authHeader.split(' ');
      if (headerToken) token = headerToken;
    }
  }

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, jwtConfig.secret) as JWTPayload;
    type AuthCacheEntry = {
      role: 'admin' | 'user';
      permissions: UserPermissions;
      tenantId: number;
      isSuperAdmin: boolean;
    };

    const tokenFingerprint = crypto
      .createHash('sha1')
      .update(token)
      .digest('hex');

    const cacheKey = `auth:token:${tokenFingerprint}`;

    const cached = await cacheService.getOrSet<AuthCacheEntry | null>(
      cacheKey,
      async () => {
        const user = await LoginModel.findOne({
          where: { refresh_token: token },
          attributes: [
            'id',
            'login',
            'role',
            'permissions',
            'tenant_id',
            'is_super_admin',
          ],
        });

        if (!user) return null;

        const role = user.role as 'admin' | 'user';
        const permissions: UserPermissions =
          role === 'admin'
            ? { read: true, create: true, update: true, delete: true }
            : { ...DEFAULT_PERMISSIONS, ...(user.permissions ?? {}) };

        return {
          role,
          permissions,
          tenantId: Number(user.tenant_id) || 1,
          isSuperAdmin: Boolean(
            (user as unknown as { is_super_admin?: boolean }).is_super_admin,
          ),
        } as AuthCacheEntry;
      },
      authCacheTtlSeconds,
    );

    if (!cached) return next();

    req.user = {
      id: Number(decoded.sub),
      login: decoded.login,
      role: cached.role,
      permissions: cached.permissions,
      tenantId: cached.tenantId,
      isSuperAdmin: cached.isSuperAdmin,
    };
  } catch {
    // ignore invalid token; proceed without req.user
  }
  next();
}
