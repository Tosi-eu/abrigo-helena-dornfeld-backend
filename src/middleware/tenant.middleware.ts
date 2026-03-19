import type { Request, Response, NextFunction } from 'express';
import { TenantRepository } from '../infrastructure/database/repositories/tenant.repository';
import type { AuthRequest } from './auth.middleware';

export interface TenantRequest extends Request {
  tenant?: {
    id: number;
    slug: string;
    name: string;
  };
  requestedTenantSlug?: string | null;
}

const repo = new TenantRepository();

function parseSubdomain(hostname: string): string | null {
  const host = hostname.split(':')[0]?.trim();
  if (!host) return null;
  const parts = host.split('.').filter(Boolean);
  if (parts.length < 3) return null; // e.g. tenant.example.com
  return parts[0] ?? null;
}

export async function tenantMiddleware(
  req: TenantRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    const headerSlugRaw = req.header('X-Tenant') ?? req.header('x-tenant');
    const host = req.hostname || req.get('host') || '';
    const subdomainSlug = parseSubdomain(host);
    const slug =
      (headerSlugRaw && String(headerSlugRaw).trim()) || subdomainSlug || '';

    req.requestedTenantSlug = slug || null;
  } catch {
    // ignore; keep request without tenant
  }
  next();
}

/**
 * After auth: enforce tenant context. Non-super-admin users are pinned to their own tenant.
 * Super-admin may pick a tenant via X-Tenant/subdomain (requestedTenantSlug).
 */
export async function enforceTenantMiddleware(
  req: (AuthRequest & TenantRequest) | TenantRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    const authReq = req as AuthRequest & TenantRequest;
    const userTenantId = authReq.user?.tenantId;
    const isSuper = Boolean(authReq.user?.isSuperAdmin);

    if (!isSuper && userTenantId != null) {
      const t = await repo.findById(Number(userTenantId));
      if (t) authReq.tenant = { id: t.id, slug: t.slug, name: t.name };
      return next();
    }

    const requested = authReq.requestedTenantSlug;
    if (isSuper && requested) {
      const t = await repo.findBySlug(requested);
      if (t) {
        authReq.tenant = { id: t.id, slug: t.slug, name: t.name };
        return next();
      }
    }

    const fallback = await repo.findById(1);
    if (fallback) {
      authReq.tenant = {
        id: fallback.id,
        slug: fallback.slug,
        name: fallback.name,
      };
    }
  } catch {
    // ignore
  }
  next();
}

/**
 * For public routes (before auth), resolve a tenant based on requestedTenantSlug.
 * Falls back to tenant id=1.
 */
export async function publicTenantContextMiddleware(
  req: TenantRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    if (req.tenant) return next();
    const requested = req.requestedTenantSlug;
    if (requested) {
      const t = await repo.findBySlug(requested);
      if (t) {
        req.tenant = { id: t.id, slug: t.slug, name: t.name };
        return next();
      }
    }
    const fallback = await repo.findById(1);
    if (fallback) {
      req.tenant = { id: fallback.id, slug: fallback.slug, name: fallback.name };
    }
  } catch {
    // ignore
  }
  next();
}

