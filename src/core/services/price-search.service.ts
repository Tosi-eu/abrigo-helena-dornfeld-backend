import axios from 'axios';
import { load } from 'cheerio';
import { CacheService } from './redis.service';
import { MedicineRepository } from '../../infrastructure/database/repositories/medicamento.repository';
import { InputRepository } from '../../infrastructure/database/repositories/insumo.repository';
import { logger } from '../../infrastructure/helpers/logger.helper';

export interface PriceSearchResult {
  averagePrice: number | null;
  source: string;
  lastUpdated: Date;
}

export class PriceSearchService {
  constructor(
    private readonly cache: CacheService,
    private readonly medicineRepo: MedicineRepository,
    private readonly inputRepo: InputRepository,
  ) {}

  private getCacheKey(
    itemName: string,
    dosage?: string,
    itemType: 'medicine' | 'input' = 'medicine',
  ): string {
    const cacheKeyType = itemType === 'medicine' ? 'medicine' : 'input';
    const key = `${cacheKeyType}:price:${itemName.toLowerCase().trim()}${dosage ? `:${dosage}` : ''}`;
    return key.replace(/\s+/g, '_');
  }

  async searchPrice(
    itemName: string,
    itemType: 'medicine' | 'input',
    dosage?: string,
    measurementUnit?: string,
  ): Promise<PriceSearchResult | null> {
    const cacheKey = this.getCacheKey(itemName, dosage, itemType);

    const cachedResult = await this.cache.get<PriceSearchResult>(cacheKey);
    if (cachedResult && cachedResult.averagePrice !== null) return cachedResult;

    const priceSearchResult = await this.fetchPriceFromExternalSource(
      itemName,
      dosage,
      itemType,
      measurementUnit,
    );

    if (
      priceSearchResult &&
      priceSearchResult.averagePrice != null &&
      priceSearchResult.averagePrice > 0
    ) {
      await this.cache.set(cacheKey, priceSearchResult, 86400);
      return priceSearchResult;
    }

    return null;
  }

  async updatePriceInDatabase(
    itemId: number,
    itemName: string,
    itemType: 'medicine' | 'input',
    dosage?: string,
    measurementUnit?: string,
  ): Promise<{ found: boolean; price: number | null }> {
    try {
      logger.debug('Iniciando busca de preço', {
        operation: 'price_search',
        itemType,
        itemId,
        itemName,
        dosage,
        measurementUnit,
      });

      const priceSearchResult = await this.searchPrice(
        itemName,
        itemType,
        dosage,
        measurementUnit,
      );

      if (
        priceSearchResult &&
        priceSearchResult.averagePrice !== null &&
        priceSearchResult.averagePrice > 0
      ) {
        logger.info('Preço encontrado', {
          operation: 'price_search',
          itemType,
          itemId,
          preco: priceSearchResult.averagePrice.toFixed(2),
          fonte: priceSearchResult.source,
        });

        return { found: true, price: priceSearchResult.averagePrice };
      } else {
        logger.info('Nenhum preço encontrado', {
          operation: 'price_search',
          itemType,
          itemId,
        });
        return { found: false, price: null };
      }
    } catch (error) {
      logger.error(
        'Erro ao buscar preço',
        {
          operation: 'price_search',
          itemType,
          itemId,
        },
        error as Error,
      );
      return { found: false, price: null };
    }
  }

  private async fetchPriceFromExternalSource(
    itemName: string,
    dosage?: string,
    itemType: 'medicine' | 'input' = 'medicine',
    measurementUnit?: string,
  ): Promise<PriceSearchResult | null> {
    if (itemType === 'medicine') {
      return await this.searchMedicinePrice(itemName, dosage, measurementUnit);
    }

    return await this.searchInputPrice(itemName);
  }

  private async searchMedicinePrice(
    medicineName: string,
    dosage?: string,
    measurementUnit?: string,
  ): Promise<PriceSearchResult | null> {
    const foundPrices: number[] = [];

    try {
      const consultaRemediosPrice = await this.searchConsultaRemedios(
        medicineName,
        dosage,
        measurementUnit,
      );
      if (consultaRemediosPrice) {
        foundPrices.push(consultaRemediosPrice);
      }
    } catch (error) {
      logger.error(
        'Erro ao buscar no Consulta Remédios',
        { operation: 'price_search', source: 'consulta_remedios' },
        error as Error,
      );
    }

    if (foundPrices.length > 0) {
      const averagePrice =
        foundPrices.reduce((sum, price) => sum + price, 0) / foundPrices.length;
      return {
        averagePrice: Math.round(averagePrice * 100) / 100,
        source: 'consulta_remedios',
        lastUpdated: new Date(),
      };
    }

    return null;
  }

  private async searchInputPrice(
    inputName: string,
  ): Promise<PriceSearchResult | null> {
    const allFoundPrices: number[] = [];

    try {
      const mercadoLivrePrices =
        await this.searchMercadoLivreAllPrices(inputName);
      if (mercadoLivrePrices && mercadoLivrePrices.length > 0) {
        logger.debug('Mercado Livre encontrou preços', {
          operation: 'price_search',
          source: 'mercado_livre',
          quantidade: mercadoLivrePrices.length,
        });
        allFoundPrices.push(...mercadoLivrePrices);
      }
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      logger.error('Erro ao buscar no Mercado Livre', {
        operation: 'price_search',
        source: 'mercado_livre',
        errorMessage,
      });
    }

    try {
      const buscapePrices = await this.searchBuscapeAllPrices(inputName);
      if (buscapePrices && buscapePrices.length > 0) {
        logger.debug('Buscapé encontrou preços', {
          operation: 'price_search',
          source: 'buscape',
          quantidade: buscapePrices.length,
        });
        allFoundPrices.push(...buscapePrices);
      }
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      logger.error('Erro ao buscar no Buscapé', {
        operation: 'price_search',
        source: 'buscape',
        errorMessage,
      });
    }

    if (allFoundPrices.length === 0) {
      return null;
    }

    logger.debug('Total de preços coletados', {
      operation: 'price_search',
      totalPrecos: allFoundPrices.length,
      precos: allFoundPrices.sort((a, b) => a - b).map(p => p.toFixed(2)),
    });

    const pricesWithoutOutliers = this.removeOutliersUsingIQR(allFoundPrices);

    if (pricesWithoutOutliers.length === 0) {
      logger.warn('Todos os preços foram considerados outliers', {
        operation: 'price_search',
      });
      return null;
    }

    logger.debug('Preços após remoção de outliers', {
      operation: 'price_search',
      precos: pricesWithoutOutliers
        .sort((a, b) => a - b)
        .map(p => p.toFixed(2)),
    });

    const averagePrice =
      pricesWithoutOutliers.reduce((sum, price) => sum + price, 0) /
      pricesWithoutOutliers.length;
    logger.debug('Preço médio calculado', {
      operation: 'price_search',
      precoMedio: averagePrice.toFixed(2),
      quantidadeValidos: pricesWithoutOutliers.length,
    });

    return {
      averagePrice: Math.round(averagePrice * 100) / 100,
      source: 'ecommerce_aggregator',
      lastUpdated: new Date(),
    };
  }

  private async searchConsultaRemedios(
    medicineName: string,
    dosage?: string,
    measurementUnit?: string,
  ): Promise<number | null> {
    try {
      const normalizedUrlPath = this.normalizeForConsultaRemediosUrl(
        medicineName,
        dosage,
        measurementUnit,
      );

      logger.debug('Buscando no Consulta Remédios', {
        operation: 'price_search',
        source: 'consulta_remedios',
        medicineName,
        dosage,
        measurementUnit,
        normalizedUrlPath,
      });

      const searchUrlOptions = [
        `https://www.consultaremedios.com.br/b/${normalizedUrlPath}`,
        `https://www.consultaremedios.com.br/busca?q=${encodeURIComponent(normalizedUrlPath.replace(/-/g, ' '))}`,
      ];

      for (const searchUrl of searchUrlOptions) {
        try {
          logger.debug('Tentando URL', {
            operation: 'price_search',
            source: 'consulta_remedios',
            url: searchUrl,
          });

          const httpResponse = await this.retryRequest(
            async () => {
              return await axios.get(searchUrl, {
                timeout: 15000,
                maxRedirects: 5,
                validateStatus: status => status >= 200 && status < 400,
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                  'Accept-Language': 'pt-BR,pt;q=0.9',
                  Connection: 'keep-alive',
                  'Upgrade-Insecure-Requests': '1',
                  'Sec-Fetch-Dest': 'document',
                  'Sec-Fetch-Mode': 'navigate',
                  'Sec-Fetch-Site': 'none',
                  'Cache-Control': 'no-cache',
                },
              });
            },
            3,
            2000,
          );

          logger.debug('Resposta recebida', {
            operation: 'price_search',
            source: 'consulta_remedios',
            statusCode: httpResponse.status,
          });

          if (httpResponse.status === 200 && httpResponse.data) {
            const extractedPrice = this.parsePriceFromHtml(httpResponse.data);
            if (extractedPrice) {
              logger.info('Preço extraído', {
                operation: 'price_search',
                source: 'consulta_remedios',
                preco: extractedPrice.toFixed(2),
              });
              return extractedPrice;
            } else {
              logger.debug('HTML recebido mas nenhum preço encontrado', {
                operation: 'price_search',
                source: 'consulta_remedios',
              });
            }
          }
        } catch (urlRequestError: any) {
          const errorCode = urlRequestError.code;
          const errorMessage =
            urlRequestError.message || String(urlRequestError);

          if (
            errorCode === 'EAI_AGAIN' ||
            errorCode === 'ENOTFOUND' ||
            errorMessage.includes('getaddrinfo')
          ) {
            logger.error('Erro de DNS/conectividade', {
              operation: 'price_search',
              source: 'consulta_remedios',
              url: searchUrl,
            });
          } else {
            logger.error('Erro na URL', {
              operation: 'price_search',
              source: 'consulta_remedios',
              url: searchUrl,
              errorMessage,
              errorCode: errorCode || 'N/A',
            });
          }
          continue;
        }
      }

      logger.info('Nenhum preço encontrado após todas as tentativas', {
        operation: 'price_search',
        source: 'consulta_remedios',
      });
      return null;
    } catch (error) {
      logger.error(
        'Erro ao buscar no Consulta Remédios',
        {
          operation: 'price_search',
          source: 'consulta_remedios',
        },
        error as Error,
      );
      return null;
    }
  }

  private normalizeForConsultaRemediosUrl(
    medicineName: string,
    dosage?: string,
    measurementUnit?: string,
  ): string {
    let normalizedTerm = medicineName.trim().toLowerCase();

    normalizedTerm = this.removeAccents(normalizedTerm);
    normalizedTerm = normalizedTerm.replace(/[^\w\s-]/g, '');
    normalizedTerm = normalizedTerm.replace(/\s+/g, '-');

    if (dosage) {
      let dosageWithUnit = dosage.trim().toLowerCase();
      const lowerMeasurementUnit = measurementUnit
        ? measurementUnit.trim().toLowerCase()
        : '';

      const commonUnits = [
        'mg',
        'ml',
        'g',
        'mcg',
        'mg/ml',
        'ui',
        'cp',
        'comprimido',
        'comprimidos',
      ];
      const hasUnitIncluded = commonUnits.some(unit => {
        const escapedUnit = unit.replace('/', '\\/');
        const unitRegex = new RegExp(`\\d+\\s*${escapedUnit}`, 'i');
        return unitRegex.test(dosageWithUnit) || dosageWithUnit.endsWith(unit);
      });

      if (lowerMeasurementUnit && !hasUnitIncluded) {
        dosageWithUnit = `${dosageWithUnit}${lowerMeasurementUnit}`;
      }

      dosageWithUnit = dosageWithUnit.replace(/\s+/g, '');
      normalizedTerm = `${normalizedTerm}-${dosageWithUnit}`;
    }

    return normalizedTerm;
  }

  private removeAccents(text: string): string {
    const accentMap: { [key: string]: string } = {
      á: 'a',
      à: 'a',
      â: 'a',
      ã: 'a',
      ä: 'a',
      é: 'e',
      è: 'e',
      ê: 'e',
      ë: 'e',
      í: 'i',
      ì: 'i',
      î: 'i',
      ï: 'i',
      ó: 'o',
      ò: 'o',
      ô: 'o',
      õ: 'o',
      ö: 'o',
      ú: 'u',
      ù: 'u',
      û: 'u',
      ü: 'u',
      ç: 'c',
      ñ: 'n',
      Á: 'a',
      À: 'a',
      Â: 'a',
      Ã: 'a',
      Ä: 'a',
      É: 'e',
      È: 'e',
      Ê: 'e',
      Ë: 'e',
      Í: 'i',
      Ì: 'i',
      Î: 'i',
      Ï: 'i',
      Ó: 'o',
      Ò: 'o',
      Ô: 'o',
      Õ: 'o',
      Ö: 'o',
      Ú: 'u',
      Ù: 'u',
      Û: 'u',
      Ü: 'u',
      Ç: 'c',
      Ñ: 'n',
    };

    return text.replace(
      /[áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ]/g,
      match => accentMap[match] || match,
    );
  }

  private async searchMercadoLivreAllPrices(
    inputName: string,
  ): Promise<number[] | null> {
    try {
      const normalizedSearchTerm = this.normalizeSearchTerm(inputName);
      const encodedSearchTerm = encodeURIComponent(normalizedSearchTerm);
      const searchUrl = `https://lista.mercadolivre.com.br/${encodedSearchTerm}`;

      const httpResponse = await this.retryRequest(
        async () => {
          return await axios.get(searchUrl, {
            timeout: 15000,
            maxRedirects: 5,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'pt-BR,pt;q=0.9',
              Connection: 'keep-alive',
              'Cache-Control': 'no-cache',
            },
          });
        },
        2,
        1000,
      );

      if (httpResponse.status === 200 && httpResponse.data) {
        const allPrices = this.extractAllPricesFromHtml(httpResponse.data);
        if (allPrices && allPrices.length > 0) {
          return allPrices;
        }
      }

      return null;
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      logger.error('Erro ao buscar no Mercado Livre', {
        operation: 'price_search',
        source: 'mercado_livre',
        errorMessage,
      });
      return null;
    }
  }

  private async searchBuscapeAllPrices(
    inputName: string,
  ): Promise<number[] | null> {
    try {
      const normalizedSearchTerm = this.normalizeSearchTerm(inputName);
      const encodedSearchTerm = encodeURIComponent(normalizedSearchTerm);
      const searchUrl = `https://www.buscape.com.br/search?q=${encodedSearchTerm}`;

      const httpResponse = await this.retryRequest(
        async () => {
          return await axios.get(searchUrl, {
            timeout: 15000,
            maxRedirects: 5,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'pt-BR,pt;q=0.9',
              Connection: 'keep-alive',
              'Cache-Control': 'no-cache',
            },
          });
        },
        2,
        1000,
      );

      if (httpResponse.status === 200 && httpResponse.data) {
        const allPrices = this.extractAllPricesFromHtml(httpResponse.data);
        if (allPrices && allPrices.length > 0) {
          return allPrices;
        }
      }

      return null;
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      logger.error('Erro ao buscar no Buscapé', {
        operation: 'price_search',
        source: 'buscape',
        errorMessage,
      });
      return null;
    }
  }

  private normalizeSearchTerm(itemName: string, dosage?: string): string {
    let normalizedTerm = itemName.trim().toLowerCase();

    if (dosage) {
      normalizedTerm = `${normalizedTerm} ${dosage}`;
    }

    normalizedTerm = normalizedTerm.replace(/[^\w\s]/g, ' ');
    normalizedTerm = normalizedTerm.replace(/\s+/g, ' ').trim();

    return normalizedTerm;
  }

  private extractAllPricesFromHtml(htmlContent: string): number[] {
    try {
      const $ = load(htmlContent);
      const extractedPrices: number[] = [];

      const priceSelectorOptions = [
        '[class*="price"]',
        '[class*="preco"]',
        '[class*="valor"]',
        '[class*="Price"]',
        '[class*="Preco"]',
        '[class*="Valor"]',
        '[data-price]',
        '[data-valor]',
        '[data-price-value]',
        '.price',
        '.preco',
        '.valor',
        '.product-price',
        '.product-preco',
        '.product-valor',
        '[itemprop="price"]',
        '[itemprop="priceCurrency"]',
        '.price-value',
        '.preco-value',
        '.valor-produto',
        'span[class*="preco"]',
        'div[class*="preco"]',
        'p[class*="preco"]',
      ];

      for (const priceSelector of priceSelectorOptions) {
        $(priceSelector).each((_, htmlElement) => {
          const elementText = $(htmlElement).text().trim();
          const extractedPrice = this.extractPriceFromText(elementText);
          if (extractedPrice) {
            extractedPrices.push(extractedPrice);
          }
        });
      }

      const bodyTextContent = $('body').text();
      const allExtractedPrices = this.extractAllPricesFromText(bodyTextContent);
      extractedPrices.push(...allExtractedPrices);

      const validPrices = extractedPrices.filter(
        price => price >= 0.5 && price <= 10000,
      );
      return validPrices;
    } catch (error) {
      logger.error(
        'Erro ao extrair preços do HTML',
        {
          operation: 'price_search',
        },
        error as Error,
      );
      return [];
    }
  }

  private parsePriceFromHtml(htmlContent: string): number | null {
    const validPrices = this.extractAllPricesFromHtml(htmlContent);

    if (validPrices.length === 0) {
      logger.debug('Nenhum preço válido encontrado no HTML', {
        operation: 'price_search',
      });
      return null;
    }

    logger.debug('Preços encontrados (antes de filtrar outliers)', {
      operation: 'price_search',
      precos: validPrices.sort((a, b) => a - b).map(p => p.toFixed(2)),
    });

    const pricesWithoutOutliers = this.removeOutliersUsingIQR(validPrices);

    if (pricesWithoutOutliers.length === 0) {
      logger.warn('Todos os preços foram considerados outliers', {
        operation: 'price_search',
      });
      return null;
    }

    logger.debug('Preços após remoção de outliers', {
      operation: 'price_search',
      precos: pricesWithoutOutliers
        .sort((a, b) => a - b)
        .map(p => p.toFixed(2)),
    });

    const averagePrice =
      pricesWithoutOutliers.reduce((sum, price) => sum + price, 0) /
      pricesWithoutOutliers.length;
    logger.debug('Preço médio calculado', {
      operation: 'price_search',
      precoMedio: averagePrice.toFixed(2),
      quantidadeValidos: pricesWithoutOutliers.length,
    });
    return Math.round(averagePrice * 100) / 100;
  }

  private extractPriceFromText(textContent: string): number | null {
    const normalizedText = textContent.replace(/\s+/g, ' ');

    const priceRegexPatterns = [
      /a\s+partir\s+de\s*R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,
      /apartir\s+de\s*R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,
      /apartirdeR\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,
      /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/,
      /R\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,
      /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*reais?/i,
      /preço[:\s]+R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,
      /valor[:\s]+R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,
      /custo[:\s]+R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,
    ];

    for (const pricePattern of priceRegexPatterns) {
      const regexMatch = normalizedText.match(pricePattern);
      if (regexMatch && regexMatch[1]) {
        const priceString = regexMatch[1].replace(/\./g, '').replace(',', '.');
        const parsedPrice = parseFloat(priceString);
        if (!isNaN(parsedPrice) && parsedPrice > 0) {
          return parsedPrice;
        }
      }
    }

    return null;
  }

  private extractAllPricesFromText(textContent: string): number[] {
    const extractedPrices: number[] = [];

    const priceRegexPatterns = [
      /a\s+partir\s+de\s*R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi,
      /apartir\s+de\s*R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi,
      /apartirdeR\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi,
      /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/g,
      /R\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
      /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*reais?/gi,
      /preço[:\s]+R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi,
      /valor[:\s]+R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi,
      /custo[:\s]+R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi,
      /(\d{1,2},\d{2})\s*reais?/gi,
      /por\s+R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi,
    ];

    for (const pricePattern of priceRegexPatterns) {
      let regexMatch;
      while ((regexMatch = pricePattern.exec(textContent)) !== null) {
        if (regexMatch[1]) {
          const priceString = regexMatch[1]
            .replace(/\./g, '')
            .replace(',', '.');
          const parsedPrice = parseFloat(priceString);
          if (
            !isNaN(parsedPrice) &&
            parsedPrice >= 0.5 &&
            parsedPrice <= 10000
          ) {
            extractedPrices.push(parsedPrice);
          }
        }
      }
    }

    const uniquePrices = extractedPrices.filter(
      (price, index, priceArray) =>
        index ===
        priceArray.findIndex(otherPrice => Math.abs(otherPrice - price) < 0.01),
    );

    return uniquePrices.sort(
      (firstPrice, secondPrice) => firstPrice - secondPrice,
    );
  }

  async invalidatePriceCache(
    itemName: string,
    dosage?: string,
    itemType: 'medicine' | 'input' = 'medicine',
  ): Promise<void> {
    const cacheKey = this.getCacheKey(itemName, dosage, itemType);
    await this.cache.invalidate(cacheKey);
  }

  private removeOutliersUsingIQR(prices: number[]): number[] {
    if (prices.length === 0) {
      return [];
    }

    if (prices.length === 1) {
      return prices;
    }

    const sortedPrices = [...prices].sort((a, b) => a - b);
    const minPrice = sortedPrices[0];
    const maxPrice = sortedPrices[sortedPrices.length - 1];
    const medianIndex = Math.floor(sortedPrices.length * 0.5);
    const median = sortedPrices[medianIndex];

    logger.debug('Análise de outliers', {
      operation: 'price_search',
      precos: sortedPrices.map(p => p.toFixed(2)),
      min: minPrice.toFixed(2),
      max: maxPrice.toFixed(2),
      mediana: median.toFixed(2),
    });

    if (prices.length === 2) {
      const diff = Math.abs(sortedPrices[1] - sortedPrices[0]);
      const maxDiff = sortedPrices[0] * 3;

      if (diff > maxDiff) {
        logger.debug('Diferença muito grande entre preços, usando menor', {
          operation: 'price_search',
          preco: minPrice.toFixed(2),
        });
        return [minPrice];
      }
      return sortedPrices;
    }

    let filteredPrices = [...sortedPrices];

    if (sortedPrices.length >= 3) {
      const averageOfLowerHalf =
        sortedPrices
          .slice(0, Math.ceil(sortedPrices.length / 2))
          .reduce((sum, p) => sum + p, 0) / Math.ceil(sortedPrices.length / 2);
      const maxPriceRatio = maxPrice / median;

      logger.debug('Análise de outliers - estatísticas', {
        operation: 'price_search',
        mediaMetadeInferior: averageOfLowerHalf.toFixed(2),
        ratioMaximoMediana: maxPriceRatio.toFixed(2),
      });

      if (maxPriceRatio > 2.5) {
        filteredPrices = filteredPrices.filter(price => {
          const ratioToMedian = price / median;
          const ratioToLowerAvg = price / averageOfLowerHalf;

          const isOutlier = ratioToMedian > 3.0 || ratioToLowerAvg > 3.5;

          if (isOutlier) {
            logger.debug('Preço removido como outlier', {
              operation: 'price_search',
              preco: price.toFixed(2),
              ratioMediana: ratioToMedian.toFixed(2),
              ratioLowerAvg: ratioToLowerAvg.toFixed(2),
            });
            return false;
          }
          return true;
        });

        if (filteredPrices.length === 0) {
          logger.debug(
            'Todos os preços foram removidos no primeiro filtro, aplicando filtro mais permissivo',
            {
              operation: 'price_search',
            },
          );
          filteredPrices = sortedPrices.filter(price => {
            const ratioToLowerAvg = price / averageOfLowerHalf;
            const keep = ratioToLowerAvg <= 4.0;
            if (!keep) {
              logger.debug('Preço ainda muito alto', {
                operation: 'price_search',
                preco: price.toFixed(2),
                ratioToLowerAvg: ratioToLowerAvg.toFixed(2),
              });
            }
            return keep;
          });
        }

        if (filteredPrices.length === 0) {
          logger.warn(
            'Todos os preços foram removidos, usando média da metade inferior',
            {
              operation: 'price_search',
              preco: averageOfLowerHalf.toFixed(2),
            },
          );
          return [averageOfLowerHalf];
        }

        if (filteredPrices.length < sortedPrices.length) {
          const removed = sortedPrices.filter(p => !filteredPrices.includes(p));
          logger.debug('Outliers removidos', {
            operation: 'price_search',
            quantidadeRemovidos: removed.length,
            precosRemovidos: removed.map(p => p.toFixed(2)),
          });
        }
      }
    }

    if (filteredPrices.length <= 2) {
      return filteredPrices;
    }

    const q1Index = Math.floor(filteredPrices.length * 0.25);
    const q3Index = Math.floor(filteredPrices.length * 0.75);

    const q1 = filteredPrices[q1Index];
    const q3 = filteredPrices[q3Index];
    const iqr = q3 - q1;

    if (iqr === 0) {
      return filteredPrices;
    }

    const lowerBound = Math.max(0, q1 - 1.5 * iqr);
    const upperBound = q3 + 1.5 * iqr;

    logger.debug('Análise IQR', {
      operation: 'price_search',
      q1: q1.toFixed(2),
      q3: q3.toFixed(2),
      iqr: iqr.toFixed(2),
      limiteInferior: lowerBound.toFixed(2),
      limiteSuperior: upperBound.toFixed(2),
    });

    const finalFiltered = filteredPrices.filter(
      price => price >= lowerBound && price <= upperBound,
    );

    if (finalFiltered.length === 0) {
      const newMedian = filteredPrices[Math.floor(filteredPrices.length * 0.5)];
      logger.warn('IQR removeu todos, usando mediana', {
        operation: 'price_search',
        mediana: newMedian.toFixed(2),
      });
      return [newMedian];
    }

    const totalRemoved = sortedPrices.length - finalFiltered.length;

    if (totalRemoved > 0) {
      const removedAll = sortedPrices.filter(p => !finalFiltered.includes(p));
      logger.debug('Outliers removidos - resumo final', {
        operation: 'price_search',
        totalRemovidos: totalRemoved,
        precosRemovidos: removedAll.map(p => p.toFixed(2)),
        precosValidos: finalFiltered.map(p => p.toFixed(2)),
      });
    }

    return finalFiltered;
  }

  private async retryRequest(
    requestFn: () => Promise<any>,
    maxRetries: number = 3,
    delayMs: number = 1000,
  ): Promise<any> {
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error: any) {
        lastError = error;
        const isNetworkError =
          error.code === 'EAI_AGAIN' ||
          error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ECONNRESET' ||
          error.message?.includes('getaddrinfo') ||
          error.message?.includes('network') ||
          error.message?.includes('timeout');

        if (isNetworkError && attempt < maxRetries) {
          const waitTime = delayMs * Math.pow(2, attempt - 1);
          logger.warn('Erro de rede, tentando novamente', {
            operation: 'price_search',
            tentativa: attempt,
            maxTentativas: maxRetries,
            errorCode: error.code,
            waitTime: `${waitTime}ms`,
          });
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        if (attempt === maxRetries) {
          logger.error('Todas as tentativas falharam', {
            operation: 'price_search',
            maxTentativas: maxRetries,
            errorMessage: error.message || String(error.code) || String(error),
          });
          throw error;
        }
      }
    }

    throw lastError || new Error('Erro desconhecido na requisição');
  }
}
