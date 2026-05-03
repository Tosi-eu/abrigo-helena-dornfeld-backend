import type { SystemConfigDto } from '@domain/dto/system-config.dto';

export function getBuiltinDefaultSystemConfig(): SystemConfigDto {
  return {
    cors: {
      allowedOrigins: [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000',
      ],
    },
    ttl: {
      healthcheckMs: 10_000,
      authCacheSeconds: 30,
      r2LogoListMs: 10 * 60 * 1000,
      jwtExpiresIn: '6h',
      allowCookieAuth: false,
    },
    retries: {
      pricingApi: {
        max: 5,
        baseMs: 800,
        maxMs: 15_000,
      },
    },
    concurrency: {
      pricingApi: {
        parallel: 1,
        minIntervalMs: 900,
      },
      priceBackfill: {
        batch: 40,
        maxPerTenant: 80,
        interRequestDelayMs: 300,
      },
    },
    rateLimits: {
      global: {
        windowMs: 15 * 60 * 1000,
        max: 1000,
      },
      publicTenant: {
        windowMs: 60_000,
        listMax: 120,
        brandingMax: 120,
      },
    },

    pricing: {
      baseUrl: '',
      apiKey: '',
    },
    scheduledPriceBackfill: {
      enabled: true,
      cronExpression: '15 */2 * * *',
      manualCooldownSuccessSec: 60,
      manualCooldownErrorSec: 300,
    },
    scheduledBackup: {
      enabled: true,
      cronExpression: '0 8-18/2 * * *',
      timezone: 'America/Sao_Paulo',
    },
    logging: {
      level: 'debug',
      format: 'pretty',
    },
    tenantImport: {
      pgDumpBirthDateFallback: '1970-01-01',
    },
  };
}
