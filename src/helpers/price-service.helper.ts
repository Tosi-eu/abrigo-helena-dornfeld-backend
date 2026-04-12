import type { IPriceSearchService } from '@services/price-search.types';
import { PricingApiClient } from '@services/clients/pricing-api.client';
import { logger } from '@helpers/logger.helper';

function createPriceSearchService(): IPriceSearchService | undefined {
  const url = process.env.PRICING_API_URL?.trim();
  const key = process.env.PRICING_API_KEY?.trim();
  if (!url || !key) {
    if (process.env.NODE_ENV !== 'test') {
      logger.warn(
        'Busca de preços desativada: defina PRICING_API_URL e PRICING_API_KEY (microserviço porto-api-price-search). A opção no painel do abrigo não ativa a integração sem estas variáveis.',
        { operation: 'pricing_api_init' },
      );
    }
    return undefined;
  }
  return new PricingApiClient(url, key);
}

export const priceSearchService: IPriceSearchService | undefined =
  createPriceSearchService();
