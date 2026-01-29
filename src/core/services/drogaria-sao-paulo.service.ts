import axios from 'axios';
import { logger } from '../../infrastructure/helpers/logger.helper';
import { PriceSourceStrategy } from '../utils/utils';

export class DrogariaSaoPauloStrategy implements PriceSourceStrategy {
  readonly sourceName = 'drogaria_sao_paulo';

  supports(itemType: 'medicine' | 'input'): boolean {
    return itemType === 'medicine';
  }

  async fetchPrices({
    itemName,
    dosage,
  }: {
    itemName: string;
    dosage?: string;
  }): Promise<number[]> {
    try {
      const query = `${itemName} ${dosage ?? ''}`.trim();

      const url =
        'https://www.drogariasaopaulo.com.br/api/catalog_system/pub/products/search/' +
        encodeURIComponent(query);

      logger.debug('Buscando preços na Drogaria São Paulo (VTEX)', {
        source: this.sourceName,
        url,
        query,
      });

      const response = await axios.get<any[]>(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json',
        },
        validateStatus: status => status >= 200 && status < 400,
      });

      const products = response.data ?? [];
      const prices: number[] = [];

      for (const product of products) {
        const item = product?.items?.[0];
        const seller = item?.sellers?.[0];
        const offer = seller?.commertialOffer;

        if (!offer) continue;

        const fullPrice =
          offer.ListPrice && offer.ListPrice > 0
            ? offer.ListPrice
            : offer.Price;

        if (typeof fullPrice === 'number' && fullPrice > 0) {
          prices.push(fullPrice);
        }
      }

      return prices;
    } catch (error) {
      logger.error('Erro ao buscar preços na Drogaria São Paulo', {
        source: this.sourceName,
        error: (error as Error).message,
      });
      return [];
    }
  }
}