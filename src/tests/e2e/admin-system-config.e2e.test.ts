import request from 'supertest';
import { App } from 'supertest/types';
import { closeTestApp, setupTestApp } from '@tests/helpers/database.helper';
import { getAuthToken } from '@tests/helpers/auth.helper';
import { prisma } from '@repositories/prisma';
import { E2E_SEED_USER } from '@helpers/e2e-tenant-seed.helper';

describe('Admin system_config (E2E)', () => {
  let app: App;
  const apiKey = process.env.X_API_KEY ?? '';

  beforeAll(async () => {
    app = await setupTestApp();
  });

  afterAll(async () => {
    await prisma.login.updateMany({
      where: { login: E2E_SEED_USER.login },
      data: { role: 'user' },
    });
    await closeTestApp();
  });

  it('GET /api/v1/admin/config com X-API-Key devolve display e system', async () => {
    if (!apiKey) throw new Error('X_API_KEY em falta para e2e');
    const res = await request(app)
      .get('/api/v1/admin/config')
      .set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('display');
    expect(res.body).toHaveProperty('system');
    expect(res.body.system).toHaveProperty('cors');
    expect(res.body.system.cors.allowedOrigins.length).toBeGreaterThan(0);
  });

  it('PUT /api/v1/admin/config com X-API-Key atualiza system', async () => {
    if (!apiKey) throw new Error('X_API_KEY em falta para e2e');
    const res = await request(app)
      .put('/api/v1/admin/config')
      .set('X-API-Key', apiKey)
      .send({
        system: {
          ttl: { authCacheSeconds: 31 },
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.system.ttl.authCacheSeconds).toBe(31);
  });

  it('GET /api/v1/admin/config com JWT admin', async () => {
    await prisma.login.updateMany({
      where: { login: E2E_SEED_USER.login },
      data: { role: 'admin' },
    });
    const token = await getAuthToken(app);
    const res = await request(app)
      .get('/api/v1/admin/config')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.system).toBeTruthy();
  });
});
