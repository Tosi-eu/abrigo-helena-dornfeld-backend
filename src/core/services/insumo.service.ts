import { InputRepository } from '../../infrastructure/database/repositories/insumo.repository';
import type { Input } from '@porto-sdk/sdk';
import type { IPriceSearchService } from './price-search.types';
import type { TenantConfigService } from './tenant-config.service';
import { logger } from '../../infrastructure/helpers/logger.helper';

export class InputService {
  constructor(
    private readonly repo: InputRepository,
    private readonly priceSearchService?: IPriceSearchService,
    private readonly tenantConfigService?: TenantConfigService,
  ) {}

  private triggerPriceSearchInBackground(input: Input) {
    setImmediate(async () => {
      try {
        const priceResult = await this.priceSearchService!.searchPrice(
          input.nome,
          'input',
        );

        if (priceResult?.averagePrice) {
          await this.repo.updateInputById(input.id!, {
            preco: priceResult.averagePrice,
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
      this.priceSearchService &&
      created.id &&
      (await this.isAutomaticPriceSearchEnabled(tenantId))
    ) {
      this.triggerPriceSearchInBackground(created);
    }

    return created;
  }

  private async isAutomaticPriceSearchEnabled(tenantId: number): Promise<boolean> {
    if (!this.tenantConfigService) return true;
    const cfg = await this.tenantConfigService.get(tenantId);
    return cfg.automatic_price_search !== false;
  }

  listPaginated(page: number = 1, limit: number = 10, name?: string) {
    return this.repo.listAllInputs(page, limit, name);
  }

  updateInput(id: number, data: Omit<Input, 'id'>) {
    if (!data.nome) throw new Error('Nome é obrigatório');
    return this.repo.updateInputById(id, data);
  }

  deleteInput(id: number) {
    return this.repo.deleteInputById(id);
  }
}
