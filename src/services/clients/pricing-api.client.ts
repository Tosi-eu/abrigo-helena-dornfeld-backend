import axios from 'axios';
import type {
  IPriceSearchService,
  PriceSearchResult,
} from '../price-search.types';
import { logger } from '@helpers/logger.helper';

interface PricingApiSearchResponse {
  averagePrice: number | null;
  source: string;
  lastUpdated: string | null;
}

export class PricingApiClient implements IPriceSearchService {
  private readonly base: string;

  constructor(
    baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs = 120_000,
  ) {
    this.base = baseUrl.replace(/\/$/, '');
  }

  async searchPrice(
    itemName: string,
    itemType: 'medicine' | 'input',
    dosage?: string,
    measurementUnit?: string,
  ): Promise<PriceSearchResult | null> {
    try {
      const { data } = await axios.post<PricingApiSearchResponse>(
        `${this.base}/v1/search`,
        { itemName, itemType, dosage, measurementUnit },
        {
          timeout: this.timeoutMs,
          headers: {
            'Content-Type': 'application/json',
            'X-Pricing-API-Key': this.apiKey,
          },
        },
      );

      if (data.averagePrice == null || data.lastUpdated == null) {
        return null;
      }

      return {
        averagePrice: data.averagePrice,
        source: data.source,
        lastUpdated: new Date(data.lastUpdated),
      };
    } catch (error) {
      logger.error(
        'Falha ao chamar porto-api-price-search',
        {
          operation: 'pricing_api',
        },
        error as Error,
      );
      return null;
    }
  }
}
