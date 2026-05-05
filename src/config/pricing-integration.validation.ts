import { getPricingIntegrationGap } from '@helpers/price-service.helper';
import { logger } from '@helpers/logger.helper';

/**
 * Depois de `system_config` estar disponível (API ou snapshot no worker).
 * Falha o processo se faltar chave ou URL, salvo `ALLOW_MISSING_PRICING=1`.
 */
export function assertPricingIntegrationComplete(): void {
  if (process.env.NODE_ENV === 'test') return;
  if (process.env.ALLOW_MISSING_PRICING === '1') {
    logger.warn(
      '[pricing] ALLOW_MISSING_PRICING=1 — integração price-search não validada; busca de preços pode falhar.',
      { operation: 'pricing_integration_assert' },
    );
    return;
  }

  const gap = getPricingIntegrationGap();
  if (gap.ok) return;

  const parts: string[] = [];
  if (gap.missingKey) {
    parts.push(
      'PRICING_API_KEY no ambiente (mín. 8 caracteres, igual ao serviço price-search)',
    );
  }
  if (gap.missingUrl) {
    parts.push(
      'URL do price-search: PRICING_BASE_URL ou campo «URL base» em Configuração global → pricing (persistido em runtime.pricing.base_url)',
    );
  }

  logger.error(
    `[pricing] Configuração obrigatória em falta: ${parts.join('; ')}. Em desenvolvimento pode usar ALLOW_MISSING_PRICING=1.`,
    {
      operation: 'pricing_integration_assert',
      missingKey: gap.missingKey,
      missingUrl: gap.missingUrl,
    },
  );
  process.exit(1);
}
