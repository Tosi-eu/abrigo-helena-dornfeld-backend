import request from 'supertest';
import { setupTestApp } from '@tests/helpers/database.helper';
import { E2E_TENANT_SLUG } from '@helpers/e2e-tenant-seed.helper';
import { getAuthToken } from '@tests/helpers/auth.helper';
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

  it('GET /login/resolve-tenant retorna o slug quando o e-mail existe em um único abrigo', async () => {
    const res = await request(app)
      .get('/api/v1/login/resolve-tenant')
      .query({ login: 'resolver@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.slug).toBe(E2E_TENANT_SLUG);
  });

  it('GET /login/resolve-tenant sem correspondência retorna 404', async () => {
    const res = await request(app)
      .get('/api/v1/login/resolve-tenant')
      .query({ login: 'naoexiste99999@example.com' });
    expect(res.status).toBe(404);
  });

  it('GET /login/tenants-for-email retorna lista com um abrigo', async () => {
    const res = await request(app)
      .get('/api/v1/login/tenants-for-email')
      .query({ login: 'resolver@example.com' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tenants)).toBe(true);
    expect(res.body.tenants).toHaveLength(1);
    expect(res.body.tenants[0]).toMatchObject({
      slug: E2E_TENANT_SLUG,
      label: expect.any(String),
    });
  });

  it('GET /login/tenants-for-email sem correspondência retorna tenants vazio', async () => {
    const res = await request(app)
      .get('/api/v1/login/tenants-for-email')
      .query({ login: 'naoexiste88888@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.tenants).toEqual([]);
  });

  it('rota autenticada sem cookie deve retornar 401', async () => {
    const res = await request(app).get('/api/v1/medicamentos?page=1&limit=5');
    expect(res.status).toBe(401);
  });

  it('com bearer válido, tenant vem do JWT (não exige X-Tenant na API)', async () => {
    const token = await getAuthToken(app);
    const res = await request(app)
      .get('/api/v1/medicamentos?page=1&limit=5')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
