import { logger } from '@helpers/logger.helper';
import { priceSearchService } from '@helpers/price-service.helper';
import { PrismaTenantConfigRepository } from '@repositories/tenant-config.repository';
import { PrismaSetorRepository } from '@repositories/setor.repository';
import { TenantConfigService } from '@services/tenant-config.service';
import { PriceBackfillService } from '@services/price-backfill.service';

function envBool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return String(raw).trim().toLowerCase() === 'true';
}

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

const DEFAULT_BATCH = 40;

const tenantConfigService = new TenantConfigService(
  new PrismaTenantConfigRepository(),
  new PrismaSetorRepository(),
);

const backfill = new PriceBackfillService();

export type ScheduledPriceBackfillResult =
  | {
      ok: true;
      skipped: true;
      reason: string;
      tenants: number;
      itemsProcessed: number;
    }
  | {
      ok: true;
      skipped: false;
      tenants: number;
      itemsProcessed: number;
    };

/**
 * Respeita ENABLE_PRICE_BACKFILL_CRON e `automatic_price_search` por tenant.
 * O agendamento (ENABLE_CRON / expressão cron) fica na API Price Search, que chama este fluxo via HTTP.
 */
export async function runScheduledPriceBackfillForAllTenants(): Promise<ScheduledPriceBackfillResult> {
  if (!priceSearchService) {
    return {
      ok: true,
      skipped: true,
      reason: 'PRICING_API_UNAVAILABLE',
      tenants: 0,
      itemsProcessed: 0,
    };
  }
  if (!envBool('ENABLE_PRICE_BACKFILL_CRON', true)) {
    return {
      ok: true,
      skipped: true,
      reason: 'ENABLE_PRICE_BACKFILL_CRON',
      tenants: 0,
      itemsProcessed: 0,
    };
  }

  const batch = envInt('PRICE_BACKFILL_BATCH', DEFAULT_BATCH);
  const perTenantMax = envInt('PRICE_BACKFILL_MAX_PER_TENANT', batch * 2);

  const tenantIds = await tenantConfigService.listAllTenantIds();
  let itemsProcessed = 0;

  for (const tenantId of tenantIds) {
    try {
      const cfg = await tenantConfigService.get(tenantId);
      if (cfg.automatic_price_search === false) continue;
      const processed = await backfill.backfillTenantOnce(
        tenantId,
        batch,
        perTenantMax,
      );
      itemsProcessed += processed;
    } catch (err) {
      logger.error('[price-backfill] tenant run failed', {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    ok: true,
    skipped: false,
    tenants: tenantIds.length,
    itemsProcessed,
  };
}
