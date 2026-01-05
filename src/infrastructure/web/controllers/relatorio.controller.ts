import { Request, Response } from 'express';
import { ReportService } from '../../../core/services/relatorio.service';

export class ReportController {
  constructor(private readonly service: ReportService) {}

  async generate(req: Request, res: Response) {
    try {
      const type = req.query.type as string;
      if (!type) return res.status(400).json({ error: 'Tipo obrigatório' });

      const data = await this.service.generateReport(type);

      return res.json(data);
    } catch (e: any) {
      // Log full error details server-side only
      console.error('Erro ao gerar relatório:', e);
      
      // Don't expose internal error details
      const isProduction = process.env.NODE_ENV === 'production';
      const errorMessage = isProduction
        ? 'Erro ao gerar relatório'
        : e.message || 'Erro ao gerar relatório';
      
      return res.status(500).json({ error: errorMessage });
    }
  }
}
