import { Request, Response } from 'express';
import { TenantRepository } from '../../database/repositories/tenant.repository';

export class AppController {
  constructor() {}

  async getStatus(req: Request, res: Response) {
    return res.status(200).json({ ok: true });
  }

  async listTenants(req: Request, res: Response) {
    try {
      const q = req.query.q != null ? String(req.query.q) : '';
      const limit =
        req.query.limit != null ? Number(req.query.limit) : undefined;
      const repo = new TenantRepository();
      const rows = await repo.listPublic({ q, limit });
      return res.json({ data: rows });
    } catch {
      return res.status(500).json({ error: 'Erro ao listar abrigos' });
    }
  }
}
