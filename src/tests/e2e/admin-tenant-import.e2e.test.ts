import request from 'supertest';
import * as XLSX from 'xlsx';
import { App } from 'supertest/types';
import { closeTestApp, setupTestApp } from '@tests/helpers/database.helper';
import { E2E_TENANT_SLUG } from '@helpers/e2e-tenant-seed.helper';
import { getDb } from '@repositories/prisma';

const apiKey = () => process.env.X_API_KEY ?? '';

function buildMinimalDump(suffix: string, casela: number) {
  return `
COPY public.medicamento (id, nome, dosagem, unidade_medida, principio_ativo, estoque_minimo, preco, "createdAt", "updatedAt") FROM stdin;
99002\tE2E Admin Dump Med ${suffix}\t500\tmg\te2e-dump-princ\t0\t\\N\t2020-01-01 00:00:00+00\t2020-01-01 00:00:00+00
\\.
COPY public.residente (num_casela, nome) FROM stdin;
${casela}\tE2E Admin Dump Resident ${suffix}
\\.
`;
}

describe('Super-admin tenant import by slug (E2E)', () => {
  let app: App;

  beforeAll(async () => {
    app = await setupTestApp();
    expect(apiKey().length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('GET /admin/tenants/by-slug/:slug/import/template retorna xlsx', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/tenants/by-slug/${E2E_TENANT_SLUG}/import/template`)
      .set('X-API-Key', apiKey());

    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] ?? '')).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    // Supertest nem sempre expõe `res.body` como Buffer sem parser custom.
    const len = Number(res.headers['content-length'] ?? 0);
    expect(len).toBeGreaterThan(0);
  });

  it('POST /admin/tenants/by-slug/:slug/import/xlsx importa e associa ao tenant do slug', async () => {
    const wb = XLSX.utils.book_new();
    const suffix = `${Date.now()}`;

    const meds = XLSX.utils.aoa_to_sheet([
      [
        'nome',
        'principio_ativo',
        'dosagem',
        'unidade_medida',
        'estoque_minimo',
        'preco',
      ],
      [`Dipirona Admin ${suffix}`, 'dipirona', '500', 'mg', 0, 1.5],
    ]);
    XLSX.utils.book_append_sheet(wb, meds, 'Medicamentos');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const res = await request(app)
      .post(`/api/v1/admin/tenants/by-slug/${E2E_TENANT_SLUG}/import/xlsx`)
      .set('X-API-Key', apiKey())
      .attach('file', buf, { filename: 'import.xlsx' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const tenant = await getDb().tenant.findUnique({
      where: { slug: E2E_TENANT_SLUG },
      select: { id: true },
    });
    expect(tenant?.id).toBeTruthy();

    const medCount = await getDb().medicamento.count({
      where: { tenant_id: tenant!.id, nome: `Dipirona Admin ${suffix}` },
    });
    expect(medCount).toBeGreaterThanOrEqual(1);
  });

  it('POST /admin/tenants/by-slug/:slug/import/pg-dump importa COPY mínimo e associa ao tenant do slug', async () => {
    const suffix = `${Date.now()}`;
    const casela = 87000 + (Date.now() % 1000);
    const res = await request(app)
      .post(`/api/v1/admin/tenants/by-slug/${E2E_TENANT_SLUG}/import/pg-dump`)
      .query({ birthDateFallback: '1970-01-03' })
      .set('X-API-Key', apiKey())
      .attach(
        'file',
        Buffer.from(buildMinimalDump(suffix, casela), 'utf8'),
        'e2e-mini.sql',
      );

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary.medicamentos).toBeGreaterThanOrEqual(1);
    expect(res.body.summary.residentes).toBeGreaterThanOrEqual(1);

    const tenant = await getDb().tenant.findUnique({
      where: { slug: E2E_TENANT_SLUG },
      select: { id: true },
    });
    expect(tenant?.id).toBeTruthy();

    const med = await getDb().medicamento.findFirst({
      where: { tenant_id: tenant!.id, nome: `E2E Admin Dump Med ${suffix}` },
    });
    expect(med?.id).toBeTruthy();

    const resRow = await getDb().residente.findFirst({
      where: {
        tenant_id: tenant!.id,
        num_casela: casela,
        nome: `E2E Admin Dump Resident ${suffix}`,
      },
    });
    expect(resRow?.data_nascimento?.toISOString().slice(0, 10)).toBe(
      '1970-01-03',
    );
  });
});
