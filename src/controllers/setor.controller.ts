import type { Response } from 'express';
import type { AuthRequest } from '@middlewares/auth.middleware';
import { getErrorMessage } from '@domain/error.types';
import { PrismaSetorRepository } from '@repositories/setor.repository';

const setorRepo = new PrismaSetorRepository();

export class SetorController {
  async list(_req: AuthRequest, res: Response, tenantId: number) {
    try {
      const data = await setorRepo.listByTenant(tenantId);
      return res.json({ data });
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao listar setores',
      });
    }
  }

  async create(req: AuthRequest, res: Response, tenantId: number) {
    try {
      if (req.user?.role !== 'admin' && !req.user?.isSuperAdmin) {
        return res.status(403).json({
          error: 'Apenas administradores podem criar setores.',
        });
      }
      const keyRaw = req.body?.key ?? req.body?.slug;
      const nomeRaw = req.body?.nome ?? req.body?.name;
      const profileRaw =
        req.body?.proportionProfile ?? req.body?.proportion_profile;
      const key = keyRaw != null ? String(keyRaw) : '';
      const nome = nomeRaw != null ? String(nomeRaw) : '';
      const proportionProfile =
        String(profileRaw ?? 'farmacia').toLowerCase() === 'enfermagem'
          ? 'enfermagem'
          : 'farmacia';
      const row = await setorRepo.createCustom({
        tenantId,
        key,
        nome,
        proportionProfile,
      });
      return res.status(201).json(row);
    } catch (error: unknown) {
      const msg = getErrorMessage(error) || '';
      if (
        msg.includes('Unique') ||
        msg.includes('unique') ||
        msg.includes('23505')
      ) {
        return res
          .status(409)
          .json({ error: 'Já existe um setor com esta chave neste abrigo.' });
      }
      return res.status(400).json({
        error: getErrorMessage(error) || 'Erro ao criar setor',
      });
    }
  }
}
