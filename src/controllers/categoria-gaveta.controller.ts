import { Request, Response } from 'express';
import { DrawerCategoryService } from '@services/categoria-gaveta.service';
import { sendErrorResponse } from '@helpers/error-response.helper';
import {
  type TenantRequest,
} from '@middlewares/tenant.middleware';

export class DrawerCategoryController {
  constructor(private readonly service: DrawerCategoryService) {}

  async create(req: Request & TenantRequest, res: Response, tenantId: number) {
    try {
      const { nome } = req.body;
      const created = await this.service.create(nome, tenantId);
      return res.status(201).json(created);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao criar categoria');
    }
  }

  async getAll(req: Request, res: Response, tenantId: number) {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await this.service.list(tenantId, page, limit);
    return res.json(result);
  }

  async getById(req: Request, res: Response, tenantId: number) {
    const id = Number(req.params.id);
    const category = await this.service.get(tenantId, id);

    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    return res.json(category);
  }

  async update(req: Request, res: Response, tenantId: number) {
    try {
      const id = Number(req.params.id);
      const { nome } = req.body;

      const updated = await this.service.update(tenantId, id, nome);

      if (!updated) {
        return res.status(404).json({ error: 'Categoria não encontrada' });
      }

      return res.json(updated);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao atualizar categoria');
    }
  }

  async delete(req: Request, res: Response, tenantId: number) {
    try {
      const id = Number(req.params.id);
      const deleted = await this.service.delete(tenantId, id);

      if (!deleted) {
        return res.status(404).json({ error: 'Categoria não encontrada' });
      }

      return res.sendStatus(204);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao deletar categoria');
    }
  }
}
