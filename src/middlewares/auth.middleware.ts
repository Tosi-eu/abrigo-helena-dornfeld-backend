import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { jwtConfig } from '@config/jwt.config';
import { getRuntimeHttpConfig } from '@config/http/runtime-http-config';
import { getDb } from '@repositories/prisma';
import type { Prisma } from '@prisma/client';
import type { UserPermissions } from '@domain/user.types';
import type { EffectivePermissionMatrix } from '@domain/permission-matrix.types';
import { JWTPayload } from '@domain/jwt.types';
import { cacheService } from '@config/redis.client';
import {
  buildEffectivePermissionMatrix,
  summarizeFlatFromMatrix,
} from '@helpers/permission-matrix.resolver';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    login: string;
    role?: 'admin' | 'user';
    permissions?: UserPermissions;

    permissionMatrix?: EffectivePermissionMatrix;
    tenantId?: number;
    isTenantOwner?: boolean;
    isSuperAdmin?: boolean;
  };
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  let token: string | undefined;
  const ttl = getRuntimeHttpConfig().ttl;
  const authCacheTtlSeconds = ttl.authCacheSeconds;
  const allowCookieAuth = ttl.allowCookieAuth;

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
      permissionsRaw: Prisma.JsonValue | null;
      tenantId: number;
      isTenantOwner: boolean;
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
            is_tenant_owner: true,
            is_super_admin: true,
          },
        });

        if (!user) return null;

        const tidRaw = user.tenant_id;
        if (tidRaw == null) return null;
        const tenantId = Number(tidRaw);
        if (!Number.isInteger(tenantId) || tenantId < 1) return null;

        const role = user.role as 'admin' | 'user';

        return {
          role,
          permissionsRaw: user.permissions,
          tenantId,
          isTenantOwner: Boolean((user as any).is_tenant_owner),
          isSuperAdmin: Boolean(user.is_super_admin),
        } satisfies AuthCacheEntry;
      },
      authCacheTtlSeconds,
    );

    if (!cached) return res.status(401).json({ error: 'Sessão inválida' });

    const permissionMatrix = buildEffectivePermissionMatrix(
      cached.role,
      cached.permissionsRaw,
    );
    const permissions = summarizeFlatFromMatrix(permissionMatrix);

    req.user = {
      id: Number(decoded.sub),
      login: decoded.login,
      role: cached.role,
      permissions,
      permissionMatrix,
      tenantId: cached.tenantId,
      isTenantOwner: cached.isTenantOwner,
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
  const ttl = getRuntimeHttpConfig().ttl;
  const authCacheTtlSeconds = ttl.authCacheSeconds;
  const allowCookieAuth = ttl.allowCookieAuth;

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
      permissionsRaw: Prisma.JsonValue | null;
      tenantId: number;
      isTenantOwner: boolean;
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
            is_tenant_owner: true,
            is_super_admin: true,
          },
        });

        if (!user) return null;

        const tidRaw = user.tenant_id;
        if (tidRaw == null) return null;
        const tenantId = Number(tidRaw);
        if (!Number.isInteger(tenantId) || tenantId < 1) return null;

        const role = user.role as 'admin' | 'user';

        return {
          role,
          permissionsRaw: user.permissions,
          tenantId,
          isTenantOwner: Boolean((user as any).is_tenant_owner),
          isSuperAdmin: Boolean(user.is_super_admin),
        } satisfies AuthCacheEntry;
      },
      authCacheTtlSeconds,
    );

    if (!cached) return next();

    const permissionMatrix = buildEffectivePermissionMatrix(
      cached.role,
      cached.permissionsRaw,
    );
    const permissions = summarizeFlatFromMatrix(permissionMatrix);

    req.user = {
      id: Number(decoded.sub),
      login: decoded.login,
      role: cached.role,
      permissions,
      permissionMatrix,
      tenantId: cached.tenantId,
      isTenantOwner: cached.isTenantOwner,
      isSuperAdmin: cached.isSuperAdmin,
    };
  } catch {
    // no-op
  }
  next();
}
