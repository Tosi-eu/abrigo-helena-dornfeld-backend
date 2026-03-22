import type { IPriceSearchService } from '../../core/services/price-search.types';
import { PricingApiClient } from '../clients/pricing-api.client';

function createPriceSearchService(): IPriceSearchService | undefined {
  const url = process.env.PRICING_API_URL?.trim();
  const key = process.env.PRICING_API_KEY?.trim();
  if (!url || !key) {
    return undefined;
  }
  return new PricingApiClient(url, key);
}

/** Cliente HTTP para o microsserviço `porto-api-price-search` (pasta na raiz do repositório). */
export const priceSearchService: IPriceSearchService | undefined =
  createPriceSearchService();
