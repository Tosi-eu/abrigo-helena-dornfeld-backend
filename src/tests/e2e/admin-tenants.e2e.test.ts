import request from 'supertest';
import { setupTestApp } from '../../infrastructure/helpers/database.helper';
import { E2E_TENANT_SLUG } from '../../infrastructure/helpers/e2e-tenant-seed.helper';
import { App } from 'supertest/types';

const apiKey = () => process.env.X_API_KEY ?? '';

describe('Admin tenants + verify-contract-code (E2E)', () => {
  let app: App;

  beforeAll(async () => {
    app = await setupTestApp();
    expect(apiKey().length).toBeGreaterThan(0);
  });

  it('GET /admin/tenants sem API key deve falhar', async () => {
    const res = await request(app).get('/api/v1/admin/tenants');
    expect([401, 403]).toContain(res.status);
  });

  it('GET /admin/tenants com X-API-Key lista tenants (inclui seed e2e)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/tenants?page=1&limit=50')
      .set('X-API-Key', apiKey());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total: expect.any(Number),
      page: 1,
      data: expect.any(Array),
    });
    const slugs = res.body.data.map((t: { slug: string }) => t.slug);
    expect(slugs).toContain(E2E_TENANT_SLUG);
  });

  it('POST /admin/tenants cria tenant com código de contrato', async () => {
    const slug = `ct-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/admin/tenants')
      .set('X-API-Key', apiKey())
      .send({
        slug,
        name: 'Tenant contract e2e',
        contract_code: 'E2E-CONTRACT-99',
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ slug, name: 'Tenant contract e2e' });
    expect(res.body.id).toBeDefined();
  });

  it('POST /tenants/:slug/verify-contract-code — sem código no tenant', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${E2E_TENANT_SLUG}/verify-contract-code`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      valid: true,
      contractCodeRequired: false,
    });
  });

  it('POST verify-contract-code — código correto e incorreto', async () => {
    const slug = `vc-${Date.now()}`;
    const plain = 'SEGREDO-E2E-001';
    await request(app)
      .post('/api/v1/admin/tenants')
      .set('X-API-Key', apiKey())
      .send({ slug, name: 'Verify flow', contract_code: plain });

    const ok = await request(app)
      .post(`/api/v1/tenants/${slug}/verify-contract-code`)
      .send({ contract_code: plain });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({
      valid: true,
      contractCodeRequired: true,
    });

    const missing = await request(app)
      .post(`/api/v1/tenants/${slug}/verify-contract-code`)
      .send({});
    expect(missing.status).toBe(200);
    expect(missing.body).toMatchObject({
      valid: false,
      reason: 'missing',
    });

    const bad = await request(app)
      .post(`/api/v1/tenants/${slug}/verify-contract-code`)
      .send({ contract_code: 'outro' });
    expect(bad.status).toBe(200);
    expect(bad.body).toMatchObject({
      valid: false,
      reason: 'mismatch',
    });
  });

  it('dois abrigos com o mesmo texto de contrato partilham contractPortfolioId', async () => {
    const code = `SHARED-E2E-${Date.now()}`;
    const s1 = `pf1-${Date.now()}`;
    const s2 = `pf2-${Date.now()}`;
    const r1 = await request(app)
      .post('/api/v1/admin/tenants')
      .set('X-API-Key', apiKey())
      .send({ slug: s1, name: 'Abrigo A', contract_code: code });
    const r2 = await request(app)
      .post('/api/v1/admin/tenants')
      .set('X-API-Key', apiKey())
      .send({ slug: s2, name: 'Abrigo B', contract_code: code });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.contract_portfolio_id).toBeDefined();
    expect(r1.body.contract_portfolio_id).toBe(r2.body.contract_portfolio_id);
  });
});
