import axios, { AxiosError } from 'axios';
import type {
  IPriceSearchService,
  PriceSearchResult,
} from '../price-search.types';
import { logger } from '@helpers/logger.helper';
import { getRuntimeHttpConfig } from '@config/http/runtime-http-config';

interface PricingApiSearchResponse {
  averagePrice: number | null;
  source: string;
  lastUpdated: string | null;
  statusCode?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jitter(ms: number): number {
  const delta = ms * 0.2;
  return Math.max(0, Math.floor(ms - delta + Math.random() * delta * 2));
}

class GlobalRateGate {
  private chain: Promise<void> = Promise.resolve();
  private lastAt = 0;

  constructor(
    private readonly minIntervalMs: number,
    private readonly concurrency: number,
  ) {
    if (this.concurrency < 1) this.concurrency = 1;
    if (this.concurrency !== 1) this.concurrency = 1;
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const next = new Promise<void>(r => {
      release = r;
    });
    const prev = this.chain;
    this.chain = prev.then(() => next);

    await prev;
    try {
      const now = Date.now();
      const wait = Math.max(0, this.lastAt + this.minIntervalMs - now);
      if (wait > 0) await sleep(wait);
      this.lastAt = Date.now();
      return await fn();
    } finally {
      release();
    }
  }
}

export class PricingApiClient implements IPriceSearchService {
  private readonly base: string;
  private static gate: GlobalRateGate | null = null;

  static resetPricingGate(): void {
    PricingApiClient.gate = null;
  }

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
    const rt = getRuntimeHttpConfig();
    const minIntervalMs = rt.concurrency.pricingApi.minIntervalMs;
    const concurrency = rt.concurrency.pricingApi.parallel;
    if (!PricingApiClient.gate) {
      PricingApiClient.gate = new GlobalRateGate(minIntervalMs, concurrency);
    }

    const maxRetries = rt.retries.pricingApi.max;
    const baseBackoffMs = rt.retries.pricingApi.baseMs;
    const maxBackoffMs = rt.retries.pricingApi.maxMs;
    const searchUrl = `${this.base}/v1/search`;
    const requestContext = {
      searchUrl,
      itemName,
      itemType,
      dosage: dosage ?? null,
      measurementUnit: measurementUnit ?? null,
    };

    const runOnce = async (): Promise<PricingApiSearchResponse> => {
      const { data } = await axios.post<PricingApiSearchResponse>(
        searchUrl,
        { itemName, itemType, dosage, measurementUnit },
        {
          timeout: this.timeoutMs,
          headers: {
            'Content-Type': 'application/json',
            'X-Pricing-API-Key': this.apiKey,
          },

          validateStatus: status =>
            (status >= 200 && status < 300) || status === 429,
        },
      );
      return data;
    };

    const callWithRetry =
      async (): Promise<PricingApiSearchResponse | null> => {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const data = await PricingApiClient.gate!.schedule(runOnce);

            if (data?.statusCode === 429) {
              throw new Error('429');
            }
            return data;
          } catch (err) {
            const axiosErr = err as AxiosError | Error;
            const status =
              axiosErr instanceof AxiosError
                ? axiosErr.response?.status
                : undefined;
            const is429 =
              status === 429 || String(axiosErr.message ?? '').includes('429');
            const isRetryable =
              is429 || (status != null && status >= 500) || status == null;

            if (!isRetryable || attempt >= maxRetries) {
              logger.error(
                'Falha ao chamar porto-api-price-search',
                {
                  operation: 'pricing_api',
                  status,
                  attempt,
                  ...requestContext,
                },
                err as Error,
              );
              return null;
            }

            const backoff = Math.min(
              maxBackoffMs,
              baseBackoffMs * Math.pow(2, attempt),
            );
            await sleep(jitter(backoff));
          }
        }
        return null;
      };

    const data = await callWithRetry();
    if (!data) return null;

    if (data.averagePrice == null || data.lastUpdated == null) {
      logger.warn('No price found in any source', {
        operation: 'pricing_api',
        reason:
          data.averagePrice == null && data.lastUpdated == null
            ? 'no_price_and_no_update_time'
            : data.averagePrice == null
              ? 'no_price'
              : 'no_update_time',
        ...requestContext,
        responseSource: data.source ?? null,
        responseAveragePrice: data.averagePrice,
        responseLastUpdated: data.lastUpdated,
      });
      return null;
    }

    return {
      averagePrice: data.averagePrice,
      source: data.source,
      lastUpdated: new Date(data.lastUpdated),
    };
  }
}
