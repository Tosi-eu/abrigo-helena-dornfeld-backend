import {
  decodeRuntimeDbRows,
  encodeSystemConfigToDb,
  mergeSystemConfigPatch,
  RUNTIME_DB_KEYS,
  SystemConfigSchema,
} from '@domain/dto/system-config.dto';
import { getBuiltinDefaultSystemConfig } from '@services/system-config.defaults';

describe('system-config.dto', () => {
  it('encode/decode roundtrip', () => {
    const base = getBuiltinDefaultSystemConfig();
    const flat = encodeSystemConfigToDb(base);
    const partial = decodeRuntimeDbRows(flat);
    const merged = mergeSystemConfigPatch(base, partial as never);
    const parsed = SystemConfigSchema.parse(merged);
    expect(parsed.cors.allowedOrigins).toEqual(base.cors.allowedOrigins);
    expect(parsed.ttl.healthcheckMs).toBe(base.ttl.healthcheckMs);
    expect(parsed.pricing.baseUrl).toBe(base.pricing.baseUrl);
    expect(parsed.pricing.apiKey).toBe(base.pricing.apiKey);
    expect(parsed.scheduledPriceBackfill.enabled).toBe(
      base.scheduledPriceBackfill.enabled,
    );
    expect(parsed.scheduledPriceBackfill.cronExpression).toBe(
      base.scheduledPriceBackfill.cronExpression,
    );
    expect(parsed.scheduledPriceBackfill.manualCooldownSuccessSec).toBe(
      base.scheduledPriceBackfill.manualCooldownSuccessSec,
    );
    expect(parsed.scheduledPriceBackfill.manualCooldownErrorSec).toBe(
      base.scheduledPriceBackfill.manualCooldownErrorSec,
    );
    expect(parsed.scheduledBackup.enabled).toBe(base.scheduledBackup.enabled);
    expect(parsed.scheduledBackup.cronExpression).toBe(
      base.scheduledBackup.cronExpression,
    );
    expect(parsed.scheduledBackup.timezone).toBe(base.scheduledBackup.timezone);
    expect(parsed.logging.level).toBe(base.logging.level);
    expect(parsed.logging.format).toBe(base.logging.format);
    expect(parsed.tenantImport.pgDumpBirthDateFallback).toBe(
      base.tenantImport.pgDumpBirthDateFallback,
    );
  });

  it('mergeSystemConfigPatch aplica ramos parciais', () => {
    const base = getBuiltinDefaultSystemConfig();
    const next = mergeSystemConfigPatch(base, {
      ttl: { authCacheSeconds: 99 },
      retries: { pricingApi: { max: 3 } },
    });
    expect(next.ttl.authCacheSeconds).toBe(99);
    expect(next.ttl.healthcheckMs).toBe(base.ttl.healthcheckMs);
    expect(next.retries.pricingApi.max).toBe(3);
    expect(next.retries.pricingApi.baseMs).toBe(base.retries.pricingApi.baseMs);
    SystemConfigSchema.parse(next);
  });

  it('decodeRuntimeDbRows ignora chaves desconhecidas', () => {
    const partial = decodeRuntimeDbRows({
      [RUNTIME_DB_KEYS.ttlHealthcheckMs]: '5000',
      other_key: 'x',
    });
    expect(partial.ttl?.healthcheckMs).toBe(5000);
  });
});
