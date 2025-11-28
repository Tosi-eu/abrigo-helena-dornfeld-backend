import { Request, Response } from "express";
import { StockService } from "../../../core/services/estoque.service";

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
      const { filter, type } = req.query;

      const data = await this.service.listStock({
        filter: String(filter || ""),
        type: String(type || ""),
      });

      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async proportion(_req: Request, res: Response) {
    try {
      const data = await this.service.getProportion();

      const totalOverallMedicines = Number(data.total_gerais || 0);
      const totalInvidualMedicines = Number(data.total_individuais || 0);
      const totalInputsRaw = Number(data.total_insumos || 0);
      const totalMedicinesRaw = Number(data.total_medicamentos || 0);

      const totalGeral = totalMedicinesRaw + totalInputsRaw;

      const pct = (value: number) =>
        totalGeral > 0 ? Number(((value / totalGeral) * 100).toFixed(2)) : 0;

      return res.json({
        medicamentos_geral: pct(totalOverallMedicines),
        medicamentos_individual: pct(totalInvidualMedicines),
        insumos: pct(totalInputsRaw),
        totais: {
          medicamentos_geral: totalOverallMedicines,
          medicamentos_individual: totalInvidualMedicines,
          insumos: totalInputsRaw,
          total_geral: totalGeral,
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
}
