import * as crypto from 'crypto';
import type { Request } from 'express';
import { cacheService } from '@config/redis.client';

function cookieAuthToken(req: Request): string | undefined {
  const c = req.cookies as { authToken?: string } | undefined;
  const raw = c?.authToken;
  return raw != null && String(raw).trim() !== '' ? String(raw) : undefined;
}

function bearerAuthToken(req: Request): string | undefined {
  const h = req.headers.authorization;
  if (!h || typeof h !== 'string') return undefined;
  const [scheme, t] = h.split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !t?.trim()) return undefined;
  return t.trim();
}

export async function invalidateAuthCacheForRequest(
  req: Request,
): Promise<void> {
  const seen = new Set<string>();
  for (const token of [cookieAuthToken(req), bearerAuthToken(req)]) {
    if (!token || seen.has(token)) continue;
    seen.add(token);
    const fingerprint = crypto.createHash('sha1').update(token).digest('hex');
    await cacheService.invalidate(`auth:token:${fingerprint}`);
  }
}
