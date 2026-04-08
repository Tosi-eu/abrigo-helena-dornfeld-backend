import { type Request, type Response } from 'express';
import { LoginService } from '@services/login.service';
import { AuthRequest } from '@middlewares/auth.middleware';
import {
  type TenantRequest,
  requireTenantId,
} from '@middlewares/tenant.middleware';
import { getErrorMessage, isHttpError } from '@domain/error.types';
import type { PrismaLoginLogRepository } from '@repositories/login-log.repository';
import type { PrismaSystemConfigRepository } from '@repositories/system-config.repository';
import {
  uiDisplayFromConfigRow,
  type UiDisplayConfig,
} from '@helpers/ui-display.helper';
import { logger } from '@helpers/logger.helper';
import {
  isUniqueViolationError,
  mapPrismaToClientError,
  prismaErrorLogMeta,
} from '@helpers/prisma-error.helper';
import { verifyContractCode } from '@helpers/contract-code.helper';
import { PrismaTenantRepository } from '@repositories/tenant.repository';

const tenantRepoForRegister = new PrismaTenantRepository();

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
    private readonly loginLogRepo?: PrismaLoginLogRepository,
    private readonly systemConfigRepo?: PrismaSystemConfigRepository,
  ) {}

  async registerUser(req: Request, res: Response) {
    const body = req.body ?? {};
    const loginRaw = body.login ?? body.email;
    const password = body.password;
    const first_name = body.first_name;
    const last_name = body.last_name;
    const contract_code = body.contract_code ?? body.contractCode;
    const login =
      loginRaw != null && String(loginRaw).trim() !== ''
        ? String(loginRaw).trim()
        : '';

    if (!login || !password) {
      return res.status(400).json({ error: 'E-mail e senha obrigatórios' });
    }

    try {
      const result = await this.service.registerAccountWithNewTenant({
        login,
        password,
        first_name,
        last_name,
        contract_code:
          contract_code != null && String(contract_code).trim() !== ''
            ? String(contract_code)
            : undefined,
      });
      return res.status(201).json({
        tenant: { id: result.tenantId, slug: result.slug },
        user: {
          id: result.userId,
          login: result.login,
          role: 'user' as const,
        },
      });
    } catch (error: unknown) {
      if (isHttpError(error)) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      if (isUniqueViolationError(error)) {
        return res
          .status(409)
          .json({ error: 'Este e-mail já está em uso. Tente fazer login.' });
      }
      logger.error(
        'Falha ao cadastrar utilizador (tenant provisório)',
        { operation: 'login_register_user' },
        error instanceof Error ? error : new Error(String(error)),
      );
      return res.status(500).json({ error: 'Erro ao criar conta' });
    }
  }

  async registerShelter(req: Request, res: Response) {
    const body = req.body ?? {};
    const loginRaw = body.login ?? body.email;
    const password = body.password;
    const first_name = body.first_name;
    const last_name = body.last_name;
    const slug = body.slug != null ? String(body.slug) : '';
    const name = body.name != null ? String(body.name) : '';
    const contract_code = body.contract_code ?? body.contractCode;
    const login =
      loginRaw != null && String(loginRaw).trim() !== ''
        ? String(loginRaw).trim()
        : '';

    if (!login || !password) {
      return res.status(400).json({ error: 'E-mail e senha obrigatórios' });
    }

    try {
      const result = await this.service.registerShelterWithAdmin({
        slug,
        name,
        contract_code: contract_code != null ? String(contract_code) : '',
        login,
        password,
        first_name,
        last_name,
      });
      return res.status(201).json({
        tenant: { id: result.tenantId, slug: result.slug },
        user: {
          id: result.userId,
          login: result.login,
          role: 'admin' as const,
        },
      });
    } catch (error: unknown) {
      if (isHttpError(error)) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      if (isUniqueViolationError(error)) {
        return res
          .status(409)
          .json({ error: 'Conflito ao criar o abrigo ou o utilizador.' });
      }
      logger.error(
        'Falha ao cadastrar abrigo',
        { operation: 'login_register_shelter' },
        error instanceof Error ? error : new Error(String(error)),
      );
      return res.status(500).json({ error: 'Erro ao criar abrigo' });
    }
  }

  async joinByToken(req: Request, res: Response) {
    const body = req.body ?? {};
    const token = body.token != null ? String(body.token) : '';
    const loginRaw = body.login ?? body.email;
    const password = body.password;
    const first_name = body.first_name;
    const last_name = body.last_name;
    const login =
      loginRaw != null && String(loginRaw).trim() !== ''
        ? String(loginRaw).trim()
        : '';

    if (!token.trim() || !login || !password) {
      return res
        .status(400)
        .json({ error: 'Token, e-mail e senha são obrigatórios' });
    }

    try {
      const result = await this.service.joinByInviteToken({
        token,
        login,
        password,
        first_name,
        last_name,
      });
      return res.status(201).json({
        tenant: { id: result.tenantId, slug: result.slug },
        user: {
          id: result.userId,
          login: result.login,
          role: 'user' as const,
        },
      });
    } catch (error: unknown) {
      if (isHttpError(error)) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      if (isUniqueViolationError(error)) {
        return res
          .status(409)
          .json({ error: 'Este e-mail já está em uso neste abrigo.' });
      }
      logger.error(
        'Falha ao entrar por convite',
        { operation: 'login_join_by_token' },
        error instanceof Error ? error : new Error(String(error)),
      );
      return res.status(500).json({ error: 'Erro ao concluir cadastro' });
    }
  }

  async createAccount(req: Request, res: Response) {
    const body = req.body ?? {};
    const loginRaw = body.login ?? body.email;
    const password = body.password;
    const first_name = body.first_name;
    const last_name = body.last_name;
    const login =
      loginRaw != null && String(loginRaw).trim() !== ''
        ? String(loginRaw).trim()
        : '';

    if (!login || !password) {
      return res.status(400).json({ error: 'E-mail e senha obrigatórios' });
    }

    try {
      const result = await this.service.registerAccountWithNewTenant({
        login,
        password,
        first_name,
        last_name,
      });
      return res.status(201).json({
        tenant: { id: result.tenantId, slug: result.slug },
        user: {
          id: result.userId,
          login: result.login,
          role: 'user' as const,
        },
      });
    } catch (error: unknown) {
      if (isHttpError(error)) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      if (isUniqueViolationError(error)) {
        return res
          .status(409)
          .json({ error: 'Este e-mail já está em uso. Tente fazer login.' });
      }
      logger.error(
        'Falha ao criar conta com novo abrigo',
        { operation: 'login_create_account' },
        error instanceof Error ? error : new Error(String(error)),
      );
      return res.status(500).json({ error: 'Erro ao criar conta' });
    }
  }

  async create(req: AuthRequest & TenantRequest, res: Response, tenantId: number) {
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
      const tenantId = req.tenant?.id ?? 0;
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
        isUniqueViolationError(error);
      if (isDuplicate) {
        return res.status(409).json({ error: 'Login já cadastrado' });
      }

      const mapped = mapPrismaToClientError(error);
      if (mapped) {
        logger.warn('Registro público rejeitado (ORM)', {
          operation: 'login_create',
          tenantId,
          login: hint,
          ...prismaErrorLogMeta(error),
        });
        return res.status(mapped.status).json({ error: mapped.message });
      }

      logger.error(
        'Falha ao criar usuário (registro público)',
        {
          operation: 'login_create',
          tenantId,
          login: hint,
          ...prismaErrorLogMeta(error),
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

  async resolveTenant(req: Request, res: Response) {
    const q = req.query ?? {};
    const loginRaw = q.login ?? q.email;
    const login =
      loginRaw != null && String(loginRaw).trim() !== ''
        ? String(loginRaw).trim()
        : '';

    if (!login)
      return res
        .status(400)
        .json({ error: 'Informe o e-mail (parâmetro login)' });

    try {
      const result = await this.service.resolveTenantByLogin(login);
      if (result.type === 'unique') {
        return res.json({ slug: result.slug });
      }
      if (result.type === 'ambiguous') {
        return res.status(409).json({
          error:
            'Este e-mail está vinculado a mais de um abrigo. Selecione o abrigo antes de entrar.',
          tenants: result.tenants,
        });
      }
      return res.status(404).json({
        error: 'Nenhum abrigo encontrado para este e-mail',
      });
    } catch (error: unknown) {
      logger.error(
        'Falha ao resolver abrigo por e-mail',
        { operation: 'login_resolve_tenant' },
        error instanceof Error ? error : new Error(String(error)),
      );
      return res.status(500).json({ error: 'Erro ao identificar o abrigo' });
    }
  }

  async tenantsForEmail(req: Request, res: Response) {
    const q = req.query ?? {};
    const loginRaw = q.login ?? q.email;
    const login =
      loginRaw != null && String(loginRaw).trim() !== ''
        ? String(loginRaw).trim()
        : '';

    if (!login)
      return res
        .status(400)
        .json({ error: 'Informe o e-mail (parâmetro login)' });

    try {
      const tenants = await this.service.listTenantSummariesForLogin(login);
      return res.json({ tenants });
    } catch (error: unknown) {
      logger.error(
        'Falha ao listar abrigos por e-mail',
        { operation: 'login_tenants_for_email' },
        error instanceof Error ? error : new Error(String(error)),
      );
      return res.status(500).json({ error: 'Erro ao listar abrigos' });
    }
  }

  async authenticate(
    req: AuthRequest & TenantRequest,
    res: Response,
    tenantId: number,
  ) {
    const body = req.body ?? {};
    const loginRaw = body.login ?? body.email;
    const password = body.password;
    const login =
      loginRaw != null && String(loginRaw).trim() !== ''
        ? String(loginRaw).trim()
        : '';

    if (!login || !password)
      return res.status(400).json({ error: 'E-mail e senha obrigatórios' });

    const result = await this.service.authenticate(login, password, tenantId);

    if (this.loginLogRepo) {
      try {
        await this.loginLogRepo.create({
          user_id: result?.user?.id ?? null,
          tenant_id: tenantId,
          login: String(login),
          success: !!result,
          ip: getClientIp(req),
          user_agent: req.get('User-Agent') ?? null,
        });
      } catch {
        // no-op
      }
    }

    if (!result)
      return res.status(401).json({ error: 'Credenciais inválidas' });
    return res.json({
      token: result.token,
      user: result.user,
    });
  }

  async update(req: AuthRequest, res: Response) {
    const session = req.user;
    if (session == null || session.id == null) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    const userId = session.id;
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
    const session = req.user;
    if (session == null || session.id == null) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    const ok = await this.service.deleteUser(session.id);
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
    const session = req.user;
    if (session == null || session.id == null) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    const userId = session.id;

    const user = await this.service.getById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.json(user);
  }

  async getDisplayConfig(_req: AuthRequest, res: Response) {
    if (!this.systemConfigRepo) {
      return res
        .status(501)
        .json({ error: 'Configuração de exibição indisponível' });
    }
    try {
      const all = await this.systemConfigRepo.getAll();
      const uiDisplay: UiDisplayConfig = uiDisplayFromConfigRow(all);
      return res.json({ uiDisplay });
    } catch (error: unknown) {
      return res.status(500).json({
        error:
          getErrorMessage(error) || 'Erro ao carregar preferências de exibição',
      });
    }
  }

  async logout(req: AuthRequest, res: Response) {
    const session = req.user;
    if (session == null || session.id == null) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    await this.service.logout(session.id);

    return res.status(204).send();
  }
}
