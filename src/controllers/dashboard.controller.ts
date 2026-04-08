import { Response } from 'express';
import { DashboardService } from '@services/dashboard.service';
import { sendErrorResponse } from '@helpers/error-response.helper';
import { handleETagResponse } from '@helpers/etag.helper';
import type { Request } from 'express';

export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  async getSummary(req: Request, res: Response, tenantId: number) {
    try {
      const expiringDays = req.query.expiringDays
        ? Number(req.query.expiringDays)
        : undefined;
      const data = await this.service.getSummary(tenantId, expiringDays);

      if (handleETagResponse(req, res, data)) {
        return;
      }

      return res.json(data);
    } catch (error: unknown) {
      return sendErrorResponse(
        res,
        500,
        error,
        'Erro ao carregar resumo do dashboard',
      );
    }
  }

  async getExpiringItems(req: Request, res: Response) {
    try {
      const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const data = await this.service.getExpiringItems(days, page, limit);
      return res.json(data);
    } catch (error: unknown) {
      return sendErrorResponse(
        res,
        500,
        error,
        'Erro ao carregar itens próximos ao vencimento',
      );
    }
  }
}
