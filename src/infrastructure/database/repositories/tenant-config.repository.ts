import TenantConfigModel from '../models/tenant-config.model';

export class TenantConfigRepository {
  async getByTenantId(tenantId: number) {
    return TenantConfigModel.findOne({
      where: { tenant_id: tenantId },
      attributes: ['tenant_id', 'modules_json'],
    });
  }

  async setByTenantId(tenantId: number, modulesJson: object) {
    const row = await TenantConfigModel.findOne({ where: { tenant_id: tenantId } });
    if (row) {
      await row.update({ modules_json: modulesJson });
    } else {
      await TenantConfigModel.create({ tenant_id: tenantId, modules_json: modulesJson });
    }
    return this.getByTenantId(tenantId);
  }
}

