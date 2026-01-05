import { Response } from 'express';
import { MedicineService } from '../../../core/services/medicamento.service';
import { ValidatedRequest } from '../../../middleware/validation.middleware';
import { sendErrorResponse } from '../../helpers/error-response.helper';

export interface PaginationParams {
  page: number;
  limit: number;
}

export class MedicineController {
  constructor(private readonly service: MedicineService) {}

  async create(req: ValidatedRequest, res: Response) {
    try {
      const data = await this.service.createMedicine(req.body);
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
      return sendErrorResponse(res, 400, error, 'Erro ao atualizar medicamento');
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
}
