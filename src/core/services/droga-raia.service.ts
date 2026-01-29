import axios from 'axios';
import { logger } from '../../infrastructure/helpers/logger.helper';
import { PriceSourceStrategy } from '../utils/utils';

export class DrogaRaiaStrategy implements PriceSourceStrategy {
  readonly sourceName = 'droga_raia';

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
      const url = `https://www.drogaraia.com.br/search?w=${encodeURIComponent(
        query,
      )}&search-type=direct`;

      logger.debug('Buscando preços na Droga Raia', {
        source: this.sourceName,
        url,
        query,
      });

      const response = await axios.get<string>(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'text/html',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        validateStatus: status => status >= 200 && status < 400,
      });

      const nextData = this.extractNextData(response.data);

      if (!nextData) {
        logger.warn('Next Data não encontrado na página', {
          source: this.sourceName,
        });
        return [];
      }

      const products =
        nextData?.props?.pageProps?.pageProps?.results?.products ?? [];

      return products
        .map((product: any) => Number(product.priceService) || null)
        .filter((price: number | null): price is number => price !== null);

    } catch (error) {
      logger.error('Erro ao buscar preços na Droga Raia', {
        source: this.sourceName,
        error: (error as Error).message,
      });
      return [];
    }
  }

  private extractNextData(html: string): any | null {
    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/
    );

    if (!match || !match[1]) {
      return null;
    }

    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
}
