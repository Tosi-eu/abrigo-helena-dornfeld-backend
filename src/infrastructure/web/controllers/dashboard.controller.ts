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
   */
  async getSummary(req: RlsRequest, res: Response) {
    try {
      const data = await this.service.getSummary(req.transaction);

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
}
