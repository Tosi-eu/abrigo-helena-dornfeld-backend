import { Request, Response } from "express";
import { ResidentService } from "../../../core/services/residente.service";

export class ResidentController {
  constructor(private readonly service: ResidentService) {}

  async findAll(req: Request, res: Response) {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const result = await this.service.findAll(page, limit);

    res.json({
      data: result.data,
      page,
      limit,
      hasNext: result.hasNext,
    });
  }

  async findByCasela(req: Request, res: Response) {
    const casela = Number(req.params.casela);

    try {
      const residente = await this.service.findByCasela(casela);
      res.json(residente);
    } catch (e: any) {
      res.status(404).json({ error: e.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const novo = await this.service.createResident(req.body);
      res.status(201).json(novo);
    } catch (e: any) {
      const status = e.message.includes("Já existe") ? 409 : 400;
      res.status(status).json({ error: e.message });
    }
  }

  async update(req: Request, res: Response) {
    const casela = Number(req.params.casela);
    try {
      const updated = await this.service.updateResident({ casela, nome: req.body.nome });
      res.json(updated);
    } catch (e: any) {
      const status = e.message === "Residente não encontrado" ? 404 : 400;
      res.status(status).json({ error: e.message });
    }
  }

  async delete(req: Request, res: Response) {
    const casela = Number(req.params.casela);

    try {
      await this.service.deleteResident(casela);
      res.status(200).json({ message: "Residente removido com sucesso." });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  }
}