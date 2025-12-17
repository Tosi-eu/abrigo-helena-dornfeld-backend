import { Request, Response } from 'express';
import { DrawerService } from '../../../core/services/gaveta.service';

export class DrawerController {
  constructor(private readonly service: DrawerService) {}

  async create(req: Request, res: Response) {
    try {
      const created = await this.service.createDrawer(req.body);
      return res.status(201).json(created);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async getAll(req: Request, res: Response) {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;

    const result = await this.service.findAll(page, limit);
    return res.json(result);
  }

  async getById(req: Request, res: Response) {
    const number = Number(req.params.numero);
    const drawer = await this.service.findDrawerByNumber(number);

    if (!drawer) {
      return res.status(404).json({ error: 'Gaveta não encontrada' });
    }

    return res.json(drawer);
  }

  async update(req: Request, res: Response) {
    try {
      const number = Number(req.params.numero);
      const { categoria_id } = req.body;

      const updated = await this.service.updateDrawer(number, categoria_id);

      if (!updated) {
        return res.status(404).json({ error: 'Gaveta não encontrada' });
      }

      return res.json(updated);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async delete(req: Request, res: Response) {
    const number = Number(req.params.numero);

    try {
      const deleted = await this.service.removeDrawer(number);

      if (!deleted) {
        return res.status(404).json({ error: 'Gaveta não encontrada' });
      }

      return res.sendStatus(204);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }
}
