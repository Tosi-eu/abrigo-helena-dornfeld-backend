import { Response } from 'express';
import { InputService } from '../../../core/services/insumo.service';
import { ValidatedRequest } from '../../../middleware/validation.middleware';
import { sendErrorResponse } from '../../helpers/error-response.helper';

export class InsumoController {
  constructor(private readonly service: InputService) {}

  async create(req: ValidatedRequest, res: Response) {
    try {
      const created = await this.service.createInput(req.body);
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
}
