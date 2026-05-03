import type { CanonicalErrorPayload } from '@stokio/sdk';
import {
  fingerprintError,
  toCanonicalError,
  type ToCanonicalDefaults,
} from '@stokio/sdk';
import { logger } from '@helpers/logger.helper';
import { sanitizeErrorMessageForStore } from '@helpers/error-sanitize.helper';
import {
  PrismaErrorEventRepository,
  type ErrorEventListFilters,
} from '@repositories/error-event.repository';
import type { ErrorEvent } from '@prisma/client';

const MAX_STACK = 16_000;
const MAX_CONTEXT_JSON = 16_000;

function truncateText(
  s: string | null | undefined,
  max: number,
): string | null {
  if (s == null) return null;
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function truncateContext(
  ctx: Record<string, unknown> | null | undefined,
): object | undefined {
  if (!ctx || typeof ctx !== 'object') return undefined;
  try {
    const json = JSON.stringify(ctx);
    const t = truncateText(json, MAX_CONTEXT_JSON);
    if (!t) return undefined;
    return JSON.parse(t) as object;
  } catch {
    return { _truncated: true };
  }
}

export class ErrorEventService {
  constructor(private readonly repo = new PrismaErrorEventRepository()) {}

  async recordCanonical(payload: CanonicalErrorPayload): Promise<void> {
    try {
      const sanitized = sanitizeErrorMessageForStore(payload.messageRaw);
      const fp =
        payload.fingerprint ||
        fingerprintError({
          source: payload.source,
          code: payload.code,
          messageRaw: payload.messageRaw,
          stack: payload.stack,
        });

      await this.repo.create({
        occurredAt: new Date(payload.occurredAt),
        source: payload.source,
        severity: payload.severity,
        category: payload.category,
        code: payload.code,
        messageRaw: truncateText(payload.messageRaw, 32_000) ?? '',
        messageSanitized: payload.messageSanitized ?? sanitized,
        fingerprint: fp.slice(0, 40),
        contextJson: truncateContext(
          payload.context as Record<string, unknown> | null,
        ),
        stack: truncateText(payload.stack ?? null, MAX_STACK),
        correlationId: payload.correlationId ?? null,
        tenantId: payload.tenantId ?? null,
        httpMethod: payload.httpMethod ?? null,
        httpPath: payload.httpPath?.slice(0, 500) ?? null,
        httpStatus: payload.httpStatus ?? null,
        workflowId: payload.workflowId ?? null,
        workflowRunId: payload.workflowRunId ?? null,
        originApp: payload.originApp?.slice(0, 40) ?? null,
      });
    } catch (err) {
      logger.warn('[error-event] Falha ao persistir evento', {
        operation: 'error_event_record',
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async recordFromUnknown(
    err: unknown,
    defaults: ToCanonicalDefaults,
  ): Promise<void> {
    const payload = toCanonicalError(err, defaults);
    payload.messageSanitized = sanitizeErrorMessageForStore(payload.messageRaw);
    await this.recordCanonical(payload);
  }

  async list(
    filters: ErrorEventListFilters,
    page: number,
    limit: number,
  ): Promise<{
    rows: ErrorEvent[];
    total: number;
    page: number;
    limit: number;
  }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const { rows, total } = await this.repo.findManyPaginated(
      filters,
      safePage,
      safeLimit,
    );
    return { rows, total, page: safePage, limit: safeLimit };
  }

  async getById(id: string): Promise<ErrorEvent | null> {
    return this.repo.findById(id);
  }

  async summary(): Promise<{
    last24h: number;
    last7d: number;
    last30d: number;
    topSources7d: { key: string; cnt: number }[];
    topCodes7d: { key: string; cnt: number }[];
    bySeverity7d: { severity: string; cnt: number }[];
  }> {
    const now = Date.now();
    const d24 = new Date(now - 24 * 60 * 60 * 1000);
    const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [last24h, last7d, last30d, topSources7d, topCodes7d, bySeverity7d] =
      await Promise.all([
        this.repo.countSince(d24),
        this.repo.countSince(d7),
        this.repo.countSince(d30),
        this.repo.topSourcesSince(d7, 5),
        this.repo.topCodesSince(d7, 5),
        this.repo.countBySeveritySince(d7),
      ]);

    return {
      last24h,
      last7d,
      last30d,
      topSources7d,
      topCodes7d,
      bySeverity7d,
    };
  }
}

let singleton: ErrorEventService | null = null;

export function getErrorEventService(): ErrorEventService {
  if (!singleton) singleton = new ErrorEventService();
  return singleton;
}
