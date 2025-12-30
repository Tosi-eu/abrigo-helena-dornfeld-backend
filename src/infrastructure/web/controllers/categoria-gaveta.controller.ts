import { Request, Response } from 'express';
import { DrawerCategoryService } from '../../../core/services/categoria-gaveta.service';

export class DrawerCategoryController {
  constructor(private readonly service: DrawerCategoryService) {}

  async create(req: Request, res: Response) {
    try {
      const { nome } = req.body;
      const created = await this.service.create(nome);
      return res.status(201).json(created);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async getAll(req: Request, res: Response) {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await this.service.list(page, limit);
    return res.json(result);
  }

  async getById(req: Request, res: Response) {
    const id = Number(req.params.id);
    const category = await this.service.get(id);

    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    return res.json(category);
  }

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { nome } = req.body;

      const updated = await this.service.update(id, nome);

      if (!updated) {
        return res.status(404).json({ error: 'Categoria não encontrada' });
      }

      return res.json(updated);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const deleted = await this.service.delete(id);

      if (!deleted) {
        return res.status(404).json({ error: 'Categoria não encontrada' });
      }

      return res.sendStatus(204);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }
}
