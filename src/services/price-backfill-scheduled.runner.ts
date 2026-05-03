import { logger } from '@helpers/logger.helper';
import { getPriceSearchService } from '@helpers/price-service.helper';
import { PrismaTenantConfigRepository } from '@repositories/tenant-config.repository';
import { PrismaSetorRepository } from '@repositories/setor.repository';
import { TenantConfigService } from '@services/tenant-config.service';
import { PriceBackfillService } from '@services/price-backfill.service';
import { getRuntimeHttpConfig } from '@config/http/runtime-http-config';

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

export async function runScheduledPriceBackfillForAllTenants(): Promise<ScheduledPriceBackfillResult> {
  if (!getPriceSearchService()) {
    return {
      ok: true,
      skipped: true,
      reason: 'PRICING_API_UNAVAILABLE',
      tenants: 0,
      itemsProcessed: 0,
    };
  }
  if (!getRuntimeHttpConfig().scheduledPriceBackfill.enabled) {
    return {
      ok: true,
      skipped: true,
      reason: 'SCHEDULED_PRICE_BACKFILL_DISABLED',
      tenants: 0,
      itemsProcessed: 0,
    };
  }

  const pb = getRuntimeHttpConfig().concurrency.priceBackfill;
  const batch = pb.batch || DEFAULT_BATCH;
  const perTenantMax = pb.maxPerTenant || batch * 2;

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
