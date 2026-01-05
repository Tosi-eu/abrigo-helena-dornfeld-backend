import { Request, Response } from 'express';
import { ReportService } from '../../../core/services/relatorio.service';
import { sendErrorResponse } from '../../helpers/error-response.helper';

export class ReportController {
  constructor(private readonly service: ReportService) {}

  async generate(req: Request, res: Response) {
    try {
      const type = req.query.type as string;
      if (!type) return res.status(400).json({ error: 'Tipo obrigatório' });

      const data = await this.service.generateReport(type);

      return res.json(data);
    } catch (error: unknown) {
      console.error('Erro ao gerar relatório:', error);
      
      return sendErrorResponse(res, 500, error, 'Erro ao gerar relatório');
    }
  }
}
