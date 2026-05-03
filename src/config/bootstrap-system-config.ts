import type { INestApplication } from '@nestjs/common';
import { prisma } from '@repositories/prisma';
import { SystemConfigService } from '@services/system-config.service';
import { rebuildGlobalRateLimiterFromConfig } from '@config/http/http-rate-limit-wrappers';
import { rebuildPublicTenantLimitersFromConfig } from '@controllers/api/app.api.controller';
import { PricingApiClient } from '@services/clients/pricing-api.client';
import { invalidatePriceSearchServiceCache } from '@helpers/price-service.helper';
import { applyRuntimeLogging } from '@helpers/logger.helper';

export async function wireSystemConfigAfterNestInit(
  app: INestApplication,
): Promise<void> {
  await prisma.$connect();
  const systemConfig = app.get(SystemConfigService);
  systemConfig.onChange(() => {
    applyRuntimeLogging(systemConfig.get().logging);
    rebuildGlobalRateLimiterFromConfig();
    rebuildPublicTenantLimitersFromConfig();
    PricingApiClient.resetPricingGate();
    invalidatePriceSearchServiceCache();
  });
  await systemConfig.init();
  applyRuntimeLogging(systemConfig.get().logging);
  rebuildGlobalRateLimiterFromConfig();
  rebuildPublicTenantLimitersFromConfig();
  PricingApiClient.resetPricingGate();
  invalidatePriceSearchServiceCache();
}
