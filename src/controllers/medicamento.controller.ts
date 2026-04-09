import { Response } from 'express';
import { MedicineService } from '@services/medicamento.service';
import {
  getValidatedPagination,
  ValidatedRequest,
} from '@middlewares/validation.middleware';
import {
  type TenantRequest,
} from '@middlewares/tenant.middleware';
import { sendErrorResponse } from '@helpers/error-response.helper';
import { handleETagResponse } from '@helpers/etag.helper';

export interface PaginationParams {
  page: number;
  limit: number;
}

export class MedicineController {
  constructor(private readonly service: MedicineService) {}

  async create(
    req: ValidatedRequest & TenantRequest,
    res: Response,
    tenantId: number,
  ) {
    try {
      const data = await this.service.createMedicine(tenantId, req.body);
      res.status(201).json(data);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao criar medicamento');
    }
  }

  async getAll(req: ValidatedRequest, res: Response, tenantId: number) {
    const pag = getValidatedPagination(req, res);
    if (pag == null) return;
    const { page, limit } = pag;
    const name = req.query.name as string | undefined;

    const list = await this.service.findAll(tenantId, { page, limit, name });

    if (handleETagResponse(req, res, list)) {
      return;
    }

    res.json(list);
  }

  async update(
    req: ValidatedRequest & TenantRequest,
    res: Response,
    tenantId: number,
  ) {
    const id = Number(req.params.id);
    try {
      const updated = await this.service.updateMedicine(tenantId, id, req.body);
      if (!updated) return res.status(404).json({ error: 'Não encontrado' });
      res.json(updated);
    } catch (error: unknown) {
      return sendErrorResponse(
        res,
        400,
        error,
        'Erro ao atualizar medicamento',
      );
    }
  }

  async delete(req: ValidatedRequest, res: Response, tenantId: number) {
    const id = Number(req.params.id);
    const ok = await this.service.deleteMedicine(tenantId, id);

    if (!ok) {
      return res.status(404).json({ error: 'Não encontrado' });
    }

    return res.status(204).end();
  }
}
