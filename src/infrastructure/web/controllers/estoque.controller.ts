import { Request, Response } from 'express';
import { StockService } from '../../../core/services/estoque.service';

export class StockController {
  constructor(private readonly service: StockService) {}

  async stockIn(req: Request, res: Response) {
    try {
      const { medicamento_id, insumo_id } = req.body;

      if (medicamento_id) {
        const result = await this.service.medicineStockIn(req.body);
        return res.json(result);
      }

      if (insumo_id) {
        const result = await this.service.inputStockIn(req.body);
        return res.json(result);
      }
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async stockOut(req: Request, res: Response) {
    try {
      const result = await this.service.stockOut(req.body);
      return res.json(result);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async list(req: Request, res: Response) {
    try {
      const { filter, type, page, limit } = req.query;

      const data = await this.service.listStock({
        filter: String(filter || ''),
        type: String(type || ''),
        page: Number(page) || 1,
        limit: Number(limit) || 10,
      });

      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async proportion(req: Request, res: Response) {
    try {
      const { setor } = req.query as { setor?: 'farmacia' | 'enfermagem' };

      if (!setor) {
        return res.status(400).json({
          error: 'Query param "setor" é obrigatório (farmacia ou enfermagem)',
        });
      }

      const data = await this.service.getProportion(setor);

      const totalGeral = Object.values(data).reduce(
        (acc, v) => acc + Number(v || 0),
        0,
      );

      const pct = (v: number) =>
        totalGeral > 0 ? Number(((v / totalGeral) * 100).toFixed(2)) : 0;

      return res.json({
        percentuais: {
          medicamentos_geral: pct(data.medicamentos_geral),
          medicamentos_individual: pct(data.medicamentos_individual),
          insumos: pct(data.insumos),
          carrinho_medicamentos: pct(data.carrinho_medicamentos),
          carrinho_insumos: pct(data.carrinho_insumos),
        },
        totais: {
          ...data,
          total_geral: totalGeral,
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async removeIndividualMedicine(req: Request, res: Response) {
    try {
      const { estoque_id } = req.params;

      if (!estoque_id) {
        return res.status(400).json({ error: 'Estoque inválido' });
      }

      const result = await this.service.removeIndividualMedicine(
        Number(estoque_id),
      );

      return res.json(result);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async suspendIndividualMedicine(req: Request, res: Response) {
    try {
      const { estoque_id } = req.params;

      if (!estoque_id) {
        return res.status(400).json({ error: 'Estoque inválido' });
      }

      const result = await this.service.suspendIndividualMedicine(
        Number(estoque_id),
      );

      return res.json(result);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async resumeIndividualMedicine(req: Request, res: Response) {
    try {
      const { estoqueId } = req.params;

      if (!estoqueId) {
        return res.status(400).json({ error: 'Estoque inválido' });
      }

      const result = await this.service.resumeIndividualMedicine(
        Number(estoqueId),
      );

      return res.json(result);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }
}
