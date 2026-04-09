import type { Response } from 'express';
import type { AuthRequest } from '@middlewares/auth.middleware';
import {
  type TenantRequest,
} from '@middlewares/tenant.middleware';
import { PrismaTenantInviteRepository } from '@repositories/tenant-invite.repository';
import { getErrorMessage } from '@domain/error.types';
import { isEmailConfigured, sendEmail } from '@helpers/email.helper';

const inviteRepo = new PrismaTenantInviteRepository();

export class TenantInviteController {
  async create(
    req: AuthRequest & TenantRequest,
    res: Response,
    tenantId: number,
  ) {
    try {
      const actor = req.user;
      if (actor == null || actor.id == null) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user?.role !== 'admin' && !req.user?.isSuperAdmin) {
        return res.status(403).json({
          error: 'Apenas administradores podem gerar convites de entrada.',
        });
      }

      const rawDays = req.body?.expires_in_days ?? req.body?.expiresInDays;
      const days = Math.min(
        365,
        Math.max(1, Number(rawDays) > 0 ? Number(rawDays) : 7),
      );
      const expiresAt = new Date(Date.now() + days * 86400000);

      const emailRaw = req.body?.email ?? req.body?.to;
      const email = emailRaw != null ? String(emailRaw).trim() : '';
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'E-mail do convidado inválido' });
      }
      const roleRaw = req.body?.role != null ? String(req.body.role) : 'user';
      const role = roleRaw === 'admin' ? 'admin' : 'user';
      const perms = req.body?.permissions ?? null;

      const { plainToken } = await inviteRepo.createOne({
        tenantId,
        createdByUserId: actor.id,
        expiresAt,
        email,
        role,
        permissions: perms,
      });

      const publicBase =
        String(process.env.PUBLIC_APP_URL ?? '').trim() ||
        'http://localhost:5173';
      const link = `${publicBase}/user/login?invite=${encodeURIComponent(
        plainToken,
      )}&email=${encodeURIComponent(email)}`;

      if (!isEmailConfigured()) {
        return res.status(201).json({
          token: plainToken,
          link,
          emailSent: false,
          expiresAt: expiresAt.toISOString(),
          warning: 'SMTP não configurado; token retornado para cópia manual.',
        });
      }

      await sendEmail({
        to: email,
        subject: 'Convite de acesso ao Abrigo',
        text: `Você recebeu um convite de acesso.\n\nAbra este link para concluir o cadastro:\n${link}\n\nEste convite expira em: ${expiresAt.toISOString()}\n`,
      });

      return res.status(201).json({
        ok: true,
        emailSent: true,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao gerar convite',
      });
    }
  }
}
