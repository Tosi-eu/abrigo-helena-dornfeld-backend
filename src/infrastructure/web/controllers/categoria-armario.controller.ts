import { Request, Response } from 'express';
import { CabinetCategoryService } from '../../../core/services/categoria-armario.service';
import { sendErrorResponse } from '../../helpers/error-response.helper';

export class CabinetCategoryController {
  constructor(private readonly service: CabinetCategoryService) {}

  async create(req: Request, res: Response) {
    try {
      const { nome } = req.body;

      if (!nome || typeof nome !== 'string' || nome.trim() === '') {
        return res
          .status(400)
          .json({ error: 'Nome da categoria é obrigatório' });
      }

      const created = await this.service.create(nome.trim());
      return res.status(201).json(created);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao criar categoria');
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
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao atualizar categoria');
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
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao deletar categoria');
    }
  }
}
