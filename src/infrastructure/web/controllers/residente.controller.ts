import { Response } from 'express';
import { ResidentService } from '../../../core/services/residente.service';
import { ValidatedRequest } from '../../../middleware/validation.middleware';
import { sendErrorResponse } from '../../helpers/error-response.helper';
import { getErrorMessage } from '../../types/error.types';

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
    } catch (error: unknown) {
      return sendErrorResponse(res, 404, error, 'Residente não encontrado');
    }
  }

  async create(req: ValidatedRequest, res: Response) {
    try {
      const novo = await this.service.createResident(req.body);
      res.status(201).json(novo);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const status = message.includes('Já existe') ? 409 : 400;
      return sendErrorResponse(res, status, error, 'Erro ao criar residente');
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
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const status = message === 'Residente não encontrado' ? 404 : 400;
      return sendErrorResponse(
        res,
        status,
        error,
        'Erro ao atualizar residente',
      );
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
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao deletar residente');
    }
  }
}
