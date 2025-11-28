import { Request, Response } from "express";
import { MovementService } from "../../../core/services/movimentacao.service";

export class MovementController {
  constructor(private readonly service: MovementService) {}

  async getMedicines(req: Request, res: Response) {
    try {
      const days = Number(req.query.days) || 0;
      const type = req.query.type as string;

      const list = await this.service.findMedicineMovements(days, type);
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getInputs(req: Request, res: Response) {
    try {
      const days = Number(req.query.days) || 0;

      const list = await this.service.listInputMovements(days);
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const data = await this.service.createMovement(req.body);
      res.status(201).json(data);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
}
