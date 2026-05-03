import type { PrismaInputRepository } from '@repositories/insumo.repository';
import type { Input } from '@stokio/sdk';
import { withRlsContext } from '@repositories/rls.context';
import type { TenantConfigService } from './tenant-config.service';
import { getPriceSearchService } from '@helpers/price-service.helper';
import { logger } from '@helpers/logger.helper';

export class InputService {
  constructor(
    private readonly repo: PrismaInputRepository,
    private readonly tenantConfigService?: TenantConfigService,
  ) {}

  private triggerPriceSearchInBackground(tenantId: number, input: Input) {
    setImmediate(async () => {
      try {
        const search = getPriceSearchService();
        if (!search) return;
        const inputId = input.id;
        if (inputId == null) return;

        const priceResult = await search.searchPrice(input.nome, 'input');

        if (priceResult?.averagePrice) {
          await withRlsContext({ tenant_id: String(tenantId) }, async tx => {
            await tx.insumo.updateMany({
              where: { id: inputId, tenant_id: tenantId },
              data: { preco: priceResult.averagePrice },
            });
          });
        }
      } catch (error) {
        logger.error(
          'Erro ao buscar preço em background',
          {
            operation: 'background_price_search',
            inputId: input.id,
            nome: input.nome,
          },
          error as Error,
        );
      }
    });
  }

  async createInput(tenantId: number, data: Omit<Input, 'id'>) {
    if (!data.nome) throw new Error('Nome é obrigatório');

    const created = await this.repo.createInput(data, tenantId);

    if (
      getPriceSearchService() &&
      created.id &&
      (await this.isAutomaticPriceSearchEnabled(tenantId))
    ) {
      this.triggerPriceSearchInBackground(tenantId, created);
    }

    return created;
  }

  private async isAutomaticPriceSearchEnabled(
    tenantId: number,
  ): Promise<boolean> {
    if (!this.tenantConfigService) return true;
    const cfg = await this.tenantConfigService.get(tenantId);
    return cfg.automatic_price_search !== false;
  }

  listPaginated(
    tenantId: number,
    page: number = 1,
    limit: number = 10,
    name?: string,
  ) {
    return this.repo.listAllInputs(tenantId, page, limit, name);
  }

  updateInput(tenantId: number, id: number, data: Omit<Input, 'id'>) {
    if (!data.nome) throw new Error('Nome é obrigatório');
    return this.repo.updateInputById(tenantId, id, data);
  }

  deleteInput(tenantId: number, id: number) {
    return this.repo.deleteInputById(tenantId, id);
  }
}
