import { Response } from 'express';
import { LoginService } from '../../../core/services/login.service';
import { MovementService } from '../../../core/services/movimentacao.service';
import { AuditRepository } from '../../database/repositories/audit.repository';
import { AuthRequest } from '../../../middleware/auth.middleware';
import { getErrorMessage } from '../../types/error.types';

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

export class AdminController {
  constructor(
    private readonly loginService: LoginService,
    private readonly auditRepo: AuditRepository,
    private readonly movementService?: MovementService,
  ) {}

  async listUsers(_req: AuthRequest, res: Response) {
    try {
      const users = await this.loginService.listAllUsers();
      return res.json(users);
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao listar usuários',
      });
    }
  }

  async updateUser(req: AuthRequest, res: Response) {
    const userId = Number(req.params.id);
    const body = req.body ?? {};

    if (Number.isNaN(userId) || userId < 1) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const data: {
      first_name?: string;
      last_name?: string;
      login?: string;
      password?: string;
      role?: 'admin' | 'user';
    } = {};
    if (body.firstName !== undefined) data.first_name = body.firstName;
    if (body.lastName !== undefined) data.last_name = body.lastName;
    if (body.login !== undefined) data.login = body.login;
    if (body.password !== undefined && body.password !== '')
      data.password = body.password;
    if (body.role !== undefined) {
      if (body.role !== 'admin' && body.role !== 'user') {
        return res.status(400).json({ error: 'Role deve ser admin ou user' });
      }
      data.role = body.role;
    }

    try {
      const updated = await this.loginService.updateUserByAdmin(userId, data);
      if (!updated) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      return res.json(updated);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      if (msg === 'duplicate key') {
        return res.status(409).json({ error: 'Login já cadastrado' });
      }
      return res.status(500).json({ error: msg || 'Erro ao atualizar usuário' });
    }
  }

  async deleteUser(req: AuthRequest, res: Response) {
    const userId = Number(req.params.id);
    const adminId = req.user!.id;

    if (Number.isNaN(userId) || userId < 1) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const ok = await this.loginService.deleteUserByAdmin(userId, adminId);
    if (!ok) {
      return res.status(400).json({
        error: 'Não é possível excluir seu próprio usuário',
      });
    }
    return res.status(204).send();
  }

  async getInsights(req: AuthRequest, res: Response) {
    try {
      const days = Math.min(
        MAX_DAYS,
        Math.max(1, Number(req.query.days) || DEFAULT_DAYS),
      );
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
      const page = Math.max(1, Number(req.query.page) || 1);
      const offset = (page - 1) * limit;
      const operationType = req.query.operationType as
        | 'create'
        | 'update'
        | 'delete'
        | undefined;
      if (
        operationType &&
        !['create', 'update', 'delete'].includes(operationType)
      ) {
        return res.status(400).json({ error: 'operationType inválido' });
      }

      const insights = await this.auditRepo.getInsights(
        startDate,
        endDate,
        limit,
        offset,
        operationType,
      );
      return res.json(insights);
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao buscar insights',
      });
    }
  }

  /** GET /admin/stock-history?itemType=medicamento|insumo&itemId=123  or  ?lote=XXX */
  async getStockHistory(req: AuthRequest, res: Response) {
    if (!this.movementService) {
      return res.status(501).json({ error: 'Serviço de movimentação não disponível' });
    }
    try {
      const lote = (req.query.lote as string)?.trim();
      const itemType = req.query.itemType as 'medicamento' | 'insumo' | undefined;
      const itemId = req.query.itemId != null ? Number(req.query.itemId) : undefined;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

      if (lote) {
        const result = await this.movementService.getHistoryByLote(lote, page, limit);
        return res.json(result);
      }
      if (itemType && itemId != null && !Number.isNaN(itemId)) {
        const result = await this.movementService.getHistoryByItemId(itemType, itemId, page, limit);
        return res.json(result);
      }
      return res.status(400).json({
        error: 'Informe (itemType + itemId) ou lote para consultar o histórico.',
      });
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao buscar histórico de estoque',
      });
    }
  }
}
