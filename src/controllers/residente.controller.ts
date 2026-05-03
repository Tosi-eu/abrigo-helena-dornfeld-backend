import { Response } from 'express';
import { ResidentService } from '@services/residente.service';
import {
  getValidatedPagination,
  ValidatedRequest,
} from '@middlewares/validation.middleware';
import { type TenantRequest } from '@middlewares/tenant.middleware';
import { sendErrorResponse } from '@helpers/error-response.helper';
import { getErrorMessage } from '@domain/error.types';

export class ResidentController {
  constructor(private readonly service: ResidentService) {}

  async findAll(req: ValidatedRequest, res: Response, tenantId: number) {
    const pag = getValidatedPagination(req, res);
    if (pag == null) return;
    const { page, limit } = pag;

    const result = await this.service.findAll(tenantId, page, limit);

    res.json({
      data: result.data,
      page,
      limit,
      hasNext: result.hasNext,
    });
  }

  async getCount(_req: ValidatedRequest, res: Response, tenantId: number) {
    try {
      const total = await this.service.count(tenantId);
      return res.json({ count: total });
    } catch (error: unknown) {
      return sendErrorResponse(
        res,
        500,
        error,
        'Erro ao obter total de residentes',
      );
    }
  }

  async findByCasela(req: ValidatedRequest, res: Response, tenantId: number) {
    const casela = Number(req.params.casela);

    try {
      const residente = await this.service.findByCasela(tenantId, casela);
      res.json(residente);
    } catch (error: unknown) {
      return sendErrorResponse(res, 404, error, 'Residente não encontrado');
    }
  }

  async create(
    req: ValidatedRequest & TenantRequest,
    res: Response,
    tenantId: number,
  ) {
    try {
      const novo = await this.service.createResident(tenantId, req.body);
      res.status(201).json(novo);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const status = message.includes('Já existe') ? 409 : 400;
      return sendErrorResponse(res, status, error, 'Erro ao criar residente');
    }
  }

  async update(
    req: ValidatedRequest & TenantRequest,
    res: Response,
    tenantId: number,
  ) {
    const casela = Number(req.params.casela);
    try {
      const body = req.body as {
        nome: string;
        data_nascimento?: string | null;
      };
      const updated = await this.service.updateResident(tenantId, {
        casela,
        nome: body.nome,
        ...(Object.prototype.hasOwnProperty.call(body, 'data_nascimento')
          ? { data_nascimento: body.data_nascimento }
          : {}),
      });
      res.json(updated);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const status = message === 'Residente não encontrado' ? 404 : 400;
      return sendErrorResponse(
        res,
        status,
        error,
        'Erro ao atualizar residente',
      );
    }
  }

  async delete(req: ValidatedRequest, res: Response, tenantId: number) {
    const casela = Number(req.params.casela);

    try {
      const deleted = await this.service.deleteResidentForTenant(
        tenantId,
        casela,
      );

      if (!deleted) {
        return res.status(404).json({ error: 'Residente não encontrado' });
      }
      return res.status(204).end();
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao deletar residente');
    }
  }
}
