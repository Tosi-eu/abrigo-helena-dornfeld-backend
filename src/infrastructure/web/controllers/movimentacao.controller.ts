import { Response } from 'express';
import { MovementService } from '../../../core/services/movimentacao.service';
import { ValidatedRequest } from '../../../middleware/validation.middleware';
import { sendErrorResponse } from '../../helpers/error-response.helper';
import { handleETagResponse } from '../../helpers/etag.helper';

export class MovementController {
  constructor(private readonly service: MovementService) {}

  async getMedicines(req: ValidatedRequest, res: Response) {
    try {
      const days = Number(req.query.days) || 0;
      const type = req.query.type as string;
      const { page, limit } = req.validated || { page: 1, limit: 10 };

      const result = await this.service.findMedicineMovements({
        days,
        type,
        page,
        limit,
      });

      if (handleETagResponse(req, res, result)) {
        return;
      }

      res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(res, 500, error, 'Erro ao buscar movimentações');
    }
  }

  async getInputs(req: ValidatedRequest, res: Response) {
    try {
      const days = Number(req.query.days) || 0;
      const type = req.query.type as string;
      const { page, limit } = req.validated || { page: 1, limit: 10 };

      const result = await this.service.listInputMovements({
        days,
        type,
        page,
        limit,
      });

      if (handleETagResponse(req, res, result)) {
        return;
      }

      res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(res, 500, error, 'Erro ao buscar movimentações');
    }
  }

  async create(req: ValidatedRequest, res: Response) {
    try {
      const data = await this.service.createMovement(req.body);
      res.status(201).json(data);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao criar movimentação');
    }
  }

  async getMedicineRanking(req: ValidatedRequest, res: Response) {
    try {
      const type = (req.query.type as string) || 'more';
      const { page, limit } = req.validated || { page: 1, limit: 10 };

      const result = await this.service.getMedicineRanking({
        type,
        page,
        limit,
      });

      if (handleETagResponse(req, res, result)) {
        return;
      }

      res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(res, 500, error, 'Erro ao buscar ranking');
    }
  }

  async nonMovementMedications(req: ValidatedRequest, res: Response) {
    try {
      const limit = Math.min(100, Number(req.query.limit) || 10);
      const result = await this.service.getNonMovementedMedicines(limit);

      if (handleETagResponse(req, res, result)) {
        return;
      }

      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(res, 500, error, 'Erro ao buscar medicamentos');
    }
  }

  async getPharmacyToNursingTransfers(req: ValidatedRequest, res: Response) {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const { page, limit } = req.validated || { page: 1, limit: 10 };

      const result = await this.service.getPharmacyToNursingTransfers({
        startDate,
        endDate,
        page,
        limit,
      });

      if (handleETagResponse(req, res, result)) {
        return;
      }

      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(
        res,
        500,
        error,
        'Erro ao buscar transferências',
      );
    }
  }

  /** GET /movimentacoes/consumo?start=YYYY-MM-DD&end=YYYY-MM-DD&groupBy=month|quarter */
  async getConsumption(req: ValidatedRequest, res: Response) {
    try {
      const start = req.query.start as string;
      const end = req.query.end as string;
      const groupBy = ((req.query.groupBy as string) || 'month') as
        | 'month'
        | 'quarter';
      if (!start || !end) {
        return res.status(400).json({
          error: 'Parâmetros start e end (YYYY-MM-DD) são obrigatórios.',
        });
      }
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        return res.status(400).json({ error: 'Datas inválidas.' });
      }
      const result = await this.service.getConsumptionByPeriod(
        startDate,
        endDate,
        groupBy === 'quarter' ? 'quarter' : 'month',
      );
      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(
        res,
        500,
        error,
        'Erro ao buscar consumo por período',
      );
    }
  }

  async getConsumptionByItem(req: ValidatedRequest, res: Response) {
    try {
      const start = req.query.start as string;
      const end = req.query.end as string;
      if (!start || !end) {
        return res.status(400).json({
          error: 'Parâmetros start e end (YYYY-MM-DD) são obrigatórios.',
        });
      }
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        return res.status(400).json({ error: 'Datas inválidas.' });
      }
      const result = await this.service.getConsumptionByItem(
        startDate,
        endDate,
      );
      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(
        res,
        500,
        error,
        'Erro ao buscar consumo por item',
      );
    }
  }
}
