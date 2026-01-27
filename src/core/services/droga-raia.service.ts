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
      const url = `https://www.drogaraia.com.br/search?w=${encodeURIComponent(query)}&search-type=direct`;

      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'pt-BR,pt;q=0.9',
                'Referer': 'https://www.drogaraia.com.br/',
                'Connection': 'keep-alive',
        },
        validateStatus: s => s >= 200 && s < 400,
      });

      const $ = load(response.data);

      const prices: number[] = [];

      $('[data-testid="price"]').each((_, el) => {
        const text = $(el).text();
        const price = this.extractPrice(text);
        if (price) prices.push(price);
      });

      return prices;
    } catch (error) {
      logger.error('Erro ao buscar preço na Droga Raia', {
        source: this.sourceName,
        error: (error as Error).message,
      });
      return [];
    }
  }

  private buildSlug(name: string, dosage?: string): string {
    let slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    if (dosage) {
      slug += `-${dosage.replace(/\s+/g, '-')}`;
    }

    return slug;
  }

  private extractPrice(text: string): number | null {
    const match = text.match(/R\$\s*(\d+(?:,\d{2})?)/);
    if (!match) return null;
    return parseFloat(match[1].replace(',', '.'));
  }
}