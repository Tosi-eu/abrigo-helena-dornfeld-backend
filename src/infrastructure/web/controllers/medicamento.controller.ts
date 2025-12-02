import { Request, Response } from "express";
import { MedicineService } from "../../../core/services/medicamento.service";

export interface PaginationParams {
  page: number;
  limit: number;
}

export class MedicineController {
  constructor(private readonly service: MedicineService) {}

  async create(req: Request, res: Response) {
    try {
      const data = await this.service.createMedicine(req.body);
      res.status(201).json(data);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async getAll(req: Request, res: Response) {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const list = await this.service.findAll({ page, limit });
    res.json(list);
  }

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    try {
      const updated = await this.service.updateMedicine(id, req.body);
      if (!updated) return res.status(404).json({ error: "Não encontrado" });
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    const ok = await this.service.deleteMedicine(id);
    if (!ok) return res.status(404).json({ error: "Não encontrado" });
    res.json({ message: "Removido com sucesso" });
  }
}