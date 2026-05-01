import request from 'supertest';
import { App } from 'supertest/types';
import { closeTestApp, setupTestApp } from '@tests/helpers/database.helper';
import { getAuthToken, E2E_TENANT_SLUG } from '@tests/helpers/auth.helper';
import { getDb } from '@repositories/prisma';

function buildMinimalDump(suffix: string, casela: number) {
  return `
COPY public.medicamento (id, nome, dosagem, unidade_medida, principio_ativo, estoque_minimo, preco, "createdAt", "updatedAt") FROM stdin;
99001	E2E Dump Med ${suffix}	500	mg	e2e-dump-princ	0	\\N	2020-01-01 00:00:00+00	2020-01-01 00:00:00+00
\\.
COPY public.residente (num_casela, nome) FROM stdin;
${casela}	E2E Dump Resident ${suffix}
\\.
`;
}

describe('Tenant PG dump import (E2E)', () => {
  let app: App;
  let authToken: string;

  beforeAll(async () => {
    app = await setupTestApp();
    authToken = await getAuthToken(app);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('importa COPY mínimo e associa ao tenant do token', async () => {
    const suffix = `${Date.now()}`;
    const casela = 88000 + (Date.now() % 1000);
    const res = await request(app)
      .post('/api/v1/tenant/import/pg-dump')
      .query({ birthDateFallback: '1970-01-02' })
      .set('Authorization', `Bearer ${authToken}`)
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
      where: { tenant_id: tenant!.id, nome: `E2E Dump Med ${suffix}` },
    });
    expect(med?.id).toBeTruthy();

    const resRow = await getDb().residente.findFirst({
      where: {
        tenant_id: tenant!.id,
        num_casela: casela,
        nome: `E2E Dump Resident ${suffix}`,
      },
    });
    expect(resRow?.data_nascimento?.toISOString().slice(0, 10)).toBe(
      '1970-01-02',
    );
  });
});
