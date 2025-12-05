import { CabinetService } from "../../../core/services/armario.service";
import { Request, Response } from "express";

export class CabinetController {
  constructor(private readonly service: CabinetService) {}

  async create(req: Request, res: Response) {
    try {
      const data = await this.service.createCabinet(req.body);
      return res.status(201).json(data);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async getAll(req: Request, res: Response) {
    const cabinets = await this.service.findAll();
    return res.json(cabinets);
  }

  async getById(req: Request, res: Response) {
    const number = Number(req.params.numero);
    const cabinet = await this.service.findCabinetByNumber(number);

    if (!cabinet) {
      return res.status(404).json({ error: "Armário não encontrado" });
    }

    return res.json(cabinet);
  }

  async update(req: Request, res: Response) {
    try {
      const number = Number(req.params.numero);
      const category = req.body.categoria_id;

      const updated = await this.service.updateCabinet(number, category);

      if (!updated) {
        return res.status(404).json({ error: "Armário não encontrado" });
      }

      return res.json(updated);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async delete(req: Request, res: Response) {
    const number = Number(req.params.numero);

    try {
      const deleted = await this.service.removeCabinet(number);

      if (!deleted) {
        return res.status(404).json({ error: "Armário não encontrado" });
      }

      return res.status(204).end(); 
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }
}