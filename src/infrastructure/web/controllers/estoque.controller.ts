import { Request, Response } from "express";
import { EstoqueService } from "../../../core/services/estoque.service";

export class EstoqueController {
  constructor(private readonly service: EstoqueService) {}

    async entrada(req: Request, res: Response) {
      try {
        const { tipo } = req.body;

        if (tipo === "medicamento") {
          const result = await this.service.entradaMedicamento(req.body);
          return res.json(result);
        }

        if (tipo === "insumo") {
          const result = await this.service.entradaInsumo(req.body);
          return res.json(result);
        }

        return res.status(400).json({ error: "tipo inválido" });
      } catch (e: any) {
        return res.status(400).json({ error: e.message });
      }
    }

  async saida(req: Request, res: Response) {
    try {
      const result = await this.service.saida(req.body);
      return res.json(result);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async listar(req: Request, res: Response) {
    try {
      const { filter, type } = req.query;

      const data = await this.service.listarEstoque({
        filter: String(filter || ""),
        type: String(type || ""),
      });

      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async proporcao(_req: Request, res: Response) {
    try {
      const data = await this.service.obterProporcao();

      const totalMedicamentosGerais = Number(data.total_gerais || 0);
      const totalMedicamentosIndividuais = Number(data.total_individuais || 0);
      const totalInsumos = Number(data.total_insumos || 0);
      const totalMedicamentos = Number(data.total_medicamentos || 0);

      const totalGeral = totalMedicamentos + totalInsumos;

      const pct = (value: number) =>
        totalGeral > 0 ? Number(((value / totalGeral) * 100).toFixed(2)) : 0;

      return res.json({
        medicamentos_geral: pct(totalMedicamentosGerais),
        medicamentos_individual: pct(totalMedicamentosIndividuais),
        insumos: pct(totalInsumos),
        totais: {
          medicamentos_geral: totalMedicamentosGerais,
          medicamentos_individual: totalMedicamentosIndividuais,
          insumos: totalInsumos,
          total_geral: totalGeral,
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
}
