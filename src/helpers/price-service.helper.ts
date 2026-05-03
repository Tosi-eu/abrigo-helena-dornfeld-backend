import * as fs from 'node:fs';
import type { IPriceSearchService } from '@services/price-search.types';
import { PricingApiClient } from '@services/clients/pricing-api.client';
import { tryGetSystemConfigRuntime } from '@config/system-config-runtime';
import { getBuiltinDefaultSystemConfig } from '@services/system-config.defaults';

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
  const svc = tryGetSystemConfigRuntime();
  if (svc) {
    const p = svc.get().pricing;
    return {
      url: normalizePricingBaseUrlForDocker(String(p.baseUrl ?? '').trim()),
      key: String(p.apiKey ?? '').trim(),
    };
  }
  const p = getBuiltinDefaultSystemConfig().pricing;
  return {
    url: normalizePricingBaseUrlForDocker(String(p.baseUrl ?? '').trim()),
    key: String(p.apiKey ?? '').trim(),
  };
}

export function getPriceSearchService(): IPriceSearchService | undefined {
  const { url, key } = resolvePricingPair();
  if (!url || !key) {
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
}
