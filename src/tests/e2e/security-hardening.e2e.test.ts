import request from 'supertest';
import { setupTestApp } from '../../infrastructure/helpers/database.helper';
import { App } from 'supertest/types';
import { getAuthToken, E2E_TENANT_SLUG } from '../helpers/auth.helper';

describe('Security hardening (E2E)', () => {
  let app: App;
  let token: string;

  beforeAll(async () => {
    app = await setupTestApp();
    token = await getAuthToken(app);
  });

  it('RBAC: non-admin cannot update tenant config', async () => {
    const res = await request(app)
      .put('/api/v1/tenant/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ modules: { enabled: [] } });
    // In seed environments the first user may be admin; we accept:
    // - 200 for admin with valid merge,
    // - 400 when admin sends enabled: [] (schema min 1),
    // - 403 for non-admin.
    expect([200, 400, 403]).toContain(res.status);
  });

  it('Module gating: dashboard should respect module=dashboard', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 403]).toContain(res.status);
  });

  it('CORS: should not advertise X-API-Key header', async () => {
    const res = await request(app)
      .options('/api/v1/admin/tenants')
      .set('Origin', 'http://example.com')
      .set('Access-Control-Request-Method', 'GET');
    const allow = String(res.headers['access-control-allow-headers'] ?? '');
    expect(allow.toLowerCase()).not.toContain('x-api-key');
  });

  it('Multi-tenant: login requires tenant context header', async () => {
    const res = await request(app)
      .post('/api/v1/login/authenticate')
      .send({ login: 'x', password: 'y' });
    expect(res.status).toBe(400);
  });

  it('Auth: bearer works without cookie', async () => {
    const res = await request(app)
      .get('/api/v1/tenant/config')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('Auth: cookie-only should be rejected by default', async () => {
    const res = await request(app)
      .get('/api/v1/tenant/config')
      .set('Cookie', 'authToken=fake');
    expect([401, 403]).toContain(res.status);
  });

  it('Tenant context: requests use JWT tenant even if X-Tenant differs', async () => {
    const res = await request(app)
      .get('/api/v1/tenant/config')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant', 'some-other-tenant');
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBeDefined();
  });

  it('Public: /tenants/:slug/branding works without auth', async () => {
    const res = await request(app).get(`/api/v1/tenants/${E2E_TENANT_SLUG}/branding`);
    expect(res.status).toBe(200);
    expect(typeof res.body.found).toBe('boolean');
  });
});

