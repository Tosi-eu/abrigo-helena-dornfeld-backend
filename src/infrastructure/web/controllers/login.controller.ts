import { Request, Response } from 'express';
import { LoginService } from '../../../core/services/login.service';
import { AuthRequest } from '../../../middleware/auth.middleware';
import type { TenantRequest } from '../../../middleware/tenant.middleware';
import { getErrorMessage, HttpError, isHttpError } from '../../types/error.types';
import type { LoginLogRepository } from '../../database/repositories/login-log.repository';
import { logger } from '../../helpers/logger.helper';
import {
  mapSequelizeToClientError,
  sequelizeErrorLogMeta,
} from '../../helpers/sequelize-error.helper';
import { verifyContractCode } from '../../helpers/contract-code.helper';
import { TenantRepository } from '../../database/repositories/tenant.repository';

const tenantRepoForRegister = new TenantRepository();

function loginHintForLog(login: string): string {
  if (!login) return '';
  const at = login.indexOf('@');
  if (at > 0) {
    return `${login.slice(0, 2)}***@${login.slice(at + 1)}`;
  }
  return `${login.slice(0, 2)}***`;
}

function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string')
    return forwarded.split(',')[0]?.trim() ?? null;
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

export class LoginController {
  constructor(
    private readonly service: LoginService,
    private readonly loginLogRepo?: LoginLogRepository,
  ) {}

  async create(req: AuthRequest & TenantRequest, res: Response) {
    const body = req.body ?? {};
    const loginRaw = body.login ?? body.email;
    const password = body.password;
    const first_name = body.first_name;
    const last_name = body.last_name;
    const contractCodeRaw = body.contract_code ?? body.contractCode;
    const login =
      loginRaw != null && String(loginRaw).trim() !== ''
        ? String(loginRaw).trim()
        : '';

    if (!login || !password)
      return res.status(400).json({ error: 'E-mail e senha obrigatórios' });

    try {
      const tenantId = req.tenant?.id ?? 1;
      const hash =
        await tenantRepoForRegister.getContractCodeHashByTenantId(tenantId);
      const verdict = await verifyContractCode(
        hash,
        contractCodeRaw != null ? String(contractCodeRaw) : undefined,
      );
      if (verdict === 'required') {
        return res
          .status(400)
          .json({ error: 'Código de contrato obrigatório para este abrigo' });
      }
      if (verdict === 'invalid') {
        return res.status(403).json({ error: 'Código de contrato inválido' });
      }

      const user = await this.service.create({
        login,
        password,
        first_name,
        last_name,
        tenant_id: tenantId,
      });
      return res.status(201).json(user);
    } catch (error: unknown) {
      const tenantId = req.tenant?.id ?? 1;
      const hint = loginHintForLog(login);

      if (isHttpError(error)) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      const err = error as {
        message?: string;
        name?: string;
        original?: { code?: string };
      };
      const message = getErrorMessage(error);
      const isDuplicate =
        message === 'duplicate key' ||
        message.includes('duplicate key') ||
        message === 'Usuário já cadastrado' ||
        message.includes('Usuário já cadastrado') ||
        err?.name === 'SequelizeUniqueConstraintError' ||
        err?.original?.code === '23505';
      if (isDuplicate) {
        return res.status(409).json({ error: 'Login já cadastrado' });
      }

      const mapped = mapSequelizeToClientError(error);
      if (mapped) {
        logger.warn('Registro público rejeitado (ORM)', {
          operation: 'login_create',
          tenantId,
          login: hint,
          ...sequelizeErrorLogMeta(error),
        });
        return res.status(mapped.status).json({ error: mapped.message });
      }

      logger.error(
        'Falha ao criar usuário (registro público)',
        {
          operation: 'login_create',
          tenantId,
          login: hint,
          ...sequelizeErrorLogMeta(error),
        },
        error instanceof Error ? error : new Error(String(error)),
      );

      const isProd = process.env.NODE_ENV === 'production';
      return res.status(500).json({
        error: 'Erro ao criar usuário',
        ...(!isProd
          ? {
              details: message,
              errorName: err?.name,
            }
          : {}),
      });
    }
  }

  async authenticate(req: AuthRequest & TenantRequest, res: Response) {
    const body = req.body ?? {};
    const loginRaw = body.login ?? body.email;
    const password = body.password;
    const login =
      loginRaw != null && String(loginRaw).trim() !== ''
        ? String(loginRaw).trim()
        : '';

    if (!login || !password)
      return res.status(400).json({ error: 'E-mail e senha obrigatórios' });

    const tenantId = req.tenant?.id ?? 1;
    const result = await this.service.authenticate(login, password, tenantId);

    if (this.loginLogRepo) {
      try {
        await this.loginLogRepo.create({
          user_id: result?.user?.id ?? null,
          login: String(login),
          success: !!result,
          ip: getClientIp(req),
          user_agent: req.get('User-Agent') ?? null,
        });
      } catch {
        // ignore log errors
      }
    }

    if (!result)
      return res.status(401).json({ error: 'Credenciais inválidas' });

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    };

    res.cookie('authToken', result.token, cookieOptions);

    return res.json({
      user: result.user,
    });
  }

  async update(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    // Only allow whitelisted fields from the client (browser) to prevent privilege escalation
    const body = req.body ?? {};
    const currentPassword = body.currentPassword;
    const login = body.login;
    const password = body.password;
    const firstName = body.firstName;
    const lastName = body.lastName;

    if (!currentPassword) {
      return res.status(400).json({ error: 'Senha atual é obrigatória' });
    }

    try {
      const updated = await this.service.updateUser({
        userId,
        currentPassword,
        login,
        password,
        firstName,
        lastName,
      });

      if (!updated) {
        return res.status(401).json({ error: 'Senha atual incorreta' });
      }

      return res.json(updated);
    } catch (error: unknown) {
      const message = getErrorMessage(error);

      if (message === 'duplicate key') {
        return res.status(409).json({ error: 'Login já cadastrado' });
      }

      return res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
  }

  async delete(req: AuthRequest, res: Response) {
    const ok = await this.service.deleteUser(req.user!.id);
    if (!ok) return res.status(404).json({ error: 'Usuário não encontrado' });

    return res.status(204).send();
  }

  async resetPassword(req: Request, res: Response) {
    const { login, newPassword } = req.body;

    if (!login || !newPassword)
      return res
        .status(400)
        .json({ error: 'Login e nova senha são obrigatórios' });

    try {
      const user = await this.service.resetPassword(login, newPassword);
      return res.json(user);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro ao redefinir senha';

      if (
        message === 'Login não encontrado' ||
        String(message).includes('não encontrado')
      ) {
        return res.status(404).json({ error: 'Login não encontrado' });
      }
      return res.status(400).json({ error: message });
    }
  }

  async getCurrentUser(req: AuthRequest, res: Response) {
    const userId = req.user!.id;

    const user = await this.service.getById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.json(user);
  }

  async logout(req: AuthRequest, res: Response) {
    await this.service.logout(req.user!.id);

    res.clearCookie('authToken', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });

    return res.status(204).send();
  }
}
