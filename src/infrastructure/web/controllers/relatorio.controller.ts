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

      if (type === 'movimentacoes') {
        if (!periodo) {
          return res.status(400).json({
            error: 'Período é obrigatório para relatório de movimentações',
          });
        }
        if (periodo === MovementPeriod.MENSAL && !mes) {
          return res.status(400).json({
            error: 'Mês é obrigatório para relatório de movimentações mensais',
          });
        }
        if (periodo === MovementPeriod.DIARIO && !data) {
          return res.status(400).json({
            error: 'Data é obrigatória para relatório de movimentações diárias',
          });
        }
        if (
          periodo === MovementPeriod.INTERVALO &&
          (!data_inicial || !data_final)
        ) {
          return res.status(400).json({
            error:
              'Data inicial e final são obrigatórias para relatório de movimentações por intervalo',
          });
        }
      }

      if (type === 'transferencias') {
        if (!data && (!data_inicial || !data_final)) {
          return res.status(400).json({
            error:
              'Informe uma data ou um intervalo para transferências',
          });
        }
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

      const body =
        type === 'movimentacoes' && periodo
          ? { data: result, _reportMeta: { period: periodo } }
          : result;

      if (handleETagResponse(req, res, body)) {
        return;
      }

      return res.json(body);
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
