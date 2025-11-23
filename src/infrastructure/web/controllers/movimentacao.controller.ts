import { Request, Response } from "express";
import { MovimentacaoService } from "../../../core/services/movimentacao.service";

export class MovimentacaoController {
  constructor(private readonly service: MovimentacaoService) {}

  async getMedicamentos(req: Request, res: Response) {
    try {
      const days = Number(req.query.days) || 0;
      const type = req.query.type as string;

      const lista = await this.service.listarMovMedicamentos(days, type);
      res.json(lista);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getInsumos(req: Request, res: Response) {
    try {
      const days = Number(req.query.days) || 0;

      const lista = await this.service.listarMovInsumos(days);
      res.json(lista);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const novo = await this.service.registrar(req.body);
      res.status(201).json(novo);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
}
