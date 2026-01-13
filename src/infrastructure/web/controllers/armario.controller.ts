import { CabinetService } from '../../../core/services/armario.service';
import { Request, Response } from 'express';
import { sendErrorResponse } from '../../helpers/error-response.helper';

export class CabinetController {
  constructor(private readonly service: CabinetService) {}

  async create(req: Request, res: Response) {
    try {
      const data = await this.service.createCabinet(req.body);
      return res.status(201).json(data);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao criar armário');
    }
  }

  async getAll(req: Request, res: Response) {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;

    const result = await this.service.findAll(page, limit);

    return res.json(result);
  }

  async getById(req: Request, res: Response) {
    const number = Number(req.params.numero);
    const cabinet = await this.service.findCabinetByNumber(number);

    if (!cabinet) {
      return res.status(404).json({ error: 'Armário não encontrado' });
    }

    return res.json(cabinet);
  }

  async update(req: Request, res: Response) {
    try {
      const number = Number(req.params.numero);
      const category = req.body.categoria_id;

      const updated = await this.service.updateCabinet(number, category);

      if (!updated) {
        return res.status(404).json({ error: 'Armário não encontrado' });
      }

      return res.json(updated);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao atualizar armário');
    }
  }

  async delete(req: Request, res: Response) {
    const number = Number(req.params.numero);

    try {
      const deleted = await this.service.removeCabinet(number);

      if (!deleted) {
        return res.status(404).json({ error: 'Armário não encontrado' });
      }

      return res.status(204).end();
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao deletar armário');
    }
  }
}
