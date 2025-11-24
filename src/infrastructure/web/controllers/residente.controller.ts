import { Request, Response } from "express";
import { ResidenteService } from "../../../core/services/residente.service";

export class ResidenteController {
  constructor(private readonly service: ResidenteService) {}

  async findAll(_req: Request, res: Response) {
    const lista = await this.service.findAll();
    res.json(lista);
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
      const novo = await this.service.create(req.body);
      res.status(201).json(novo);
    } catch (e: any) {
      const status = e.message.includes("Já existe") ? 409 : 400;
      res.status(status).json({ error: e.message });
    }
  }

  async update(req: Request, res: Response) {
    const casela = Number(req.params.casela);
    try {
      const updated = await this.service.update({ casela, nome: req.body.nome });
      res.json(updated);
    } catch (e: any) {
      const status = e.message === "Residente não encontrado" ? 404 : 400;
      res.status(status).json({ error: e.message });
    }
  }

  async delete(req: Request, res: Response) {
    const casela = Number(req.params.casela);

    try {
      await this.service.delete(casela);
      res.status(200).json({ message: "Residente removido com sucesso." });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  }
}