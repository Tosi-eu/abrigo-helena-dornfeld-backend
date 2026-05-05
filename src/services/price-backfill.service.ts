import { Prisma } from '@prisma/client';
import { withRlsContext } from '@repositories/rls.context';
import { getPriceSearchService } from '@helpers/price-service.helper';
import { normalizeDosage } from '@helpers/dosage.helper';
import { getRuntimeHttpConfig } from '@config/http/runtime-http-config';

/** Dump/import frequentemente usa 0 em vez de NULL para «sem preço». */
const DECIMAL_ZERO = new Prisma.Decimal(0);

function whereItemNeedsPrice(tenantId: number) {
  return {
    tenant_id: tenantId,
    OR: [{ preco: null }, { preco: { equals: DECIMAL_ZERO } }],
  };
}

function whereMedicamentoStillNeedsPrice(
  tenantId: number,
  id: number,
): Prisma.MedicamentoWhereInput {
  return {
    id,
    tenant_id: tenantId,
    OR: [{ preco: null }, { preco: { equals: DECIMAL_ZERO } }],
  };
}

function whereInsumoStillNeedsPrice(
  tenantId: number,
  id: number,
): Prisma.InsumoWhereInput {
  return {
    id,
    tenant_id: tenantId,
    OR: [{ preco: null }, { preco: { equals: DECIMAL_ZERO } }],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

const DEFAULT_BATCH = 40;
const DEFAULT_INTER_REQUEST_MS = 300;

export class PriceBackfillService {
  async backfillTenantOnce(
    tenantId: number,
    batch: number,
    perTenantMax: number,
  ): Promise<number> {
    if (!getPriceSearchService()) {
      return 0;
    }

    const interRequestMs =
      getRuntimeHttpConfig().concurrency.priceBackfill.interRequestDelayMs ||
      DEFAULT_INTER_REQUEST_MS;
    let afterFirstRequest = false;

    let processed = 0;
    while (processed < perTenantMax) {
      const remaining = perTenantMax - processed;
      const take = Math.max(1, Math.min(batch, remaining));

      const { meds, inputs } = await withRlsContext(
        { tenant_id: String(tenantId) },
        async tx => {
          const m = await tx.medicamento.findMany({
            where: whereItemNeedsPrice(tenantId),
            select: {
              id: true,
              nome: true,
              dosagem: true,
              unidade_medida: true,
            },
            orderBy: { id: 'asc' },
            take,
          });
          const i = await tx.insumo.findMany({
            where: whereItemNeedsPrice(tenantId),
            select: { id: true, nome: true },
            orderBy: { id: 'asc' },
            take,
          });
          return { meds: m, inputs: i };
        },
      );

      if (meds.length === 0 && inputs.length === 0) break;

      const medPrices = new Map<number, number>();
      for (const m of meds) {
        if (afterFirstRequest && interRequestMs > 0) {
          await sleep(interRequestMs);
        }
        afterFirstRequest = true;
        const dosageNorm = normalizeDosage(String(m.dosagem ?? '').trim());
        const result = await getPriceSearchService()!.searchPrice(
          m.nome,
          'medicine',
          dosageNorm,
          m.unidade_medida ?? undefined,
        );
        if (result?.averagePrice) {
          medPrices.set(m.id, result.averagePrice);
        }
      }

      const inputPrices = new Map<number, number>();
      for (const i of inputs) {
        if (afterFirstRequest && interRequestMs > 0) {
          await sleep(interRequestMs);
        }
        afterFirstRequest = true;
        const result = await getPriceSearchService()!.searchPrice(
          i.nome,
          'input',
        );
        if (result?.averagePrice) {
          inputPrices.set(i.id, result.averagePrice);
        }
      }

      if (medPrices.size > 0 || inputPrices.size > 0) {
        await withRlsContext({ tenant_id: String(tenantId) }, async tx => {
          for (const [id, preco] of medPrices) {
            await tx.medicamento.updateMany({
              where: whereMedicamentoStillNeedsPrice(tenantId, id),
              data: { preco },
            });
          }
          for (const [id, preco] of inputPrices) {
            await tx.insumo.updateMany({
              where: whereInsumoStillNeedsPrice(tenantId, id),
              data: { preco },
            });
          }
        });
      }

      processed += meds.length + inputs.length;
    }
    return processed;
  }

  runWithCronLimits(tenantId: number): Promise<number> {
    const pb = getRuntimeHttpConfig().concurrency.priceBackfill;
    const batch = pb.batch || DEFAULT_BATCH;
    const perTenantMax = pb.maxPerTenant || batch * 2;
    return this.backfillTenantOnce(tenantId, batch, perTenantMax);
  }
}
