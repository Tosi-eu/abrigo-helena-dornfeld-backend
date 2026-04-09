import { Response } from 'express';
import { MovementService } from '@services/movimentacao.service';
import { ValidatedRequest } from '@middlewares/validation.middleware';
import { sendErrorResponse } from '@helpers/error-response.helper';
import { handleETagResponse } from '@helpers/etag.helper';
import { type TenantRequest } from '@middlewares/tenant.middleware';

export class MovementController {
  constructor(private readonly service: MovementService) {}

  async getMedicines(req: ValidatedRequest, res: Response, tenantId: number) {
    try {
      const days = Number(req.query.days) || 0;
      const type = req.query.type as string;
      const { page, limit } = req.validated || { page: 1, limit: 10 };

      const result = await this.service.findMedicineMovements({
        tenantId,
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

  async getInputs(req: ValidatedRequest, res: Response, tenantId: number) {
    try {
      const days = Number(req.query.days) || 0;
      const type = req.query.type as string;
      const { page, limit } = req.validated || { page: 1, limit: 10 };

      const result = await this.service.listInputMovements({
        tenantId,
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

  async create(
    req: ValidatedRequest & TenantRequest,
    res: Response,
    tenantId: number,
  ) {
    try {
      const data = await this.service.createMovement({
        ...req.body,
        tenant_id: tenantId,
      });
      res.status(201).json(data);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao criar movimentação');
    }
  }

  async getMedicineRanking(
    req: ValidatedRequest,
    res: Response,
    tenantId: number,
  ) {
    try {
      const type = (req.query.type as string) || 'more';
      const { page, limit } = req.validated || { page: 1, limit: 10 };

      const result = await this.service.getMedicineRanking({
        tenantId,
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

  async nonMovementMedications(
    req: ValidatedRequest,
    res: Response,
    tenantId: number,
  ) {
    try {
      const limit = Math.min(100, Number(req.query.limit) || 10);
      const result = await this.service.getNonMovementedMedicines(
        tenantId,
        limit,
      );

      if (handleETagResponse(req, res, result)) {
        return;
      }

      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(res, 500, error, 'Erro ao buscar medicamentos');
    }
  }

  async getPharmacyToNursingTransfers(
    req: ValidatedRequest,
    res: Response,
    tenantId: number,
  ) {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const { page, limit } = req.validated || { page: 1, limit: 10 };

      const result = await this.service.getPharmacyToNursingTransfers({
        tenantId,
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

  async getConsumption(req: ValidatedRequest, res: Response, tenantId: number) {
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
        tenantId,
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

  async getConsumptionByItem(
    req: ValidatedRequest,
    res: Response,
    tenantId: number,
  ) {
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
        tenantId,
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
