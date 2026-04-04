import TenantConfigModel from '../models/tenant-config.model';

export class TenantConfigRepository {
  async getByTenantId(tenantId: number) {
    return TenantConfigModel.findOne({
      where: { tenant_id: tenantId },
      attributes: ['tenant_id', 'modules_json'],
    });
  }

  async listAllTenantIds(): Promise<number[]> {
    const [rows] = await TenantConfigModel.sequelize!.query(
      'SELECT id FROM tenant ORDER BY id ASC',
    );
    return (rows as { id: number }[]).map(r => Number(r.id));
  }

  async setByTenantId(tenantId: number, modulesJson: object) {
    const row = await TenantConfigModel.findOne({
      where: { tenant_id: tenantId },
    });
    if (row) {
      await row.update({ modules_json: modulesJson });
    } else {
      await TenantConfigModel.create({
        tenant_id: tenantId,
        modules_json: modulesJson,
      });
    }
    return this.getByTenantId(tenantId);
  }
}
