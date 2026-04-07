import type { IPriceSearchService } from '@services/price-search.types';
import { PricingApiClient } from '@services/clients/pricing-api.client';

function createPriceSearchService(): IPriceSearchService | undefined {
  const url = process.env.PRICING_API_URL?.trim();
  const key = process.env.PRICING_API_KEY?.trim();
  if (!url || !key) {
    return undefined;
  }
  return new PricingApiClient(url, key);
}

export const priceSearchService: IPriceSearchService | undefined =
  createPriceSearchService();
