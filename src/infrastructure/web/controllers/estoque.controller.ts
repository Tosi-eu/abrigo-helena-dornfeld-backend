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

  async proportion(_req: Request, res: Response) {
    try {
      const data = await this.service.getProportion();

      const totalMedicineTypeGeral = Number(data.total_gerais || 0);
      const totalMedicineTypeIndividual = Number(data.total_individuais || 0);
      const totalInputs = Number(data.total_insumos || 0);

      const totalCarrinhoMedicamentos = Number(
        data.total_carrinho_medicamentos || 0,
      );
      const totalCarrinhoInsumos = Number(data.total_carrinho_insumos || 0);

      const totalGeral =
        totalMedicineTypeGeral +
        totalMedicineTypeIndividual +
        totalInputs +
        totalCarrinhoMedicamentos +
        totalCarrinhoInsumos;

      const pct = (v: number) =>
        totalGeral > 0 ? Number(((v / totalGeral) * 100).toFixed(2)) : 0;

      return res.json({
        percentuais: {
          medicamentos_geral: pct(totalMedicineTypeGeral),
          medicamentos_individual: pct(totalMedicineTypeIndividual),
          insumos: pct(totalInputs),
          carrinho_medicamentos: pct(totalCarrinhoMedicamentos),
          carrinho_insumos: pct(totalCarrinhoInsumos),
        },
        totais: {
          medicamentos_geral: totalMedicineTypeGeral,
          medicamentos_individual: totalMedicineTypeIndividual,
          insumos: totalInputs,
          carrinho_medicamentos: totalCarrinhoMedicamentos,
          carrinho_insumos: totalCarrinhoInsumos,
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

  async deleteStockItem(req: Request, res: Response) {
    try {
      const { estoque_id, tipo } = req.params;

      if (!estoque_id || !tipo) {
        return res.status(400).json({ error: 'Parâmetros inválidos' });
      }

      if (tipo !== 'medicamento' && tipo !== 'insumo') {
        return res.status(400).json({ error: 'Tipo inválido' });
      }

      const result = await this.service.deleteStockItem(
        Number(estoque_id),
        tipo,
      );

      return res.json(result);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }
}
