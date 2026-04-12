import { Prisma } from '@prisma/client';
import { getDb } from '@repositories/prisma';
import type { CreateUserData } from '@domain/dto/user.dto';

const FULL_PERMISSIONS = {
  read: true,
  create: true,
  update: true,
  delete: true,
};

const DEFAULT_USER_PERMISSIONS = {
  read: true,
  create: false,
  update: false,
  delete: false,
};

function db(tx?: Prisma.TransactionClient) {
  return tx ?? getDb();
}

export class PrismaLoginRepository {
  async create(
    data: CreateUserData,
    options?: { transaction?: Prisma.TransactionClient },
  ) {
    const tenantId = Number(data.tenant_id) || 1;
    const tx = options?.transaction;

    let role: 'admin' | 'user';
    let permissions: typeof FULL_PERMISSIONS | typeof DEFAULT_USER_PERMISSIONS;

    if (data.role !== undefined && data.role !== null) {
      role = data.role;
      permissions =
        data.permissions ??
        (role === 'admin' ? FULL_PERMISSIONS : DEFAULT_USER_PERMISSIONS);
    } else {
      const usersInTenant = await db(tx).login.count({
        where: { tenant_id: tenantId },
      });
      if (usersInTenant === 0) {
        role = 'admin';
        permissions = FULL_PERMISSIONS;
      } else {
        role = 'user';
        permissions = data.permissions ?? DEFAULT_USER_PERMISSIONS;
      }
    }

    try {
      const user = await db(tx).login.create({
        data: {
          login: data.login,
          password: data.password,
          first_name: data.first_name ?? null,
          last_name: data.last_name ?? null,
          tenant_id: tenantId,
          role,
          permissions: permissions as Prisma.InputJsonValue,
        },
      });
      return { id: user.id, login: user.login, role: user.role };
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

  async findTenantSummariesForLogin(
    login: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<
    {
      slug: string;
      label: string;
      tenantName: string;
      brandName: string | null;
    }[]
  > {
    const trimmed = login.trim();
    if (!trimmed) return [];

    const rawRows = await db(transaction).$queryRaw<
      { slug: string; name: string; brand_name: string | null }[]
    >(Prisma.sql`
      SELECT DISTINCT t.slug, t.name, t.brand_name
      FROM login l
      INNER JOIN tenant t ON t.id = l.tenant_id
      WHERE LOWER(TRIM(BOTH FROM l.login)) = LOWER(TRIM(BOTH FROM ${trimmed}))
      ORDER BY t.slug ASC
    `);

    const rows = rawRows.map(r => {
      const brandRaw = r.brand_name != null ? String(r.brand_name).trim() : '';
      const brandName = brandRaw.length > 0 ? brandRaw : null;
      const tenantName = String(r.name ?? '').trim() || r.slug;
      const baseLabel = brandName ?? tenantName;
      return { slug: r.slug, tenantName, brandName, baseLabel };
    });

    const labelCounts = new Map<string, number>();
    for (const row of rows) {
      labelCounts.set(row.baseLabel, (labelCounts.get(row.baseLabel) ?? 0) + 1);
    }

    return rows.map(row => ({
      slug: row.slug,
      tenantName: row.tenantName,
      brandName: row.brandName,
      label:
        (labelCounts.get(row.baseLabel) ?? 0) > 1
          ? `${row.baseLabel} (${row.slug})`
          : row.baseLabel,
    }));
  }

  async findByLogin(login: string) {
    return getDb().login.findFirst({
      where: { login },
      select: {
        id: true,
        login: true,
        password: true,
        refreshToken: true,
        first_name: true,
        last_name: true,
        role: true,
        tenant_id: true,
        is_tenant_owner: true,
        is_super_admin: true,
      },
    });
  }

  async findByLoginForTenant(
    login: string,
    tenantId: number,
    transaction?: Prisma.TransactionClient,
  ) {
    return db(transaction).login.findFirst({
      where: { login, tenant_id: tenantId },
      select: {
        id: true,
        login: true,
        password: true,
        refreshToken: true,
        first_name: true,
        last_name: true,
        role: true,
        tenant_id: true,
        is_tenant_owner: true,
        is_super_admin: true,
        permissions: true,
      },
    });
  }

  async findById(id: number) {
    return getDb().login.findUnique({
      where: { id },
      select: {
        id: true,
        login: true,
        password: true,
        refreshToken: true,
        first_name: true,
        last_name: true,
        role: true,
        permissions: true,
        tenant_id: true,
        is_tenant_owner: true,
        is_super_admin: true,
      },
    });
  }

  async findAll() {
    return getDb().login.findMany({
      select: {
        id: true,
        login: true,
        first_name: true,
        last_name: true,
        role: true,
        permissions: true,
        tenant_id: true,
        is_tenant_owner: true,
        is_super_admin: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  async listPaginated(page: number, limit: number, tenantId?: number | null) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
    const offset = (safePage - 1) * safeLimit;

    const where =
      tenantId != null
        ? {
            tenant_id: Number(tenantId),
          }
        : undefined;

    const [data, total] = await Promise.all([
      getDb().login.findMany({
        where,
        select: {
          id: true,
          login: true,
          first_name: true,
          last_name: true,
          role: true,
          permissions: true,
          tenant_id: true,
          is_tenant_owner: true,
          is_super_admin: true,
        },
        orderBy: { id: 'asc' },
        take: safeLimit,
        skip: offset,
      }),
      getDb().login.count({ where }),
    ]);

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async update(id: number, data: Prisma.LoginUpdateInput) {
    await getDb().login.update({ where: { id }, data });
    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    try {
      await getDb().login.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async clearToken(userId: number) {
    await getDb().login.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async findByToken(token: string) {
    return getDb().login.findFirst({
      where: { refreshToken: token },
      select: {
        id: true,
        login: true,
        refreshToken: true,
        first_name: true,
        last_name: true,
        role: true,
        permissions: true,
        tenant_id: true,
        is_tenant_owner: true,
        is_super_admin: true,
      },
    });
  }
}
