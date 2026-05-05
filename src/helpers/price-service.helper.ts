import * as fs from 'node:fs';
import type { IPriceSearchService } from '@services/price-search.types';
import { PricingApiClient } from '@services/clients/pricing-api.client';
import {
  tryGetSystemConfigRuntime,
  tryGetSystemConfigWorkerSnapshot,
} from '@config/system-config-runtime';
import { getBuiltinDefaultSystemConfig } from '@services/system-config.defaults';
import { logger } from '@helpers/logger.helper';

let cached: {
  url: string;
  key: string;
  client: PricingApiClient;
} | null = null;

function normalizePricingBaseUrlForDocker(url: string): string {
  const t = String(url ?? '').trim();
  if (!t) return t;
  if (process.env.PRICING_DISABLE_DOCKER_HOST_REMAP === '1') return t;
  let inDocker = false;
  try {
    inDocker = fs.existsSync('/.dockerenv');
  } catch {
    inDocker = false;
  }
  if (!inDocker) return t;

  try {
    const u = new URL(t);
    if (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') return t;
    const host =
      process.env.PRICING_SEARCH_DOCKER_HOST?.trim() || 'price-search';
    u.hostname = host;
    return u.toString().replace(/\/$/, '');
  } catch {
    return t;
  }
}

function resolvePricingPair(): { url: string; key: string } {
  const key = process.env.PRICING_API_KEY?.trim() ?? '';

  const envBase = process.env.PRICING_BASE_URL?.trim();
  if (envBase) {
    return {
      url: normalizePricingBaseUrlForDocker(envBase),
      key,
    };
  }

  const svc = tryGetSystemConfigRuntime();
  if (svc) {
    const baseUrl = normalizePricingBaseUrlForDocker(
      String(svc.get().pricing.baseUrl ?? '').trim(),
    );
    return { url: baseUrl, key };
  }

  const workerSnap = tryGetSystemConfigWorkerSnapshot();
  if (workerSnap) {
    const baseUrl = normalizePricingBaseUrlForDocker(
      String(workerSnap.pricing?.baseUrl ?? '').trim(),
    );
    return { url: baseUrl, key };
  }

  const p = getBuiltinDefaultSystemConfig().pricing;
  return {
    url: normalizePricingBaseUrlForDocker(String(p.baseUrl ?? '').trim()),
    key,
  };
}

export type PricingIntegrationGap =
  | { ok: true }
  | { ok: false; missingKey: boolean; missingUrl: boolean };

/** Estado da integração price-search (chave + URL resolvido). */
export function getPricingIntegrationGap(): PricingIntegrationGap {
  const { url, key } = resolvePricingPair();
  const missingKey = !key || key.length < 8;
  const missingUrl = !url;
  if (!missingKey && !missingUrl) return { ok: true };
  return {
    ok: false,
    missingKey,
    missingUrl,
  };
}

let lastMisconfigSignature: string | null = null;

export function getPriceSearchService(): IPriceSearchService | undefined {
  const { url, key } = resolvePricingPair();
  if (!url || !key || key.length < 8) {
    if (process.env.NODE_ENV !== 'test') {
      const sig = `k:${Boolean(key && key.length >= 8)}:u:${Boolean(url)}`;
      if (lastMisconfigSignature !== sig) {
        lastMisconfigSignature = sig;
        logger.error(
          '[pricing] Integração indisponível: verifique PRICING_API_KEY (mín. 8 caracteres) e URL (PRICING_BASE_URL ou config global pricing.baseUrl / worker snapshot).',
          {
            operation: 'get_price_search_service',
            hasKey: Boolean(key),
            keyLengthOk: key.length >= 8,
            hasUrl: Boolean(url),
          },
        );
      }
    }
    return undefined;
  }
  if (cached && cached.url === url && cached.key === key) {
    return cached.client;
  }
  cached = { url, key, client: new PricingApiClient(url, key) };
  return cached.client;
}

export function invalidatePriceSearchServiceCache(): void {
  cached = null;
  lastMisconfigSignature = null;
}
