import axios from 'axios';
import { load } from 'cheerio';
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
      const url = `https://www.drogariasaopaulo.com.br/pesquisa?q=${encodeURIComponent(
        query,
      )}`;

      logger.debug('Buscando preços na Drogaria São Paulo', {
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
          Referer: 'https://www.drogariasaopaulo.com.br/',
          Connection: 'keep-alive',
        },
        validateStatus: s => s >= 200 && s < 400,
      });

      const $ = load(response.data);
      const results: number[] = [];

      // Cada produto está dentro de um <li>
      $('li').each((_, li) => {
        let price: number | null = null;

        // 1️⃣ Tenta pegar preço promocional
        const promoText = $(li).find('.valor-por').text();
        price = this.extractPrice(promoText);

        // 2️⃣ Fallback para preço original
        if (price === null) {
          const originalText = $(li).find('.valor-de').text();
          price = this.extractPrice(originalText);
        }

        if (price !== null) {
          results.push(price);
        }
      });

      return results;
    } catch (error) {
      logger.error('Erro ao buscar preço na Drogaria São Paulo', {
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
      .match(/R\$\s*(\d+(?:,\d{2})?)/);

    if (!match) return null;

    return Number(match[1].replace(',', '.'));
  }
}
