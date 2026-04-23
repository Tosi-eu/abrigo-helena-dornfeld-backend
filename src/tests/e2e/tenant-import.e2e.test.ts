import request from 'supertest';
import * as XLSX from 'xlsx';
import { App } from 'supertest/types';
import { closeTestApp, setupTestApp } from '@tests/helpers/database.helper';
import { getAuthToken, E2E_TENANT_SLUG } from '@tests/helpers/auth.helper';
import { getDb } from '@repositories/prisma';

describe('Tenant import XLSX (E2E)', () => {
  let app: App;
  let authToken: string;

  beforeAll(async () => {
    app = await setupTestApp();
    authToken = await getAuthToken(app);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('importa parcialmente (linhas válidas entram; inválidas viram erro)', async () => {
    const wb = XLSX.utils.book_new();

    const meds = XLSX.utils.aoa_to_sheet([
      [
        'nome',
        'principio_ativo',
        'dosagem',
        'unidade_medida',
        'estoque_minimo',
        'preco',
      ],
      ['Dipirona', 'dipirona', '500', 'mg', 0, 1.5],
    ]);
    const inputs = XLSX.utils.aoa_to_sheet([
      ['nome', 'descricao', 'estoque_minimo', 'preco'],
      ['Gaze', 'Gaze estéril', 0, 0.5],
      ['', 'linha inválida', 0, 0], // inválida: nome obrigatório
    ]);
    const residents = XLSX.utils.aoa_to_sheet([
      ['casela', 'nome'],
      [1, 'Fulano'],
    ]);

    XLSX.utils.book_append_sheet(wb, meds, 'Medicamentos');
    XLSX.utils.book_append_sheet(wb, inputs, 'Insumos');
    XLSX.utils.book_append_sheet(wb, residents, 'Residentes');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const res = await request(app)
      .post('/api/v1/tenant/import/xlsx')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', buf, { filename: 'import.xlsx' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(
      res.body.summary.inputs.created + res.body.summary.inputs.updated,
    ).toBeGreaterThanOrEqual(1);
    expect(res.body.summary.inputs.errors).toBe(1);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThanOrEqual(1);

    // Confere que os dados entraram pro tenant do token (via DB).
    const tenant = await getDb().tenant.findUnique({
      where: { slug: E2E_TENANT_SLUG },
      select: { id: true },
    });
    expect(tenant?.id).toBeTruthy();
    const tenantId = tenant!.id;

    const medCount = await getDb().medicamento.count({
      where: { tenant_id: tenantId, nome: 'Dipirona' },
    });
    const inputCount = await getDb().insumo.count({
      where: { tenant_id: tenantId, nome: 'Gaze' },
    });
    const residentCount = await getDb().residente.count({
      where: { tenant_id: tenantId, num_casela: 1, nome: 'Fulano' },
    });

    expect(medCount).toBeGreaterThanOrEqual(1);
    expect(inputCount).toBeGreaterThanOrEqual(1);
    expect(residentCount).toBeGreaterThanOrEqual(1);
  });
});
