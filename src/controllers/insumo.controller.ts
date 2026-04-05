import { Response } from 'express';
import { InputService } from '@services/insumo.service';
import {
  getValidatedPagination,
  ValidatedRequest,
} from '@middlewares/validation.middleware';
import {
  type TenantRequest,
  requireTenantId,
} from '@middlewares/tenant.middleware';
import { sendErrorResponse } from '@helpers/error-response.helper';
import { handleETagResponse } from '@helpers/etag.helper';

export class InsumoController {
  constructor(private readonly service: InputService) {}

  async create(req: ValidatedRequest & TenantRequest, res: Response) {
    try {
      const tenantId = requireTenantId(req, res);
      if (tenantId === null) return;
      const created = await this.service.createInput(tenantId, req.body);
      return res.status(201).json(created);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao criar insumo');
    }
  }

  async list(req: ValidatedRequest, res: Response) {
    const pag = getValidatedPagination(req, res);
    if (pag == null) return;
    const { page, limit } = pag;
    const name = req.query.name as string | undefined;

    const list = await this.service.listPaginated(page, limit, name);

    if (handleETagResponse(req, res, list)) {
      return;
    }

    return res.json(list);
  }

  async update(req: ValidatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const updated = await this.service.updateInput(id, req.body);

      if (!updated) {
        return res.status(404).json({ error: 'Não encontrado' });
      }

      return res.json(updated);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao atualizar insumo');
    }
  }

  async delete(req: ValidatedRequest, res: Response) {
    const id = Number(req.params.id);
    const ok = await this.service.deleteInput(id);

    if (!ok) return res.status(404).json({ error: 'Não encontrado' });

    return res.sendStatus(204);
  }
}
