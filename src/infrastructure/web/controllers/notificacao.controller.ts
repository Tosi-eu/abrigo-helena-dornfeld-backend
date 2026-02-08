import { Request, Response } from 'express';
import { NotificationEventService } from '../../../core/services/notificacao.service';
import { sendErrorResponse } from '../../helpers/error-response.helper';
import {
  EventStatus,
  NotificationEventType,
} from '../../database/models/notificacao.model';

export class NotificationEventController {
  constructor(private readonly service: NotificationEventService) {}

  async create(req: Request, res: Response) {
    try {
      const created = await this.service.create(req.body);
      return res.status(201).json(created);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao criar notificação');
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, type, date, status } = req.query;

      if (!type) throw new Error('Tipo deve ser informado');

      const result = await this.service.list({
        page: Number(page),
        limit: Number(limit),
        tipo: type as NotificationEventType,
        status: status as EventStatus | undefined,
        date: date?.toString(),
      });

      return res.json(result);
    } catch (err) {
      return sendErrorResponse(res, 400, err, 'Erro ao buscar notificações');
    }
  }

  async getById(req: Request, res: Response) {
    const id = Number(req.params.id);
    const event = await this.service.get(id);

    if (!event) {
      return res.status(404).json({ error: 'Notificação não encontrada' });
    }

    return res.json(event);
  }

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const updated = await this.service.update(id, req.body);

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

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const deleted = await this.service.delete(id);

      if (!deleted) {
        return res.status(404).json({ error: 'Notificação não encontrada' });
      }

      return res.sendStatus(204);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao deletar notificação');
    }
  }
}
