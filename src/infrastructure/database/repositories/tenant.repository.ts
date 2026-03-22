import TenantModel from '../models/tenant.model';
import { Op } from 'sequelize';

export class TenantRepository {
  async findById(id: number) {
    return TenantModel.findByPk(id, {
      attributes: [
        'id',
        'slug',
        'name',
        'brand_name',
        'logo_data_url',
        'logo_url',
      ],
    });
  }

  async findBySlug(slug: string) {
    return TenantModel.findOne({
      where: { slug },
      attributes: [
        'id',
        'slug',
        'name',
        'brand_name',
        'logo_data_url',
        'logo_url',
      ],
    });
  }

  async findPublicBrandingBySlug(slug: string) {
    const row = await TenantModel.findOne({
      where: { slug },
      attributes: [
        'slug',
        'name',
        'brand_name',
        'logo_data_url',
        'logo_url',
        'contract_code_hash',
      ],
    });
    if (!row) return null;
    return {
      slug: row.slug,
      name: row.name,
      brandName: row.brand_name ?? null,
      logoDataUrl: row.logo_data_url ?? null,
      logoUrl: row.logo_url ?? null,
      requiresContractCode: true,
      contractCodeMandatory: Boolean(row.contract_code_hash),
    };
  }

  async getContractCodeHashByTenantId(id: number): Promise<string | null> {
    const row = await TenantModel.findByPk(id, {
      attributes: ['contract_code_hash'],
    });
    return row?.contract_code_hash ?? null;
  }

  async findContractVerifyPayloadBySlug(slug: string) {
    const row = await TenantModel.findOne({
      where: { slug: String(slug).trim() },
      attributes: ['id', 'slug', 'contract_code_hash'],
    });
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug,
      contract_code_hash: row.contract_code_hash ?? null,
    };
  }

  async findIdBySlug(slug: string): Promise<number | null> {
    const row = await TenantModel.findOne({
      where: { slug: String(slug).trim() },
      attributes: ['id'],
    });
    return row?.id ?? null;
  }

  async findOtherTenantWithContractHash(
    excludeTenantId: number | null,
    hash: string,
  ): Promise<{ id: number; slug: string } | null> {
    const where: Record<string, unknown> = {
      contract_code_hash: hash,
    };
    if (excludeTenantId != null) {
      where.id = { [Op.ne]: excludeTenantId };
    }
    const row = await TenantModel.findOne({
      where,
      attributes: ['id', 'slug'],
    });
    return row ? { id: row.id, slug: row.slug } : null;
  }

  async list(page = 1, limit = 25) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
    const offset = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
      TenantModel.findAll({
        attributes: [
          'id',
          'slug',
          'name',
          'brand_name',
          'logo_data_url',
          'logo_url',
        ],
        order: [['id', 'ASC']],
        limit: safeLimit,
        offset,
      }),
      TenantModel.count(),
    ]);

    return { data, total, page: safePage, limit: safeLimit };
  }

  async listPublic(params?: { q?: string; limit?: number }) {
    const q = String(params?.q ?? '').trim();
    const limit = Math.min(50, Math.max(1, Number(params?.limit) || 20));
    const where =
      q.length > 0
        ? {
            [Op.or]: [
              { slug: { [Op.iLike]: `%${q}%` } },
              { name: { [Op.iLike]: `%${q}%` } },
              { brand_name: { [Op.iLike]: `%${q}%` } },
            ],
          }
        : undefined;

    const rows = await TenantModel.findAll({
      where,
      attributes: ['id', 'slug', 'name', 'brand_name'],
      order: [['id', 'ASC']],
      limit,
    });
    return rows.map(r => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      brandName: r.brand_name ?? null,
    }));
  }

  async create(data: {
    slug: string;
    name: string;
    contract_code_hash?: string | null;
  }) {
    const row = await TenantModel.create({
      slug: data.slug,
      name: data.name,
      contract_code_hash: data.contract_code_hash ?? null,
    });
    return { id: row.id, slug: row.slug, name: row.name };
  }

  async updateBranding(
    id: number,
    data: Partial<{
      brand_name: string | null;
      logo_data_url: string | null;
      logo_url: string | null;
    }>,
  ) {
    await TenantModel.update(data, { where: { id } });
    return this.findById(id);
  }

  /**
   * Grava logo_url descoberto no R2 (só se ainda não há logo na BD).
   * Evita repetir ListObjects em pedidos futuros.
   */
  async tryPersistLogoUrlFromR2Discovery(
    slug: string,
    logoUrl: string,
  ): Promise<boolean> {
    const s = String(slug).trim();
    if (!s || !logoUrl.startsWith('https://')) return false;
    const [affected] = await TenantModel.update(
      { logo_url: logoUrl },
      {
        where: {
          slug: s,
          logo_url: { [Op.is]: null },
          logo_data_url: { [Op.is]: null },
        },
      },
    );
    return affected > 0;
  }

  async update(
    id: number,
    data: Partial<{
      slug: string;
      name: string;
      contract_code_hash: string | null;
    }>,
  ) {
    await TenantModel.update(data, { where: { id } });
    return this.findById(id);
  }

  async delete(id: number) {
    return (await TenantModel.destroy({ where: { id } })) > 0;
  }
}
