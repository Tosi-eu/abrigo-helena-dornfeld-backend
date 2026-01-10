import { Response } from 'express';
import { InputService } from '../../../core/services/insumo.service';
import { ValidatedRequest } from '../../../middleware/validation.middleware';
import { sendErrorResponse } from '../../helpers/error-response.helper';
import { PriceSearchService } from '../../../core/services/price-search.service';
import { InputRepository } from '../../database/repositories/insumo.repository';
import { MedicineRepository } from '../../database/repositories/medicamento.repository';
import { cacheService } from '../../database/redis/client.redis';

export class InsumoController {
  private priceSearchService: PriceSearchService;

  constructor(private readonly service: InputService) {
    // Inicializa o serviço de busca de preços
    const medicineRepo = new MedicineRepository();
    const inputRepo = new InputRepository();
    this.priceSearchService = new PriceSearchService(cacheService, medicineRepo, inputRepo);
  }

  async create(req: ValidatedRequest, res: Response) {
    try {
      const created = await this.service.createInput(req.body);
      
      // Busca preço de forma assíncrona (não bloqueia a resposta)
      if (created.id && !req.body.preco) {
        setImmediate(async () => {
          try {
            await this.priceSearchService.updatePriceInDatabase(
              created.id!,
              created.nome,
              'input',
            );
          } catch (error) {
            console.error('Erro ao buscar preço assincronamente:', error);
          }
        });
      }

      return res.status(201).json(created);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao criar insumo');
    }
  }

  async list(req: ValidatedRequest, res: Response) {
    const { page, limit } = req.validated!;

    const list = await this.service.listPaginated(page, limit);
    return res.json(list);
  }

  async update(req: ValidatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const updated = await this.service.updateInput(id, req.body);

      if (!updated) {
        return res.status(404).json({ error: 'Não encontrado' });
      }

      return res.json(updated);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao atualizar insumo');
    }
  }

  async delete(req: ValidatedRequest, res: Response) {
    const id = Number(req.params.id);
    const ok = await this.service.deleteInput(id);

    if (!ok) return res.status(404).json({ error: 'Não encontrado' });

    return res.sendStatus(204);
  }

  async updatePrice(req: ValidatedRequest, res: Response) {
    const id = Number(req.params.id);
    const { preco } = req.body;

    if (preco !== null && preco !== undefined && (typeof preco !== 'number' || isNaN(preco))) {
      return res.status(400).json({ error: 'Preço deve ser um número válido ou null' });
    }

    try {
      const updated = await this.service.updatePrice(id, preco ?? null);
      if (!updated) return res.status(404).json({ error: 'Não encontrado' });
      res.json({ message: 'Preço atualizado com sucesso' });
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao atualizar preço');
    }
  }
}
