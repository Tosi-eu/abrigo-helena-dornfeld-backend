import { Request, Response } from "express";
import { RelatorioService } from "../../../core/services/relatorio.service";

export class RelatorioController {
  constructor(private readonly service: RelatorioService) {}

  async gerar(req: Request, res: Response) {
    try {
      const tipo = req.query.tipo as string;
      if (!tipo) return res.status(400).json({ error: "Tipo obrigatório" });

      const dados = await this.service.gerar(tipo);

      return res.json(dados);
    } catch (e: any) {
      console.error("Erro ao gerar relatório:", e);
      return res.status(500).json({ error: e.message });
    }
  }
}
