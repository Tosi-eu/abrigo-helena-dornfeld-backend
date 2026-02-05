import { InputRepository } from '../../infrastructure/database/repositories/insumo.repository';
import { Input } from '../domain/insumo';
import { PriceSearchService } from './price-search.service';
import { logger } from '../../infrastructure/helpers/logger.helper';

export class InputService {
  constructor(
    private readonly repo: InputRepository,
    private readonly priceSearchService?: PriceSearchService,
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

  async createInput(data: Omit<Input, 'id'>) {
    if (!data.nome) throw new Error('Nome é obrigatório');

    const created = await this.repo.createInput(data);

    if (this.priceSearchService && created.id) {
      this.triggerPriceSearchInBackground(created);
    }

    return created;
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
