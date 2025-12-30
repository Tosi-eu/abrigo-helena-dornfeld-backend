import { Request, Response } from 'express';
import { NotificationEventService } from '../../../core/services/notificacao.service';

export class NotificationEventController {
  constructor(private readonly service: NotificationEventService) {}

  async create(req: Request, res: Response) {
    try {
      const body = req.body;
      const created = await this.service.create(body);
      return res.status(201).json(created);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async getAll(req: Request, res: Response) {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const status = req.query.status?.toString();

    const result = await this.service.list(page, limit, status);
    return res.json(result);
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
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
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
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async getToday(req: Request, res: Response) {
    try {
      const data = await this.service.getTodayPending();

      return res.json({
        date: new Date().toISOString(),
        count: data.length,
        data,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
}
