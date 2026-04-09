import { Request, Response } from 'express';
import { DrawerService } from '@services/gaveta.service';
import { sendErrorResponse } from '@helpers/error-response.helper';
import { type TenantRequest } from '@middlewares/tenant.middleware';

export class DrawerController {
  constructor(private readonly service: DrawerService) {}

  async create(req: Request & TenantRequest, res: Response, tenantId: number) {
    try {
      const created = await this.service.createDrawer(tenantId, req.body);
      return res.status(201).json(created);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao criar gaveta');
    }
  }

  async getAll(req: Request, res: Response, tenantId: number) {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;

    const result = await this.service.findAll(tenantId, page, limit);
    return res.json(result);
  }

  async getCount(_req: Request, res: Response, tenantId: number) {
    try {
      const total = await this.service.count(tenantId);
      return res.json({ count: total });
    } catch (error: unknown) {
      return sendErrorResponse(
        res,
        500,
        error,
        'Erro ao obter total de gavetas',
      );
    }
  }

  async getById(req: Request, res: Response, tenantId: number) {
    const number = Number(req.params.numero);
    const drawer = await this.service.findDrawerByNumber(tenantId, number);

    if (!drawer) {
      return res.status(404).json({ error: 'Gaveta não encontrada' });
    }

    return res.json(drawer);
  }

  async update(req: Request, res: Response, tenantId: number) {
    try {
      const number = Number(req.params.numero);
      const { categoria_id } = req.body;

      const updated = await this.service.updateDrawer(
        tenantId,
        number,
        categoria_id,
      );

      if (!updated) {
        return res.status(404).json({ error: 'Gaveta não encontrada' });
      }

      return res.json(updated);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao atualizar gaveta');
    }
  }

  async delete(req: Request, res: Response, tenantId: number) {
    const number = Number(req.params.numero);

    try {
      const deleted = await this.service.removeDrawer(tenantId, number);

      if (!deleted) {
        return res.status(404).json({ error: 'Gaveta não encontrada' });
      }

      return res.sendStatus(204);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao deletar gaveta');
    }
  }
}
