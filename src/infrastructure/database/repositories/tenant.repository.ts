import TenantModel from '../models/tenant.model';
import { Op } from 'sequelize';

export class TenantRepository {
  async findById(id: number) {
    return TenantModel.findByPk(id, {
      attributes: ['id', 'slug', 'name', 'brand_name', 'logo_data_url'],
    });
  }

  async findBySlug(slug: string) {
    return TenantModel.findOne({
      where: { slug },
      attributes: ['id', 'slug', 'name', 'brand_name', 'logo_data_url'],
    });
  }

  async list(page = 1, limit = 25) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
    const offset = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
      TenantModel.findAll({
        attributes: ['id', 'slug', 'name', 'brand_name', 'logo_data_url'],
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

  async create(data: { slug: string; name: string }) {
    const row = await TenantModel.create({ slug: data.slug, name: data.name });
    return { id: row.id, slug: row.slug, name: row.name };
  }

  async updateBranding(
    id: number,
    data: Partial<{ brand_name: string | null; logo_data_url: string | null }>,
  ) {
    await TenantModel.update(data, { where: { id } });
    return this.findById(id);
  }

  async update(id: number, data: Partial<{ slug: string; name: string }>) {
    await TenantModel.update(data, { where: { id } });
    return this.findById(id);
  }

  async delete(id: number) {
    return (await TenantModel.destroy({ where: { id } })) > 0;
  }
}
