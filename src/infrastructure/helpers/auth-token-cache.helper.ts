import * as crypto from 'crypto';
import type { Request } from 'express';
import { cacheService } from '../database/redis/client.redis';

function cookieAuthToken(req: Request): string | undefined {
  const c = req.cookies as { authToken?: string } | undefined;
  const raw = c?.authToken;
  return raw != null && String(raw).trim() !== '' ? String(raw) : undefined;
}

export async function invalidateAuthCacheForRequest(
  req: Request,
): Promise<void> {
  const token = cookieAuthToken(req);
  if (!token) return;
  const fingerprint = crypto.createHash('sha1').update(token).digest('hex');
  await cacheService.invalidate(`auth:token:${fingerprint}`);
}
