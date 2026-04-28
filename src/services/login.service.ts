import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import type { PrismaLoginRepository } from '@repositories/login.repository';
import { jwtConfig } from '@config/jwt.config';
import { withRootTransaction } from '@repositories/prisma';
import { setRlsSessionGucs } from '@repositories/rls.context';
import { PrismaContractPortfolioRepository } from '@repositories/contract-portfolio.repository';
import { PrismaTenantInviteRepository } from '@repositories/tenant-invite.repository';
import { digestInviteTokenPlain } from '@helpers/invite-token.helper';
import { HttpError, isHttpError } from '@domain/error.types';
import type { LoginCreateWithTenant } from '@porto-sdk/sdk';
import { DEFAULT_TENANT_MODULES } from './tenant-config.service';
import { PrismaSetorRepository } from '@repositories/setor.repository';
import type { UserPermissions } from '@domain/user.types';
import {
  buildEffectivePermissionMatrix,
  summarizeFlatFromMatrix,
} from '@helpers/permission-matrix.resolver';
import { parsePermissionsForStorage } from '@helpers/permission-storage.helper';

const MIN_PASSWORD_LENGTH = 8;

const DEFAULT_PERMISSIONS = {
  read: true,
  create: false,
  update: false,
  delete: false,
} as const;

function effectivePermissions(
  role: string,
  stored: Prisma.JsonValue | null | undefined,
): UserPermissions {
  return summarizeFlatFromMatrix(
    buildEffectivePermissionMatrix(role === 'admin' ? 'admin' : 'user', stored),
  );
}

type DbUserForPublicSession = {
  id: number;
  login: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  permissions: Prisma.JsonValue | null | undefined;
  tenant_id: number | null;
  is_tenant_owner?: boolean | null;
  is_super_admin?: boolean | null;
};

/** Payload exposto ao cliente (login, usuario-logado, lista admin). */
export function publicSessionFromDbUser(user: DbUserForPublicSession) {
  const matrix = buildEffectivePermissionMatrix(
    user.role === 'admin' ? 'admin' : 'user',
    user.permissions,
  );
  return {
    id: user.id,
    login: user.login,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role as 'admin' | 'user',
    tenantId: user.tenant_id,
    isTenantOwner: Boolean(user.is_tenant_owner),
    isSuperAdmin: Boolean(user.is_super_admin),
    permissions: summarizeFlatFromMatrix(matrix),
    permissionMatrix: {
      resources: matrix.resources,
      movement_tipos: matrix.movement_tipos,
    },
  };
}

function validateStrongPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(
      `Senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres`,
      400,
    );
  }
  if (!/[a-zA-Z]/.test(password)) {
    throw new HttpError('Senha deve conter pelo menos uma letra', 400);
  }
  if (!/[0-9]/.test(password)) {
    throw new HttpError('Senha deve conter pelo menos um número', 400);
  }
}

type UpdateUserInput = {
  userId: number;
  currentPassword: string;
  login?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
};

export class LoginService {
  constructor(private readonly repo: PrismaLoginRepository) {}

  async getById(id: number) {
    const user = await this.repo.findById(id);
    if (!user) return null;

    return publicSessionFromDbUser({
      id: user.id,
      login: user.login,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      permissions: user.permissions,
      tenant_id: user.tenant_id,
      is_tenant_owner: user.is_tenant_owner,
      is_super_admin: user.is_super_admin,
    });
  }

  async create(attrs: LoginCreateWithTenant) {
    const tenantId = attrs.tenant_id;
    const userExists = await this.repo.findByLoginForTenant(
      attrs.login,
      tenantId,
    );

    if (userExists) {
      throw new HttpError('Login já cadastrado', 409);
    }

    validateStrongPassword(attrs.password);
    const hashed = await bcrypt.hash(attrs.password, 10);
    try {
      const created = await this.repo.create({
        login: attrs.login,
        password: hashed,
        first_name: attrs.first_name,
        last_name: attrs.last_name,
        tenant_id: tenantId,
      });
      return created;
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new Error('duplicate key');
      }
      throw err;
    }
  }

  async createByAdmin(attrs: {
    login: string;
    password: string;
    first_name?: string;
    last_name?: string;
    role?: 'admin' | 'user';
    tenantId: number;
    /** Legado (4 flags) ou matriz `{ version: 2, resources: {...} }`. */
    permissions?: unknown;
  }) {
    const userExists = await this.repo.findByLoginForTenant(
      attrs.login,
      attrs.tenantId,
    );
    if (userExists) throw new Error('Usuário já cadastrado');

    validateStrongPassword(attrs.password);
    const hashed = await bcrypt.hash(attrs.password, 10);
    const role = attrs.role ?? 'user';
    const permissions = parsePermissionsForStorage(role, attrs.permissions);

    try {
      const created = await this.repo.create({
        login: attrs.login,
        password: hashed,
        first_name: attrs.first_name,
        last_name: attrs.last_name,
        role,
        permissions,
        tenant_id: attrs.tenantId,
      });
      const user = await this.repo.findById(created.id);
      if (!user) return null;
      return {
        id: user.id,
        login: user.login,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        permissions: effectivePermissions(user.role, user.permissions),
      };
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new Error('duplicate key');
      }
      throw err;
    }
  }

  async authenticate(login: string, password: string, tenantId: number) {
    const user = await this.repo.findByLoginForTenant(login, tenantId);
    if (!user) return null;

    const match = await bcrypt.compare(password, user.password);
    if (!match) return null;

    const token = jwt.sign(
      { sub: user.id, login: user.login },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn },
    );

    await this.repo.update(user.id, { refreshToken: token });

    return {
      token,
      user: publicSessionFromDbUser({
        id: user.id,
        login: user.login,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        permissions: user.permissions,
        tenant_id: user.tenant_id,
        is_tenant_owner: user.is_tenant_owner,
        is_super_admin: user.is_super_admin,
      }),
    };
  }

  async resolveTenantByLogin(login: string): Promise<
    | { type: 'unique'; slug: string }
    | { type: 'not_found' }
    | {
        type: 'ambiguous';
        tenants: {
          slug: string;
          label: string;
          tenantName: string;
          brandName: string | null;
        }[];
      }
  > {
    const trimmed = login.trim();
    if (!trimmed) return { type: 'not_found' };
    const list = await withRootTransaction(
      async (t: Prisma.TransactionClient) => {
        await setRlsSessionGucs(t, {
          allow_email_resolution: 'true',
          resolution_login: trimmed,
        });
        return this.repo.findTenantSummariesForLogin(trimmed, t);
      },
    );
    if (list.length === 0) return { type: 'not_found' };
    if (list.length === 1) {
      const row = list[0];
      if (!row) return { type: 'not_found' };
      return { type: 'unique', slug: row.slug };
    }
    return { type: 'ambiguous', tenants: list };
  }

  async listTenantSummariesForLogin(login: string): Promise<
    {
      slug: string;
      label: string;
      tenantName: string;
      brandName: string | null;
    }[]
  > {
    const trimmed = login.trim();
    if (!trimmed) return [];
    return withRootTransaction(async (t: Prisma.TransactionClient) => {
      await setRlsSessionGucs(t, {
        allow_email_resolution: 'true',
        resolution_login: trimmed,
      });
      return this.repo.findTenantSummariesForLogin(trimmed, t);
    });
  }

  async updateUser({
    userId,
    currentPassword,
    login,
    password,
    firstName,
    lastName,
  }: UpdateUserInput) {
    const user = await this.repo.findById(userId);
    if (!user) return null;

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) return null;

    const updateData: Partial<{
      first_name: string;
      last_name: string;
      login: string;
      password: string;
    }> = {};

    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;

    if (login && login !== user.login) {
      updateData.login = login;
    }

    if (password) {
      validateStrongPassword(password);
      updateData.password = await bcrypt.hash(password, 10);
    }

    try {
      const updated = await this.repo.update(userId, updateData);
      if (!updated) {
        throw new Error('Falha ao atualizar usuário');
      }

      return {
        id: updated.id,
        login: updated.login,
        firstName: updated.first_name,
        lastName: updated.last_name,
        role: updated.role,
      };
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new Error('duplicate key');
      }
      throw err;
    }
  }

  async deleteUser(id: number) {
    return this.repo.delete(id);
  }

  async listAllUsers() {
    const rows = await this.repo.findAll();
    return rows.map(u => ({
      ...publicSessionFromDbUser({
        id: u.id,
        login: u.login,
        first_name: u.first_name,
        last_name: u.last_name,
        role: u.role,
        permissions: u.permissions,
        tenant_id: u.tenant_id,
        is_tenant_owner: u.is_tenant_owner,
        is_super_admin: u.is_super_admin,
      }),
    }));
  }

  async listUsersPaginated(page = 1, limit = 25, tenantId?: number | null) {
    const result = await this.repo.listPaginated(page, limit, tenantId);
    return {
      data: result.data.map(u =>
        publicSessionFromDbUser({
          id: u.id,
          login: u.login,
          first_name: u.first_name,
          last_name: u.last_name,
          role: u.role,
          permissions: u.permissions,
          tenant_id: u.tenant_id,
          is_tenant_owner: u.is_tenant_owner,
          is_super_admin: u.is_super_admin,
        }),
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async updateUserByAdmin(
    userId: number,
    data: {
      first_name?: string;
      last_name?: string;
      login?: string;
      password?: string;
      role?: 'admin' | 'user';
      /** Legado (4 flags) ou matriz v2. */
      permissions?: unknown;
    },
  ) {
    const user = await this.repo.findById(userId);
    if (!user) return null;

    const updateData: Partial<{
      first_name: string;
      last_name: string;
      login: string;
      role: 'admin' | 'user';
      password: string;
      permissions: Prisma.InputJsonValue;
    }> = {};
    if (data.first_name !== undefined) updateData.first_name = data.first_name;
    if (data.last_name !== undefined) updateData.last_name = data.last_name;
    if (data.login !== undefined) updateData.login = data.login;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.password) {
      validateStrongPassword(data.password);
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    const resultingRole = (data.role ?? user.role) as 'admin' | 'user';
    if (resultingRole === 'admin') {
      updateData.permissions = parsePermissionsForStorage('admin', undefined);
    } else if (data.permissions !== undefined) {
      updateData.permissions = parsePermissionsForStorage(
        'user',
        data.permissions,
      );
    }

    const updated = await this.repo.update(userId, updateData);
    if (!updated) return null;
    return {
      id: updated.id,
      login: updated.login,
      firstName: updated.first_name,
      lastName: updated.last_name,
      role: updated.role,
      permissions: effectivePermissions(updated.role, updated.permissions),
    };
  }

  async deleteUserByAdmin(userId: number, adminId: number) {
    if (userId === adminId) return false;
    return this.repo.delete(userId);
  }

  async logout(userId: number) {
    await this.repo.clearToken(userId);
  }

  async resetPassword(login: string, newPassword: string) {
    validateStrongPassword(newPassword);
    const user = await this.repo.findByLogin(login);
    if (!user) {
      throw new Error('Login não encontrado');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    const updated = await this.repo.update(user.id, { password: hashed });

    if (!updated) {
      throw new Error('Não foi possível resetar a senha');
    }

    return { id: updated.id, login: updated.login };
  }

  async registerAccountWithNewTenant(attrs: {
    login: string;
    password: string;
    first_name?: string;
    last_name?: string;
    contract_code?: string;
  }): Promise<{
    tenantId: number;
    slug: string;
    userId: number;
    login: string;
  }> {
    const loginTrim = attrs.login.trim();
    if (!loginTrim) {
      throw new HttpError('E-mail obrigatório', 400);
    }
    validateStrongPassword(attrs.password);
    const fn = String(attrs.first_name ?? '').trim();
    const ln = String(attrs.last_name ?? '').trim();
    if (fn.length < 2) {
      throw new HttpError('Nome deve ter pelo menos 2 caracteres', 400);
    }
    if (ln.length < 2) {
      throw new HttpError('Sobrenome deve ter pelo menos 2 caracteres', 400);
    }

    const cc = String(attrs.contract_code ?? '').trim();

    const hashed = await bcrypt.hash(attrs.password, 10);
    const tenantName = `Abrigo de ${fn}`.slice(0, 120);

    try {
      return await withRootTransaction(async (t: Prisma.TransactionClient) => {
        const portfolioRepo = new PrismaContractPortfolioRepository();
        await setRlsSessionGucs(t, {
          allow_tenant_self_registration: 'true',
          is_super_admin: 'true',
        });

        let resolved: { id: number; hash: string } | null = null;
        if (cc) {
          const ok = await portfolioRepo.isUsableContractCodeForSignup(cc, {
            tx: t,
            attestedLogin: loginTrim,
          });
          if (!ok) {
            // Mensagem genérica para não virar oracle de enumeração.
            throw new HttpError('Código de contrato inválido', 403);
          }
          const matched = await portfolioRepo.findMatchingPortfolioByPlainText(
            cc,
            t,
          );
          if (!matched) {
            throw new HttpError('Código de contrato inválido', 403);
          }
          resolved = { id: matched.id, hash: matched.hash };
        }
        const slug = await this.generateUniqueTenantSlug(t);
        const tenant = await t.tenant.create({
          data: {
            slug,
            name: tenantName,
            ...(resolved
              ? {
                  contract_code_hash: resolved.hash,
                  contract_portfolio_id: resolved.id,
                }
              : {}),
          },
        });

        if (resolved) {
          const marked = await portfolioRepo.markUsed({
            portfolioId: resolved.id,
            tenantId: tenant.id,
            tx: t,
          });
          if (!marked) {
            throw new HttpError('Código de contrato inválido', 403);
          }
        }

        await setRlsSessionGucs(t, {
          tenant_id: String(tenant.id),
          allow_tenant_self_registration: 'false',
        });
        await t.tenantConfig.create({
          data: {
            tenant_id: tenant.id,
            modules_json: DEFAULT_TENANT_MODULES as Prisma.InputJsonValue,
          },
        });
        const setorRepo = new PrismaSetorRepository();
        await setorRepo.ensureDefaultSetores(tenant.id, t);
        const user = await t.login.create({
          data: {
            login: loginTrim,
            password: hashed,
            first_name: fn,
            last_name: ln,
            tenant_id: tenant.id,
            role: 'user',
            permissions: { ...DEFAULT_PERMISSIONS } as Prisma.InputJsonValue,
            is_tenant_owner: true,
            is_super_admin: false,
          },
        });
        return {
          tenantId: tenant.id,
          slug: tenant.slug,
          userId: user.id,
          login: user.login,
        };
      });
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new HttpError('Este e-mail já está em uso neste contexto', 409);
      }
      throw err;
    }
  }

  private async generateUniqueTenantSlug(
    t: Prisma.TransactionClient,
  ): Promise<string> {
    for (let i = 0; i < 24; i++) {
      const slug = `u-${randomBytes(9).toString('hex')}`;
      const exists = await t.tenant.findFirst({
        where: { slug },
        select: { id: true },
      });
      if (!exists) return slug;
    }
    throw new HttpError(
      'Não foi possível reservar um identificador para o abrigo',
      500,
    );
  }

  private static normalizeShelterSlug(raw: string): string {
    return String(raw ?? '')
      .trim()
      .toLowerCase();
  }

  private static assertValidNewShelterSlug(slug: string): void {
    if (slug === 'viewer') {
      throw new HttpError('Identificador reservado pelo sistema', 400);
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(slug)) {
      throw new HttpError(
        'Identificador do abrigo inválido (use letras minúsculas, números e hífens; não inicie nem termine com hífen)',
        400,
      );
    }
  }

  async registerUserInViewerTenant(attrs: {
    login: string;
    password: string;
    first_name?: string;
    last_name?: string;
  }): Promise<{
    tenantId: number;
    slug: string;
    userId: number;
    login: string;
  }> {
    const loginTrim = attrs.login.trim();
    if (!loginTrim) throw new HttpError('E-mail obrigatório', 400);
    validateStrongPassword(attrs.password);
    const fn = String(attrs.first_name ?? '').trim();
    const ln = String(attrs.last_name ?? '').trim();
    if (fn.length < 2) {
      throw new HttpError('Nome deve ter pelo menos 2 caracteres', 400);
    }
    if (ln.length < 2) {
      throw new HttpError('Sobrenome deve ter pelo menos 2 caracteres', 400);
    }

    const hashed = await bcrypt.hash(attrs.password, 10);
    try {
      return await withRootTransaction(async (t: Prisma.TransactionClient) => {
        await setRlsSessionGucs(t, {
          allow_viewer_only_lookup: 'true',
        });
        const viewer = await t.tenant.findFirst({
          where: { slug: 'viewer' },
          select: { id: true },
        });
        if (!viewer) {
          throw new HttpError(
            'Cadastro em modo visualização indisponível. Contacte o suporte.',
            503,
          );
        }

        await setRlsSessionGucs(t, {
          allow_viewer_only_lookup: 'false',
          tenant_id: String(viewer.id),
        });

        const existing = await this.repo.findByLoginForTenant(
          loginTrim,
          viewer.id,
          t,
        );
        if (existing) {
          throw new HttpError('Este e-mail já está cadastrado', 409);
        }

        const created = await this.repo.create(
          {
            login: loginTrim,
            password: hashed,
            first_name: fn,
            last_name: ln,
            tenant_id: viewer.id,
            role: 'user',
            is_super_admin: false,
          },
          { transaction: t },
        );
        return {
          tenantId: viewer.id,
          slug: 'viewer',
          userId: created.id,
          login: created.login,
        };
      });
    } catch (err: unknown) {
      if (isHttpError(err)) throw err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new HttpError('Este e-mail já está em uso neste contexto', 409);
      }
      throw err;
    }
  }

  async registerShelterWithAdmin(attrs: {
    slug: string;
    name: string;
    contract_code: string;
    login: string;
    password: string;
    first_name?: string;
    last_name?: string;
  }): Promise<{
    tenantId: number;
    slug: string;
    userId: number;
    login: string;
  }> {
    const slug = LoginService.normalizeShelterSlug(attrs.slug);
    const name = String(attrs.name ?? '').trim();
    LoginService.assertValidNewShelterSlug(slug);
    if (name.length < 2) {
      throw new HttpError(
        'Nome do abrigo deve ter pelo menos 2 caracteres',
        400,
      );
    }

    const cc = String(attrs.contract_code ?? '').trim();
    if (!cc) {
      throw new HttpError('Código de contrato obrigatório', 400);
    }

    const loginTrim = attrs.login.trim();
    if (!loginTrim) throw new HttpError('E-mail obrigatório', 400);
    validateStrongPassword(attrs.password);
    const fn = String(attrs.first_name ?? '').trim();
    const ln = String(attrs.last_name ?? '').trim();
    if (fn.length < 2) {
      throw new HttpError('Nome deve ter pelo menos 2 caracteres', 400);
    }
    if (ln.length < 2) {
      throw new HttpError('Sobrenome deve ter pelo menos 2 caracteres', 400);
    }

    const hashed = await bcrypt.hash(attrs.password, 10);

    try {
      return await withRootTransaction(async (t: Prisma.TransactionClient) => {
        const portfolioRepo = new PrismaContractPortfolioRepository();
        await setRlsSessionGucs(t, {
          allow_tenant_self_registration: 'true',
          is_super_admin: 'true',
        });

        // Para criação de abrigo com admin, exige código existente e utilizável.
        const ok = await portfolioRepo.isUsableContractCodeForSignup(cc, {
          tx: t,
          attestedLogin: loginTrim,
        });
        if (!ok) {
          throw new HttpError('Código de contrato inválido', 403);
        }
        const matched = await portfolioRepo.findMatchingPortfolioByPlainText(
          cc,
          t,
        );
        if (!matched) {
          throw new HttpError('Código de contrato inválido', 403);
        }
        const resolved = { id: matched.id, hash: matched.hash };

        const taken = await t.tenant.findFirst({
          where: { slug },
          select: { id: true },
        });
        if (taken) {
          throw new HttpError(
            'Já existe um abrigo com este identificador',
            409,
          );
        }

        const tenant = await t.tenant.create({
          data: {
            slug,
            name: name.slice(0, 120),
            contract_code_hash: resolved.hash,
            contract_portfolio_id: resolved.id,
          },
        });

        const marked = await portfolioRepo.markUsed({
          portfolioId: resolved.id,
          tenantId: tenant.id,
          tx: t,
        });
        if (!marked) {
          throw new HttpError('Código de contrato inválido', 403);
        }

        await setRlsSessionGucs(t, {
          tenant_id: String(tenant.id),
          allow_tenant_self_registration: 'false',
        });
        await t.tenantConfig.create({
          data: {
            tenant_id: tenant.id,
            modules_json: DEFAULT_TENANT_MODULES as Prisma.InputJsonValue,
          },
        });

        const setorRepo = new PrismaSetorRepository();
        await setorRepo.ensureDefaultSetores(tenant.id, t);

        const userExists = await this.repo.findByLoginForTenant(
          loginTrim,
          tenant.id,
          t,
        );
        if (userExists) {
          throw new HttpError('Este e-mail já está em uso neste abrigo', 409);
        }

        const created = await this.repo.create(
          {
            login: loginTrim,
            password: hashed,
            first_name: fn,
            last_name: ln,
            tenant_id: tenant.id,
            role: 'admin',
            is_tenant_owner: true,
            is_super_admin: false,
          },
          { transaction: t },
        );

        return {
          tenantId: tenant.id,
          slug: tenant.slug,
          userId: created.id,
          login: created.login,
        };
      });
    } catch (err: unknown) {
      if (isHttpError(err)) throw err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new HttpError('Este e-mail já está em uso neste contexto', 409);
      }
      throw err;
    }
  }

  async joinByInviteToken(attrs: {
    token: string;
    login: string;
    password: string;
    first_name?: string;
    last_name?: string;
  }): Promise<{
    tenantId: number;
    slug: string;
    userId: number;
    login: string;
  }> {
    const plain = String(attrs.token ?? '').trim();
    if (!plain) {
      throw new HttpError('Token de convite obrigatório', 400);
    }
    if (/^[a-f0-9]{64}$/i.test(plain)) {
      throw new HttpError(
        'Token inválido. Você colou o token_digest da base. Use o token original do link/convite (não o digest).',
        400,
      );
    }

    const loginTrim = attrs.login.trim();
    if (!loginTrim) throw new HttpError('E-mail obrigatório', 400);
    validateStrongPassword(attrs.password);
    const fn = String(attrs.first_name ?? '').trim();
    const ln = String(attrs.last_name ?? '').trim();
    if (fn.length < 2) {
      throw new HttpError('Nome deve ter pelo menos 2 caracteres', 400);
    }
    if (ln.length < 2) {
      throw new HttpError('Sobrenome deve ter pelo menos 2 caracteres', 400);
    }

    const digest = digestInviteTokenPlain(plain);
    const inviteRepo = new PrismaTenantInviteRepository();
    const hashed = await bcrypt.hash(attrs.password, 10);

    try {
      return await withRootTransaction(async (t: Prisma.TransactionClient) => {
        await setRlsSessionGucs(t, { invite_token_digest: digest });
        const invite = await inviteRepo.findConsumableByDigestForUpdate(
          digest,
          t,
        );
        if (!invite) {
          throw new HttpError('Token de convite inválido ou já utilizado', 400);
        }
        if (new Date(invite.expires_at) < new Date()) {
          throw new HttpError('Token de convite expirado', 400);
        }

        await setRlsSessionGucs(t, {
          invite_token_digest: '',
          tenant_id: String(invite.tenant_id),
        });

        const tenantRow = await t.tenant.findUnique({
          where: { id: invite.tenant_id },
          select: { id: true, slug: true },
        });
        if (!tenantRow) {
          throw new HttpError('Abrigo não encontrado', 500);
        }
        if (tenantRow.slug === 'viewer') {
          throw new HttpError('Convite inválido para este contexto', 400);
        }

        const existing = await this.repo.findByLoginForTenant(
          loginTrim,
          invite.tenant_id,
          t,
        );
        if (existing) {
          throw new HttpError(
            'Este e-mail já está cadastrado neste abrigo',
            409,
          );
        }

        const inviteEmail = String(invite.email ?? '').trim();
        if (
          inviteEmail &&
          inviteEmail.toLowerCase() !== loginTrim.toLowerCase()
        ) {
          throw new HttpError('Este convite é para outro e-mail', 403);
        }

        const roleFromInvite =
          invite.role === 'admin' || invite.role === 'user'
            ? invite.role
            : 'user';
        const permsFromInviteRaw =
          invite.permissions_json &&
          typeof invite.permissions_json === 'object' &&
          !Array.isArray(invite.permissions_json)
            ? (invite.permissions_json as Record<string, unknown>)
            : null;
        const permsFromInvite = permsFromInviteRaw
          ? {
              read: true,
              create: Boolean(permsFromInviteRaw.create),
              update: Boolean(permsFromInviteRaw.update),
              delete: Boolean(permsFromInviteRaw.delete),
            }
          : null;

        const created = await this.repo.create(
          {
            login: loginTrim,
            password: hashed,
            first_name: fn,
            last_name: ln,
            tenant_id: invite.tenant_id,
            role: roleFromInvite,
            ...(permsFromInvite ? { permissions: permsFromInvite } : {}),
            is_super_admin: false,
          },
          { transaction: t },
        );

        await inviteRepo.markUsed(invite.id, t);

        return {
          tenantId: invite.tenant_id,
          slug: tenantRow.slug,
          userId: created.id,
          login: created.login,
        };
      });
    } catch (err: unknown) {
      if (isHttpError(err)) throw err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new HttpError('Este e-mail já está em uso neste contexto', 409);
      }
      throw err;
    }
  }
}
