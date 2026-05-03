import { z } from 'zod';

export const RUNTIME_CONFIG_PREFIX = 'runtime.';

const originSchema = z.string().min(1, 'origem vazia');

export const SystemConfigSchema = z.object({
  cors: z.object({
    allowedOrigins: z.array(originSchema).min(1, 'pelo menos uma origem CORS'),
  }),
  ttl: z.object({
    healthcheckMs: z.number().int().min(0),
    authCacheSeconds: z.number().int().min(0),
    r2LogoListMs: z.number().int().min(0),
    jwtExpiresIn: z.string().min(1),
    allowCookieAuth: z.boolean(),
  }),
  retries: z.object({
    pricingApi: z.object({
      max: z.number().int().min(0),
      baseMs: z.number().int().min(0),
      maxMs: z.number().int().min(0),
    }),
  }),
  concurrency: z.object({
    pricingApi: z.object({
      parallel: z.number().int().min(1),
      minIntervalMs: z.number().int().min(0),
    }),
    priceBackfill: z.object({
      batch: z.number().int().min(1),
      maxPerTenant: z.number().int().min(1),
      interRequestDelayMs: z.number().int().min(0),
    }),
  }),
  rateLimits: z.object({
    global: z.object({
      windowMs: z.number().int().min(1),
      max: z.number().int().min(1),
    }),
    publicTenant: z.object({
      windowMs: z.number().int().min(1),
      listMax: z.number().int().min(1),
      brandingMax: z.number().int().min(1),
    }),
  }),

  pricing: z.object({
    baseUrl: z.string(),
    apiKey: z.string(),
  }),

  scheduledPriceBackfill: z.object({
    enabled: z.boolean(),
    cronExpression: z.string().min(1, 'expressão cron vazia'),
    manualCooldownSuccessSec: z.number().int().min(1),
    manualCooldownErrorSec: z.number().int().min(1),
  }),

  logging: z.object({
    level: z.string().min(1),
    format: z.enum(['json', 'pretty']),
  }),

  tenantImport: z.object({
    pgDumpBirthDateFallback: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD'),
  }),
});

export type SystemConfigDto = z.infer<typeof SystemConfigSchema>;

export type SystemConfigPatch = Partial<{
  cors: Partial<SystemConfigDto['cors']>;
  ttl: Partial<SystemConfigDto['ttl']>;
  retries: Partial<{
    pricingApi: Partial<SystemConfigDto['retries']['pricingApi']>;
  }>;
  concurrency: Partial<{
    pricingApi: Partial<SystemConfigDto['concurrency']['pricingApi']>;
    priceBackfill: Partial<SystemConfigDto['concurrency']['priceBackfill']>;
  }>;
  rateLimits: Partial<{
    global: Partial<SystemConfigDto['rateLimits']['global']>;
    publicTenant: Partial<SystemConfigDto['rateLimits']['publicTenant']>;
  }>;
  pricing?: Partial<SystemConfigDto['pricing']>;
  scheduledPriceBackfill?: Partial<SystemConfigDto['scheduledPriceBackfill']>;
  logging?: Partial<SystemConfigDto['logging']>;
  tenantImport?: Partial<SystemConfigDto['tenantImport']>;
}>;

/** Legado (antes de runtime.tenant_import.*) — lido em decode para migração */
export const LEGACY_IMPORT_BIRTH_DATE_FALLBACK_KEY = 'import_birth_date_fallback';

export const RUNTIME_DB_KEYS = {
  corsAllowedOrigins: `${RUNTIME_CONFIG_PREFIX}cors.allowed_origins`,
  ttlHealthcheckMs: `${RUNTIME_CONFIG_PREFIX}ttl.healthcheck_ms`,
  ttlAuthCacheSeconds: `${RUNTIME_CONFIG_PREFIX}ttl.auth_cache_seconds`,
  ttlR2LogoListMs: `${RUNTIME_CONFIG_PREFIX}ttl.r2_logo_list_ms`,
  ttlJwtExpiresIn: `${RUNTIME_CONFIG_PREFIX}ttl.jwt_expires_in`,
  ttlAllowCookieAuth: `${RUNTIME_CONFIG_PREFIX}ttl.allow_cookie_auth`,
  retriesPricingMax: `${RUNTIME_CONFIG_PREFIX}retries.pricing_api.max`,
  retriesPricingBaseMs: `${RUNTIME_CONFIG_PREFIX}retries.pricing_api.base_ms`,
  retriesPricingMaxMs: `${RUNTIME_CONFIG_PREFIX}retries.pricing_api.max_ms`,
  concPricingParallel: `${RUNTIME_CONFIG_PREFIX}concurrency.pricing_api.parallel`,
  concPricingMinIntervalMs: `${RUNTIME_CONFIG_PREFIX}concurrency.pricing_api.min_interval_ms`,
  concBackfillBatch: `${RUNTIME_CONFIG_PREFIX}concurrency.price_backfill.batch`,
  concBackfillMaxPerTenant: `${RUNTIME_CONFIG_PREFIX}concurrency.price_backfill.max_per_tenant`,
  concBackfillInterDelayMs: `${RUNTIME_CONFIG_PREFIX}concurrency.price_backfill.inter_request_delay_ms`,
  rlGlobalWindowMs: `${RUNTIME_CONFIG_PREFIX}rate_limits.global.window_ms`,
  rlGlobalMax: `${RUNTIME_CONFIG_PREFIX}rate_limits.global.max`,
  rlPublicWindowMs: `${RUNTIME_CONFIG_PREFIX}rate_limits.public_tenant.window_ms`,
  rlPublicListMax: `${RUNTIME_CONFIG_PREFIX}rate_limits.public_tenant.list_max`,
  rlPublicBrandingMax: `${RUNTIME_CONFIG_PREFIX}rate_limits.public_tenant.branding_max`,
  pricingBaseUrl: `${RUNTIME_CONFIG_PREFIX}pricing.base_url`,
  pricingApiKey: `${RUNTIME_CONFIG_PREFIX}pricing.api_key`,
  scheduledPriceBackfillEnabled: `${RUNTIME_CONFIG_PREFIX}scheduled_price_backfill.enabled`,
  scheduledPriceBackfillCronExpression: `${RUNTIME_CONFIG_PREFIX}scheduled_price_backfill.cron_expression`,
  scheduledPriceBackfillManualCooldownSuccessSec: `${RUNTIME_CONFIG_PREFIX}scheduled_price_backfill.manual_cooldown_success_sec`,
  scheduledPriceBackfillManualCooldownErrorSec: `${RUNTIME_CONFIG_PREFIX}scheduled_price_backfill.manual_cooldown_error_sec`,
  loggingLevel: `${RUNTIME_CONFIG_PREFIX}logging.level`,
  loggingFormat: `${RUNTIME_CONFIG_PREFIX}logging.format`,
  tenantImportPgDumpBirthDateFallback: `${RUNTIME_CONFIG_PREFIX}tenant_import.pg_dump_birth_date_fallback`,
} as const;

export function isRuntimeConfigKey(key: string): boolean {
  return key.startsWith(RUNTIME_CONFIG_PREFIX);
}

export function encodeSystemConfigToDb(
  dto: SystemConfigDto,
): Record<string, string> {
  const k = RUNTIME_DB_KEYS;
  return {
    [k.corsAllowedOrigins]: JSON.stringify(dto.cors.allowedOrigins),
    [k.ttlHealthcheckMs]: String(dto.ttl.healthcheckMs),
    [k.ttlAuthCacheSeconds]: String(dto.ttl.authCacheSeconds),
    [k.ttlR2LogoListMs]: String(dto.ttl.r2LogoListMs),
    [k.ttlJwtExpiresIn]: dto.ttl.jwtExpiresIn,
    [k.ttlAllowCookieAuth]: dto.ttl.allowCookieAuth ? 'true' : 'false',
    [k.retriesPricingMax]: String(dto.retries.pricingApi.max),
    [k.retriesPricingBaseMs]: String(dto.retries.pricingApi.baseMs),
    [k.retriesPricingMaxMs]: String(dto.retries.pricingApi.maxMs),
    [k.concPricingParallel]: String(dto.concurrency.pricingApi.parallel),
    [k.concPricingMinIntervalMs]: String(
      dto.concurrency.pricingApi.minIntervalMs,
    ),
    [k.concBackfillBatch]: String(dto.concurrency.priceBackfill.batch),
    [k.concBackfillMaxPerTenant]: String(
      dto.concurrency.priceBackfill.maxPerTenant,
    ),
    [k.concBackfillInterDelayMs]: String(
      dto.concurrency.priceBackfill.interRequestDelayMs,
    ),
    [k.rlGlobalWindowMs]: String(dto.rateLimits.global.windowMs),
    [k.rlGlobalMax]: String(dto.rateLimits.global.max),
    [k.rlPublicWindowMs]: String(dto.rateLimits.publicTenant.windowMs),
    [k.rlPublicListMax]: String(dto.rateLimits.publicTenant.listMax),
    [k.rlPublicBrandingMax]: String(dto.rateLimits.publicTenant.brandingMax),
    [k.pricingBaseUrl]: dto.pricing.baseUrl,
    [k.pricingApiKey]: dto.pricing.apiKey,
    [k.scheduledPriceBackfillEnabled]: dto.scheduledPriceBackfill.enabled
      ? 'true'
      : 'false',
    [k.scheduledPriceBackfillCronExpression]:
      dto.scheduledPriceBackfill.cronExpression,
    [k.scheduledPriceBackfillManualCooldownSuccessSec]: String(
      dto.scheduledPriceBackfill.manualCooldownSuccessSec,
    ),
    [k.scheduledPriceBackfillManualCooldownErrorSec]: String(
      dto.scheduledPriceBackfill.manualCooldownErrorSec,
    ),
    [k.loggingLevel]: dto.logging.level,
    [k.loggingFormat]: dto.logging.format,
    [k.tenantImportPgDumpBirthDateFallback]:
      dto.tenantImport.pgDumpBirthDateFallback,
  };
}

function parseIntSafe(raw: string | undefined, fallback: number): number {
  const n = raw != null ? Number(String(raw).trim()) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || String(raw).trim() === '') return fallback;
  return String(raw).trim().toLowerCase() === 'true';
}

export function decodeRuntimeDbRows(
  all: Record<string, string>,
): Partial<SystemConfigDto> {
  const k = RUNTIME_DB_KEYS;
  const out: Partial<SystemConfigDto> = {};

  const corsRaw = all[k.corsAllowedOrigins];
  if (corsRaw != null && String(corsRaw).trim() !== '') {
    try {
      const parsed = JSON.parse(String(corsRaw)) as unknown;
      if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) {
        out.cors = { allowedOrigins: parsed as string[] };
      }
    } catch {
      /* ignore */
    }
  }

  const ttl: Partial<SystemConfigDto['ttl']> = {};
  if (all[k.ttlHealthcheckMs] != null) {
    const v = parseIntSafe(all[k.ttlHealthcheckMs], NaN);
    if (Number.isFinite(v)) ttl.healthcheckMs = v;
  }
  if (all[k.ttlAuthCacheSeconds] != null) {
    const v = parseIntSafe(all[k.ttlAuthCacheSeconds], NaN);
    if (Number.isFinite(v)) ttl.authCacheSeconds = v;
  }
  if (all[k.ttlR2LogoListMs] != null) {
    const v = parseIntSafe(all[k.ttlR2LogoListMs], NaN);
    if (Number.isFinite(v)) ttl.r2LogoListMs = v;
  }
  if (
    all[k.ttlJwtExpiresIn] != null &&
    String(all[k.ttlJwtExpiresIn]).trim() !== ''
  )
    ttl.jwtExpiresIn = String(all[k.ttlJwtExpiresIn]).trim();
  if (all[k.ttlAllowCookieAuth] != null)
    ttl.allowCookieAuth = parseBool(all[k.ttlAllowCookieAuth], false);

  if (Object.keys(ttl).length) out.ttl = ttl as SystemConfigDto['ttl'];

  const retries: Partial<SystemConfigDto['retries']> = {};
  const pa: Partial<SystemConfigDto['retries']['pricingApi']> = {};
  if (all[k.retriesPricingMax] != null) {
    const v = parseIntSafe(all[k.retriesPricingMax], NaN);
    if (Number.isFinite(v)) pa.max = v;
  }
  if (all[k.retriesPricingBaseMs] != null) {
    const v = parseIntSafe(all[k.retriesPricingBaseMs], NaN);
    if (Number.isFinite(v)) pa.baseMs = v;
  }
  if (all[k.retriesPricingMaxMs] != null) {
    const v = parseIntSafe(all[k.retriesPricingMaxMs], NaN);
    if (Number.isFinite(v)) pa.maxMs = v;
  }
  if (Object.keys(pa).length)
    retries.pricingApi = pa as SystemConfigDto['retries']['pricingApi'];
  if (retries.pricingApi) out.retries = retries as SystemConfigDto['retries'];

  const conc: Partial<SystemConfigDto['concurrency']> = {};
  const cpa: Partial<SystemConfigDto['concurrency']['pricingApi']> = {};
  if (all[k.concPricingParallel] != null) {
    const v = parseIntSafe(all[k.concPricingParallel], NaN);
    if (Number.isFinite(v)) cpa.parallel = v;
  }
  if (all[k.concPricingMinIntervalMs] != null) {
    const v = parseIntSafe(all[k.concPricingMinIntervalMs], NaN);
    if (Number.isFinite(v)) cpa.minIntervalMs = v;
  }
  if (Object.keys(cpa).length)
    conc.pricingApi = cpa as SystemConfigDto['concurrency']['pricingApi'];

  const cpb: Partial<SystemConfigDto['concurrency']['priceBackfill']> = {};
  if (all[k.concBackfillBatch] != null) {
    const v = parseIntSafe(all[k.concBackfillBatch], NaN);
    if (Number.isFinite(v)) cpb.batch = v;
  }
  if (all[k.concBackfillMaxPerTenant] != null) {
    const v = parseIntSafe(all[k.concBackfillMaxPerTenant], NaN);
    if (Number.isFinite(v)) cpb.maxPerTenant = v;
  }
  if (all[k.concBackfillInterDelayMs] != null) {
    const v = parseIntSafe(all[k.concBackfillInterDelayMs], NaN);
    if (Number.isFinite(v)) cpb.interRequestDelayMs = v;
  }
  if (Object.keys(cpb).length)
    conc.priceBackfill = cpb as SystemConfigDto['concurrency']['priceBackfill'];
  if (Object.keys(conc).length)
    out.concurrency = conc as SystemConfigDto['concurrency'];

  const rl: Partial<SystemConfigDto['rateLimits']> = {};
  const g: Partial<SystemConfigDto['rateLimits']['global']> = {};
  if (all[k.rlGlobalWindowMs] != null) {
    const v = parseIntSafe(all[k.rlGlobalWindowMs], NaN);
    if (Number.isFinite(v)) g.windowMs = v;
  }
  if (all[k.rlGlobalMax] != null) {
    const v = parseIntSafe(all[k.rlGlobalMax], NaN);
    if (Number.isFinite(v)) g.max = v;
  }
  if (Object.keys(g).length)
    rl.global = g as SystemConfigDto['rateLimits']['global'];

  const p: Partial<SystemConfigDto['rateLimits']['publicTenant']> = {};
  if (all[k.rlPublicWindowMs] != null) {
    const v = parseIntSafe(all[k.rlPublicWindowMs], NaN);
    if (Number.isFinite(v)) p.windowMs = v;
  }
  if (all[k.rlPublicListMax] != null) {
    const v = parseIntSafe(all[k.rlPublicListMax], NaN);
    if (Number.isFinite(v)) p.listMax = v;
  }
  if (all[k.rlPublicBrandingMax] != null) {
    const v = parseIntSafe(all[k.rlPublicBrandingMax], NaN);
    if (Number.isFinite(v)) p.brandingMax = v;
  }
  if (Object.keys(p).length)
    rl.publicTenant = p as SystemConfigDto['rateLimits']['publicTenant'];
  if (Object.keys(rl).length)
    out.rateLimits = rl as SystemConfigDto['rateLimits'];

  if (all[k.pricingBaseUrl] != null || all[k.pricingApiKey] != null) {
    out.pricing = {
      baseUrl:
        all[k.pricingBaseUrl] != null ? String(all[k.pricingBaseUrl]) : '',
      apiKey: all[k.pricingApiKey] != null ? String(all[k.pricingApiKey]) : '',
    };
  }

  const spb: Partial<SystemConfigDto['scheduledPriceBackfill']> = {};
  if (all[k.scheduledPriceBackfillEnabled] != null) {
    spb.enabled = parseBool(all[k.scheduledPriceBackfillEnabled], true);
  }
  if (
    all[k.scheduledPriceBackfillCronExpression] != null &&
    String(all[k.scheduledPriceBackfillCronExpression]).trim() !== ''
  ) {
    spb.cronExpression = String(
      all[k.scheduledPriceBackfillCronExpression],
    ).trim();
  }
  if (all[k.scheduledPriceBackfillManualCooldownSuccessSec] != null) {
    const v = parseIntSafe(
      all[k.scheduledPriceBackfillManualCooldownSuccessSec],
      NaN,
    );
    if (Number.isFinite(v)) spb.manualCooldownSuccessSec = v;
  }
  if (all[k.scheduledPriceBackfillManualCooldownErrorSec] != null) {
    const v = parseIntSafe(
      all[k.scheduledPriceBackfillManualCooldownErrorSec],
      NaN,
    );
    if (Number.isFinite(v)) spb.manualCooldownErrorSec = v;
  }
  if (Object.keys(spb).length) {
    out.scheduledPriceBackfill =
      spb as SystemConfigDto['scheduledPriceBackfill'];
  }

  const lg: Partial<SystemConfigDto['logging']> = {};
  if (
    all[k.loggingLevel] != null &&
    String(all[k.loggingLevel]).trim() !== ''
  ) {
    lg.level = String(all[k.loggingLevel]).trim();
  }
  if (all[k.loggingFormat] != null) {
    const f = String(all[k.loggingFormat]).trim().toLowerCase();
    if (f === 'json' || f === 'pretty') lg.format = f;
  }
  if (Object.keys(lg).length) {
    out.logging = lg as SystemConfigDto['logging'];
  }

  const tiKey = k.tenantImportPgDumpBirthDateFallback;
  const legacyTi = all[LEGACY_IMPORT_BIRTH_DATE_FALLBACK_KEY];
  if (
    all[tiKey] != null &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(all[tiKey]).trim())
  ) {
    out.tenantImport = {
      pgDumpBirthDateFallback: String(all[tiKey]).trim(),
    };
  } else if (
    legacyTi != null &&
    String(legacyTi).trim() !== '' &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(legacyTi).trim())
  ) {
    out.tenantImport = {
      pgDumpBirthDateFallback: String(legacyTi).trim(),
    };
  }

  return out;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const o: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    o[key] = val;
  }
  return o as Partial<T>;
}

export function mergeSystemConfigPatch(
  base: SystemConfigDto,
  patch: SystemConfigPatch,
): SystemConfigDto {
  const merged: SystemConfigDto = {
    cors: { ...base.cors, ...stripUndefined(patch.cors ?? {}) },
    ttl: { ...base.ttl, ...stripUndefined(patch.ttl ?? {}) },
    retries: {
      pricingApi: {
        ...base.retries.pricingApi,
        ...stripUndefined(patch.retries?.pricingApi ?? {}),
      },
    },
    concurrency: {
      pricingApi: {
        ...base.concurrency.pricingApi,
        ...stripUndefined(patch.concurrency?.pricingApi ?? {}),
      },
      priceBackfill: {
        ...base.concurrency.priceBackfill,
        ...stripUndefined(patch.concurrency?.priceBackfill ?? {}),
      },
    },
    rateLimits: {
      global: {
        ...base.rateLimits.global,
        ...stripUndefined(patch.rateLimits?.global ?? {}),
      },
      publicTenant: {
        ...base.rateLimits.publicTenant,
        ...stripUndefined(patch.rateLimits?.publicTenant ?? {}),
      },
    },
    pricing: {
      ...base.pricing,
      ...stripUndefined(patch.pricing ?? {}),
    },
    scheduledPriceBackfill: {
      ...base.scheduledPriceBackfill,
      ...stripUndefined(patch.scheduledPriceBackfill ?? {}),
    },
    logging: {
      ...base.logging,
      ...stripUndefined(patch.logging ?? {}),
    },
    tenantImport: {
      ...base.tenantImport,
      ...stripUndefined(patch.tenantImport ?? {}),
    },
  };
  return merged;
}

export function filterNonRuntimeConfig(
  all: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(all)) {
    if (isRuntimeConfigKey(key)) continue;
    out[key] = val;
  }
  return out;
}
