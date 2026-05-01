import { getRedisClient, isRedisAvailable } from '@config/redis.client';
import { logger } from '@helpers/logger.helper';

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

const RUN_TTL_SEC = 7200;
const LAST_TTL_SEC = 86400;

const keyRun = (tenantId: number) => `price-backfill:manual:run:${tenantId}`;
const keyCool = (tenantId: number) => `price-backfill:manual:cool:${tenantId}`;
const keyLast = (tenantId: number) => `price-backfill:manual:last:${tenantId}`;

export type ManualPriceBackfillAcquire =
  | { ok: true }
  | { ok: false; blocked: 'cooldown'; retryAfterSeconds: number }
  | { ok: false; blocked: 'running' };

export type ManualPriceBackfillLast = {
  finishedAtMs: number;
  processed: number;
  ok: boolean;
  error?: string;
};

export type ManualPriceBackfillStatus = {
  running: boolean;
  cooldownSeconds: number | null;
  last: ManualPriceBackfillLast | null;
};

const memRunning = new Set<number>();
const memCooldownUntil = new Map<number, number>();
const memLastByTenant = new Map<number, ManualPriceBackfillLast>();

function acquireMemory(tenantId: number): ManualPriceBackfillAcquire {
  const now = Date.now();
  const coolUntil = memCooldownUntil.get(tenantId);
  if (coolUntil != null && coolUntil > now) {
    return {
      ok: false,
      blocked: 'cooldown',
      retryAfterSeconds: Math.max(1, Math.ceil((coolUntil - now) / 1000)),
    };
  }
  if (memRunning.has(tenantId)) {
    return { ok: false, blocked: 'running' };
  }
  memRunning.add(tenantId);
  return { ok: true };
}

async function acquireRedis(
  tenantId: number,
): Promise<ManualPriceBackfillAcquire> {
  const redis = getRedisClient();
  if (!redis || !isRedisAvailable()) {
    return acquireMemory(tenantId);
  }
  try {
    const coolMs = await redis.pttl(keyCool(tenantId));
    if (coolMs > 0) {
      return {
        ok: false,
        blocked: 'cooldown',
        retryAfterSeconds: Math.max(1, Math.ceil(coolMs / 1000)),
      };
    }
    const set = await redis.set(keyRun(tenantId), '1', 'EX', RUN_TTL_SEC, 'NX');
    if (set !== 'OK') {
      return { ok: false, blocked: 'running' };
    }
    return { ok: true };
  } catch (err) {
    logger.warn(
      '[price-backfill-manual] Redis acquire falhou, usando memória',
      {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      },
    );
    return acquireMemory(tenantId);
  }
}

export async function acquireManualPriceBackfillSlot(
  tenantId: number,
): Promise<ManualPriceBackfillAcquire> {
  return acquireRedis(tenantId);
}

export async function finishManualPriceBackfill(
  tenantId: number,
  result: { processed: number; error?: string },
): Promise<void> {
  const ok = !result.error;
  /** Padrão 10 min; defina `PRICE_BACKFILL_MANUAL_COOLDOWN_SEC` (ex.: 900 = 15 min). */
  const coolSuccessSec = envInt('PRICE_BACKFILL_MANUAL_COOLDOWN_SEC', 600);
  const coolErrorSec = envInt(
    'PRICE_BACKFILL_MANUAL_COOLDOWN_ON_ERROR_SEC',
    120,
  );
  const cooldownSec = ok ? coolSuccessSec : coolErrorSec;

  const payload: ManualPriceBackfillLast = {
    finishedAtMs: Date.now(),
    processed: result.processed,
    ok,
    error: result.error,
  };

  const redis = getRedisClient();
  if (redis && isRedisAvailable()) {
    try {
      await redis.del(keyRun(tenantId));
      await redis.set(keyCool(tenantId), '1', 'EX', cooldownSec);
      await redis.set(
        keyLast(tenantId),
        JSON.stringify(payload),
        'EX',
        LAST_TTL_SEC,
      );
      return;
    } catch (err) {
      logger.warn(
        '[price-backfill-manual] Redis finish falhou, usando memória',
        {
          tenantId,
          error: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }

  memRunning.delete(tenantId);
  memCooldownUntil.set(tenantId, Date.now() + cooldownSec * 1000);
  memLastByTenant.set(tenantId, payload);
}

/**
 * Remove apenas o lock de “run” (sem cooldown nem last).
 * Usado quando o Temporal já não tem workflow ativo mas o Redis ficou preso
 * (ex.: cancelamento manual do workflow antes da atividade libertar o slot).
 */
export async function forceReleaseManualPriceBackfillRunLock(
  tenantId: number,
): Promise<void> {
  const redis = getRedisClient();
  if (redis && isRedisAvailable()) {
    try {
      await redis.del(keyRun(tenantId));
      return;
    } catch (err) {
      logger.warn(
        '[price-backfill-manual] Redis force release falhou, usando memória',
        {
          tenantId,
          error: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }
  memRunning.delete(tenantId);
}

export async function getManualPriceBackfillStatus(
  tenantId: number,
): Promise<ManualPriceBackfillStatus> {
  const redis = getRedisClient();
  if (redis && isRedisAvailable()) {
    try {
      const [runExists, coolMs, rawLast] = await Promise.all([
        redis.exists(keyRun(tenantId)),
        redis.pttl(keyCool(tenantId)),
        redis.get(keyLast(tenantId)),
      ]);
      let last: ManualPriceBackfillLast | null = null;
      if (rawLast) {
        try {
          last = JSON.parse(rawLast) as ManualPriceBackfillLast;
        } catch {
          last = null;
        }
      }
      return {
        running: runExists === 1,
        cooldownSeconds:
          coolMs > 0 ? Math.max(1, Math.ceil(coolMs / 1000)) : null,
        last,
      };
    } catch (err) {
      logger.warn(
        '[price-backfill-manual] Redis status falhou, usando memória',
        {
          tenantId,
          error: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }

  const now = Date.now();
  const cu = memCooldownUntil.get(tenantId);
  const cooldownSeconds =
    cu != null && cu > now ? Math.max(1, Math.ceil((cu - now) / 1000)) : null;
  const last = memLastByTenant.get(tenantId) ?? null;
  return {
    running: memRunning.has(tenantId),
    cooldownSeconds,
    last,
  };
}
