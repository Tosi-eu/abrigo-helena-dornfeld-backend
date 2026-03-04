import { Response } from 'express';
import { DashboardService } from '../../../core/services/dashboard.service';
import { sendErrorResponse } from '../../helpers/error-response.helper';
import { handleETagResponse } from '../../helpers/etag.helper';
import type { RlsRequest } from '../../../middleware/rls.middleware';

export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  /**
   * Single endpoint for dashboard data. Replaces multiple frontend requests
   * with one aggregated response for better performance and scalability.
   * Query: expiringDays (optional) – number of days for "expiring soon" count (default 45).
   */
  async getSummary(req: RlsRequest, res: Response) {
    try {
      const expiringDays = req.query.expiringDays
        ? Number(req.query.expiringDays)
        : undefined;
      const data = await this.service.getSummary(req.transaction, expiringDays);

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

  /** GET /dashboard/expiring-items?days=30&page=1&limit=50 */
  async getExpiringItems(req: RlsRequest, res: Response) {
    try {
      const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const data = await this.service.getExpiringItems(
        days,
        page,
        limit,
        req.transaction,
      );
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
