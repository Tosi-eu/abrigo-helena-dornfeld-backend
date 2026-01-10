import { Response } from 'express';
import { MedicineService } from '../../../core/services/medicamento.service';
import { ValidatedRequest } from '../../../middleware/validation.middleware';
import { sendErrorResponse } from '../../helpers/error-response.helper';
import { PriceSearchService } from '../../../core/services/price-search.service';
import { MedicineRepository } from '../../database/repositories/medicamento.repository';
import { InputRepository } from '../../database/repositories/insumo.repository';
import { cacheService } from '../../database/redis/client.redis';

export interface PaginationParams {
  page: number;
  limit: number;
}

export class MedicineController {
  private priceSearchService: PriceSearchService;

  constructor(private readonly service: MedicineService) {
    // Inicializa o serviço de busca de preços (pode ser otimizado para singleton)
    const medicineRepo = new MedicineRepository();
    const inputRepo = new InputRepository();
    this.priceSearchService = new PriceSearchService(cacheService, medicineRepo, inputRepo);
  }

  async create(req: ValidatedRequest, res: Response) {
    try {
      const data = await this.service.createMedicine(req.body);
      
      // Busca preço de forma assíncrona (não bloqueia a resposta)
      if (data.id && !req.body.preco) {
        // Usa setImmediate para executar após a resposta ser enviada
        setImmediate(async () => {
          try {
            await this.priceSearchService.updatePriceInDatabase(
              data.id!,
              data.nome,
              'medicine',
              data.dosagem,
              data.unidade_medida,
            );
          } catch (error) {
            // Log mas não quebra o fluxo
            console.error('Erro ao buscar preço assincronamente:', error);
          }
        });
      }

      res.status(201).json(data);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao criar medicamento');
    }
  }

  async getAll(req: ValidatedRequest, res: Response) {
    const { page, limit } = req.validated!;

    const list = await this.service.findAll({ page, limit });
    res.json(list);
  }

  async update(req: ValidatedRequest, res: Response) {
    const id = Number(req.params.id);
    try {
      const updated = await this.service.updateMedicine(id, req.body);
      if (!updated) return res.status(404).json({ error: 'Não encontrado' });
      res.json(updated);
    } catch (error: unknown) {
      return sendErrorResponse(
        res,
        400,
        error,
        'Erro ao atualizar medicamento',
      );
    }
  }

  async delete(req: ValidatedRequest, res: Response) {
    const id = Number(req.params.id);

    const ok = await this.service.deleteMedicine(id);

    if (!ok) {
      return res.status(404).json({ error: 'Não encontrado' });
    }

    return res.status(204).end();
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
