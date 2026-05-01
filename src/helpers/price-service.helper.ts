import type { IPriceSearchService } from '@services/price-search.types';
import { PricingApiClient } from '@services/clients/pricing-api.client';
import { logger } from '@helpers/logger.helper';

function createPriceSearchService(): IPriceSearchService | undefined {
  const url = process.env.PRICING_API_URL?.trim();
  const key = process.env.PRICING_API_KEY?.trim();
  if (!url || !key) {
    if (process.env.NODE_ENV !== 'test') {
      logger.warn(
        'Pricing integration disabled: set PRICING_API_URL and PRICING_API_KEY. Enabling it in the admin panel does not activate integration without these env vars.',
        { operation: 'pricing_api_init' },
      );
    }
    return undefined;
  }
  return new PricingApiClient(url, key);
}

export const priceSearchService: IPriceSearchService | undefined =
  createPriceSearchService();
