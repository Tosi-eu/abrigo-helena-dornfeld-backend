import { Request, Response } from "express";
import { InputService } from "../../../core/services/insumo.service";

export class InsumoController {
  constructor(private readonly service: InputService) {}

  async create(req: Request, res: Response) {
    try {
      const created = await this.service.createInput(req.body);
      return res.status(201).json(created);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async list(req: Request, res: Response) {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const list = await this.service.listPaginated(page, limit);
    return res.json(list);
  }

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const updated = await this.service.updateInput(id, req.body);

      if (!updated) {
        return res.status(404).json({ error: "Não encontrado" });
      }

      return res.json(updated);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    const ok = await this.service.deleteInput(id);

    if (!ok) return res.status(404).json({ error: "Não encontrado" });

    return res.sendStatus(204);
  }
}
