import { SystemConfigModel } from '../models/system-config.model';

export class SystemConfigRepository {
  async getAll(): Promise<Record<string, string>> {
    const rows = await SystemConfigModel.findAll({
      attributes: ['key', 'value'],
    });
    const out: Record<string, string> = {};
    for (const r of rows) {
      out[r.key] = r.value ?? '';
    }
    return out;
  }

  async get(key: string): Promise<string | null> {
    const row = await SystemConfigModel.findOne({
      where: { key },
      attributes: ['value'],
    });
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const row = await SystemConfigModel.findOne({ where: { key } });
    if (row) {
      await row.update({ value });
    } else {
      await SystemConfigModel.create({ key, value });
    }
  }

  async setMany(config: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(config)) {
      await this.set(key, value);
    }
  }
}
