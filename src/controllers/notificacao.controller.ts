import { Response } from 'express';
import { NotificationEventService } from '@services/notificacao.service';
import { sendErrorResponse } from '@helpers/error-response.helper';
import { EventStatus, NotificationEventType } from '@domain/notificacao.types';
import { type TenantRequest } from '@middlewares/tenant.middleware';

export class NotificationEventController {
  constructor(private readonly service: NotificationEventService) {}

  async create(req: TenantRequest, res: Response, tenantId: number) {
    try {
      const created = await this.service.create({
        ...req.body,
        tenant_id: tenantId,
      });
      return res.status(201).json(created);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao criar notificação');
    }
  }

  async getAll(req: TenantRequest, res: Response, tenantId: number) {
    try {
      const {
        page = 1,
        limit = 10,
        type,
        date,
        status,
        residente_nome,
        visto,
      } = req.query;

      if (!type) throw new Error('Tipo deve ser informado');

      const result = await this.service.list(tenantId, {
        page: Number(page),
        limit: Number(limit),
        tipo: type as NotificationEventType,
        status: status as EventStatus | undefined,
        date: date?.toString(),
        residente_nome: residente_nome?.toString(),
        visto: visto === 'false' ? false : visto === 'true' ? true : undefined,
      });

      return res.json(result);
    } catch (err) {
      return sendErrorResponse(res, 400, err, 'Erro ao buscar notificações');
    }
  }

  async getById(req: TenantRequest, res: Response, tenantId: number) {
    const id = Number(req.params.id);
    const event = await this.service.get(tenantId, id);

    if (!event) {
      return res.status(404).json({ error: 'Notificação não encontrada' });
    }

    return res.json(event);
  }

  async update(req: TenantRequest, res: Response, tenantId: number) {
    try {
      const id = Number(req.params.id);
      const updated = await this.service.update(tenantId, id, req.body);

      if (!updated) {
        return res.status(404).json({ error: 'Notificação não encontrada' });
      }

      return res.json(updated);
    } catch (error: unknown) {
      return sendErrorResponse(
        res,
        400,
        error,
        'Erro ao atualizar notificação',
      );
    }
  }

  async delete(req: TenantRequest, res: Response, tenantId: number) {
    try {
      const id = Number(req.params.id);
      const deleted = await this.service.delete(tenantId, id);

      if (!deleted) {
        return res.status(404).json({ error: 'Notificação não encontrada' });
      }

      return res.sendStatus(204);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao deletar notificação');
    }
  }
}
