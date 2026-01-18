import { Request, Response } from 'express';
import {
  MovementPeriod,
  ReportService,
} from '../../../core/services/relatorio.service';
import { sendErrorResponse } from '../../helpers/error-response.helper';
import { handleETagResponse } from '../../helpers/etag.helper';
import { logger } from '../../helpers/logger.helper';

export class ReportController {
  constructor(private readonly service: ReportService) {}

  async generate(req: Request, res: Response) {
    try {
      const type = req.query.type as string;
      const periodo = req.query.periodo as MovementPeriod;
      const data = req.query.data as string | undefined;
      const data_inicial = req.query.data_inicial as string | undefined;
      const mes = req.query.mes as string | undefined;
      const data_final = req.query.data_final as string | undefined;

      if (!type) {
        return res.status(400).json({ error: 'Tipo obrigatório' });
      }

      const casela = req.query.casela
        ? parseInt(req.query.casela as string)
        : undefined;

      const result = await this.service.generateReport(type, {
        casela,
        periodo,
        data,
        mes,
        data_inicial,
        data_final,
      });

      if (handleETagResponse(req, res, result)) {
        return;
      }

      return res.json(result);
    } catch (error: unknown) {
      const type = req.query.type as string;
      logger.error(
        'Erro ao gerar relatório',
        { operation: 'report', reportType: type },
        error as Error,
      );

      return sendErrorResponse(res, 500, error, 'Erro ao gerar relatório');
    }
  }
}
