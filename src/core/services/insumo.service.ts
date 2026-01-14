import { InputRepository } from '../../infrastructure/database/repositories/insumo.repository';
import { Input } from '../domain/insumo';
import { PriceSearchService } from './price-search.service';
import { logger } from '../../infrastructure/helpers/logger.helper';

export class InputService {
  constructor(
    private readonly repo: InputRepository,
    private readonly priceSearchService?: PriceSearchService,
  ) {}

  async createInput(data: Omit<Input, 'id'>) {
    if (!data.nome) throw new Error('Nome é obrigatório');
    const created = await this.repo.createInput(data);

    if (this.priceSearchService && created.id) {
      try {
        const priceResult = await this.priceSearchService.updatePriceInDatabase(
          created.id,
          data.nome,
          'input',
        );

        if (priceResult.found && priceResult.price) {
          const updated = await this.repo.updateInputById(created.id, {
            ...created,
            preco: priceResult.price,
          });
          if (updated) return updated;
        }
      } catch (error) {
        logger.error('Erro ao buscar preço automaticamente', {
          operation: 'create_input',
          inputId: created.id,
          nome: data.nome,
        }, error as Error);
      }
    }

    return created;
  }

  listPaginated(page: number = 1, limit: number = 10) {
    return this.repo.listAllInputs(page, limit);
  }

  updateInput(id: number, data: Omit<Input, 'id'>) {
    if (!data.nome) throw new Error('Nome é obrigatório');
    return this.repo.updateInputById(id, data);
  }

  deleteInput(id: number) {
    return this.repo.deleteInputById(id);
  }
}
