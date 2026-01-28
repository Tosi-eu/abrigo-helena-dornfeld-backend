import axios from 'axios';
import { load } from 'cheerio';
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

      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          Referer: 'https://www.drogaraia.com.br/',
          Connection: 'keep-alive',
        },
        validateStatus: s => s >= 200 && s < 400,
      });

      const $ = load(response.data);
      const results: number[] = [];

      $('article[data-card="product"]').each((_, article) => {
        let finalPrice: number | null = null;

        const discountPrices = $(article)
          .find('[data-testid="price-discount"] [data-testid="price"]');

        if (discountPrices.length > 0) {
          const promoText = discountPrices.last().text();
          finalPrice = this.extractPrice(promoText);
        }

        if (finalPrice == null) {
          const normalPriceText = $(article)
            .find('[data-testid="price"]')
            .first()
            .text();

          finalPrice = this.extractPrice(normalPriceText);
        }

        if (finalPrice !== null) {
          results.push(finalPrice);
        }
      });

      return results;
    } catch (error) {
      logger.error('Erro ao buscar preço na Droga Raia', {
        source: this.sourceName,
        error: (error as Error).message,
      });
      return [];
    }
  }

  private extractPrice(text: string): number | null {
    if (!text) return null;

    const match = text
      .replace(/\s+/g, ' ')
      .match(/R\$\s*(\d+,\d{2})/);

    if (!match) return null;

    return Number(match[1].replace(',', '.'));
  }
}