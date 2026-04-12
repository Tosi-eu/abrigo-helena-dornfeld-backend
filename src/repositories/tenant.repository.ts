import type { PublicTenantListItem } from '@porto-sdk/sdk';
import type { Prisma } from '@prisma/client';
import { getDb } from '@repositories/prisma';

function db(tx?: Prisma.TransactionClient) {
  return tx ?? getDb();
}

export class PrismaTenantRepository {
  async findById(id: number, tx?: Prisma.TransactionClient) {
    return db(tx).tenant.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        name: true,
        brand_name: true,
        logo_url: true,
        updated_at: true,
      },
    });
  }

  async findBySlug(slug: string, tx?: Prisma.TransactionClient) {
    return db(tx).tenant.findFirst({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        brand_name: true,
        logo_url: true,
        updated_at: true,
      },
    });
  }

  async findPublicBrandingBySlug(slug: string, tx?: Prisma.TransactionClient) {
    const row = await db(tx).tenant.findFirst({
      where: { slug },
      select: {
        slug: true,
        name: true,
        brand_name: true,
        logo_url: true,
        contract_code_hash: true,
        updated_at: true,
      },
    });
    if (!row) return null;
    const updatedAt = row.updated_at;
    const brandingUpdatedAt =
      updatedAt instanceof Date
        ? updatedAt.toISOString()
        : updatedAt != null
          ? String(updatedAt)
          : null;
    return {
      slug: row.slug,
      name: row.name,
      brandName: row.brand_name ?? null,
      logoUrl: row.logo_url ?? null,
      requiresContractCode: true,
      contractCodeMandatory: Boolean(row.contract_code_hash),
      brandingUpdatedAt,
    };
  }

  async getContractCodeHashByTenantId(id: number): Promise<string | null> {
    const row = await getDb().tenant.findUnique({
      where: { id },
      select: { contract_code_hash: true },
    });
    return row?.contract_code_hash ?? null;
  }

  async findContractPortfolioIdByTenantId(
    tenantId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number | null> {
    const row = await db(tx).tenant.findUnique({
      where: { id: tenantId },
      select: { contract_portfolio_id: true },
    });
    return row?.contract_portfolio_id ?? null;
  }

  async findContractVerifyPayloadBySlug(
    slug: string,
    tx?: Prisma.TransactionClient,
  ) {
    const row = await db(tx).tenant.findFirst({
      where: { slug: String(slug).trim() },
      select: {
        id: true,
        slug: true,
        contract_code_hash: true,
        contract_portfolio_id: true,
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug,
      contract_code_hash: row.contract_code_hash ?? null,
      contract_portfolio_id: row.contract_portfolio_id ?? null,
    };
  }

  /** Tenant definitivo (não viewer, não `u-*`) que partilha o mesmo portfolio de contrato. */
  async findCanonicalTenantByPortfolioId(
    portfolioId: number,
    excludeTenantId: number,
    tx?: Prisma.TransactionClient,
  ) {
    return db(tx).tenant.findFirst({
      where: {
        contract_portfolio_id: portfolioId,
        id: { not: excludeTenantId },
        slug: { not: 'viewer' },
        NOT: { slug: { startsWith: 'u-' } },
      },
      orderBy: { id: 'asc' },
      select: { id: true, slug: true },
    });
  }

  async findIdBySlug(slug: string): Promise<number | null> {
    const row = await getDb().tenant.findFirst({
      where: { slug: String(slug).trim() },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async list(page = 1, limit = 25) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
    const offset = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
      getDb().tenant.findMany({
        select: {
          id: true,
          slug: true,
          name: true,
          brand_name: true,
          logo_url: true,
          contract_portfolio_id: true,
        },
        orderBy: { id: 'asc' },
        take: safeLimit,
        skip: offset,
      }),
      getDb().tenant.count(),
    ]);

    return { data, total, page: safePage, limit: safeLimit };
  }

  async listPublic(
    params?: {
      q?: string;
      limit?: number;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<PublicTenantListItem[]> {
    const q = String(params?.q ?? '').trim();
    const limit = Math.min(50, Math.max(1, Number(params?.limit) || 20));
    const notViewer = { slug: { not: 'viewer' } };
    const where: Prisma.TenantWhereInput =
      q.length > 0
        ? {
            AND: [
              notViewer,
              {
                OR: [
                  { slug: { contains: q, mode: 'insensitive' } },
                  { name: { contains: q, mode: 'insensitive' } },
                  { brand_name: { contains: q, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : notViewer;

    const rows = await db(tx).tenant.findMany({
      where,
      select: { id: true, slug: true, name: true, brand_name: true },
      orderBy: { id: 'asc' },
      take: limit,
    });
    return rows.map(
      (r): PublicTenantListItem => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        brandName: r.brand_name ?? null,
      }),
    );
  }

  async create(
    data: {
      slug: string;
      name: string;
      contract_code_hash?: string | null;
      contract_portfolio_id?: number | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const row = await db(tx).tenant.create({
      data: {
        slug: data.slug,
        name: data.name,
        contract_code_hash: data.contract_code_hash ?? null,
        contract_portfolio_id: data.contract_portfolio_id ?? null,
      },
    });
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      contract_portfolio_id: row.contract_portfolio_id ?? null,
    };
  }

  async updateBranding(
    id: number,
    data: Partial<{
      brand_name: string | null;
      logo_url: string | null;
    }>,
  ) {
    await getDb().tenant.update({ where: { id }, data });
    return this.findById(id);
  }

  async tryPersistLogoUrlFromR2Discovery(
    slug: string,
    logoUrl: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const s = String(slug).trim();
    if (!s || !logoUrl.startsWith('https://')) return false;
    const res = await db(tx).tenant.updateMany({
      where: {
        slug: s,
        logo_url: null,
      },
      data: { logo_url: logoUrl },
    });
    return res.count > 0;
  }

  async update(
    id: number,
    data: Partial<{
      slug: string;
      name: string;
      contract_code_hash: string | null;
      contract_portfolio_id: number | null;
    }>,
  ) {
    await getDb().tenant.update({ where: { id }, data });
    return this.findById(id);
  }

  async setContractCodeForTenant(
    id: number,
    data: { contract_code_hash: string; contract_portfolio_id: number },
  ) {
    await getDb().tenant.update({
      where: { id },
      data: {
        contract_code_hash: data.contract_code_hash,
        contract_portfolio_id: data.contract_portfolio_id,
      },
    });
    return this.findById(id);
  }

  async delete(id: number) {
    try {
      await getDb().tenant.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
