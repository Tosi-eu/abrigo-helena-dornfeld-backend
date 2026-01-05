import { Response } from 'express';
import { ResidentService } from '../../../core/services/residente.service';
import { ValidatedRequest } from '../../../middleware/validation.middleware';

export class ResidentController {
  constructor(private readonly service: ResidentService) {}

  async findAll(req: ValidatedRequest, res: Response) {
    const { page, limit } = req.validated!;

    const result = await this.service.findAll(page, limit);

    res.json({
      data: result.data,
      page,
      limit,
      hasNext: result.hasNext,
    });
  }

  async findByCasela(req: ValidatedRequest, res: Response) {
    const casela = Number(req.params.casela);

    try {
      const residente = await this.service.findByCasela(casela);
      res.json(residente);
    } catch (e: any) {
      res.status(404).json({ error: e.message });
    }
  }

  async create(req: ValidatedRequest, res: Response) {
    try {
      const novo = await this.service.createResident(req.body);
      res.status(201).json(novo);
    } catch (e: any) {
      const status = e.message.includes('Já existe') ? 409 : 400;
      res.status(status).json({ error: e.message });
    }
  }

  async update(req: ValidatedRequest, res: Response) {
    const casela = Number(req.params.casela);
    try {
      const updated = await this.service.updateResident({
        casela,
        nome: req.body.nome,
      });
      res.json(updated);
    } catch (e: any) {
      const status = e.message === 'Residente não encontrado' ? 404 : 400;
      res.status(status).json({ error: e.message });
    }
  }

  async delete(req: ValidatedRequest, res: Response) {
    const casela = Number(req.params.casela);

    try {
      const deleted = await this.service.deleteResident(casela);

      if (!deleted) {
        return res.status(404).json({ error: 'Residente não encontrado' });
      }
      return res.status(204).end();
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
}
