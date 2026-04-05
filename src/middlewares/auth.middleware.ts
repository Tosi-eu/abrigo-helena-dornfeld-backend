import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { jwtConfig } from '@config/jwt.config';
import { getDb } from '@repositories/prisma';
import type { UserPermissions } from '@domain/user.types';
import { JWTPayload } from '@domain/jwt.types';
import { cacheService } from '@config/redis.client';

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
  const allowCookieAuth = process.env.ALLOW_COOKIE_AUTH === 'true';

  const authHeader = req.headers.authorization;
  if (authHeader) {
    const [scheme, headerToken] = authHeader.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && headerToken) {
      token = headerToken;
    }
  }

  if (!token && allowCookieAuth && req.cookies?.authToken) {
    token = req.cookies.authToken;
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
        const user = await getDb().login.findFirst({
          where: { refreshToken: token },
          select: {
            id: true,
            login: true,
            role: true,
            permissions: true,
            tenant_id: true,
            is_super_admin: true,
          },
        });

        if (!user) return null;

        const tidRaw = user.tenant_id;
        if (tidRaw == null) return null;
        const tenantId = Number(tidRaw);
        if (!Number.isInteger(tenantId) || tenantId < 1) return null;

        const role = user.role as 'admin' | 'user';
        const permJson = user.permissions;
        const parsedPerm =
          permJson &&
          typeof permJson === 'object' &&
          !Array.isArray(permJson)
            ? (permJson as Record<string, unknown>)
            : null;
        const permissions: UserPermissions =
          role === 'admin'
            ? { read: true, create: true, update: true, delete: true }
            : {
                ...DEFAULT_PERMISSIONS,
                ...(parsedPerm as Partial<UserPermissions>),
              };

        return {
          role,
          permissions,
          tenantId,
          isSuperAdmin: Boolean(user.is_super_admin),
        } satisfies AuthCacheEntry;
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
  const allowCookieAuth = process.env.ALLOW_COOKIE_AUTH === 'true';

  const authHeader = req.headers.authorization;
  if (authHeader) {
    const [scheme, headerToken] = authHeader.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && headerToken) {
      token = headerToken;
    }
  }

  if (!token && allowCookieAuth && req.cookies?.authToken) {
    token = req.cookies.authToken;
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
        const user = await getDb().login.findFirst({
          where: { refreshToken: token },
          select: {
            id: true,
            login: true,
            role: true,
            permissions: true,
            tenant_id: true,
            is_super_admin: true,
          },
        });

        if (!user) return null;

        const tidRaw = user.tenant_id;
        if (tidRaw == null) return null;
        const tenantId = Number(tidRaw);
        if (!Number.isInteger(tenantId) || tenantId < 1) return null;

        const role = user.role as 'admin' | 'user';
        const permJson = user.permissions;
        const parsedPerm =
          permJson &&
          typeof permJson === 'object' &&
          !Array.isArray(permJson)
            ? (permJson as Record<string, unknown>)
            : null;
        const permissions: UserPermissions =
          role === 'admin'
            ? { read: true, create: true, update: true, delete: true }
            : {
                ...DEFAULT_PERMISSIONS,
                ...(parsedPerm as Partial<UserPermissions>),
              };

        return {
          role,
          permissions,
          tenantId,
          isSuperAdmin: Boolean(user.is_super_admin),
        } satisfies AuthCacheEntry;
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
