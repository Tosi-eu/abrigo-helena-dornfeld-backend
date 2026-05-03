import { getDb } from '@repositories/prisma';

export class PrismaSystemConfigRepository {
  async getAll(): Promise<Record<string, string>> {
    const rows = await getDb().systemConfig.findMany({
      select: { key: true, value: true },
    });
    const out: Record<string, string> = {};
    for (const r of rows) {
      out[r.key] = r.value ?? '';
    }
    return out;
  }

  async get(key: string): Promise<string | null> {
    const row = await getDb().systemConfig.findUnique({
      where: { key },
      select: { value: true },
    });
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await getDb().systemConfig.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  async setMany(config: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(config)) {
      await this.set(key, value);
    }
  }
}
