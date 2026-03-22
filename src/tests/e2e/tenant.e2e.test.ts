import request from 'supertest';
import { setupTestApp } from '../../infrastructure/helpers/database.helper';
import { E2E_TENANT_SLUG } from '../../infrastructure/helpers/e2e-tenant-seed.helper';
import { getAuthCookie } from '../helpers/auth.helper';
import { App } from 'supertest/types';

describe('Tenant E2E — API pública e contexto', () => {
  let app: App;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  it('GET /tenants deve listar o tenant seed com shape do contrato público', async () => {
    const res = await request(app).get('/api/v1/tenants');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const row = res.body.data.find(
      (t: { slug?: string }) => t.slug === E2E_TENANT_SLUG,
    );
    expect(row).toBeDefined();
    expect(row).toMatchObject({
      id: expect.any(Number),
      slug: E2E_TENANT_SLUG,
      name: expect.any(String),
      brandName: null,
    });
  });

  it('GET /tenants/:slug/branding deve retornar found true para o tenant seed', async () => {
    const res = await request(app).get(
      `/api/v1/tenants/${E2E_TENANT_SLUG}/branding`,
    );
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body.slug).toBe(E2E_TENANT_SLUG);
    expect(res.body).toHaveProperty('requiresContractCode', true);
  });

  it('GET /tenants/:slug/branding com slug inexistente retorna found false', async () => {
    const res = await request(app).get(
      '/api/v1/tenants/slug-que-nao-existe-xyz/branding',
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ found: false });
  });

  it('cadastro e login sem X-Tenant devem falhar (slug obrigatório)', async () => {
    const reg = await request(app)
      .post('/api/v1/login')
      .send({ login: 'sem_tenant', password: 'senha1234' });
    expect(reg.status).toBe(400);

    const auth = await request(app)
      .post('/api/v1/login/authenticate')
      .send({ login: 'sem_tenant', password: 'senha1234' });
    expect(auth.status).toBe(400);
  });

  it('rota autenticada sem cookie deve retornar 401', async () => {
    const res = await request(app).get('/api/v1/medicamentos?page=1&limit=5');
    expect(res.status).toBe(401);
  });

  it('com cookie válido, tenant vem do JWT (não exige X-Tenant na API)', async () => {
    const cookie = await getAuthCookie(app);
    const res = await request(app)
      .get('/api/v1/medicamentos?page=1&limit=5')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
  });
});
