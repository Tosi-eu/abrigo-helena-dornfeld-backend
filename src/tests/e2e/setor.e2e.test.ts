import request from 'supertest';
import { setupTestApp } from '@tests/helpers/database.helper';
import { getAuthToken } from '@tests/helpers/auth.helper';
import {
  E2E_RESOLVER_SEED_USER,
  E2E_TENANT_SLUG,
} from '@helpers/e2e-tenant-seed.helper';
import { App } from 'supertest/types';

async function getNonAdminToken(app: App): Promise<string> {
  const res = await request(app)
    .post('/api/v1/login/authenticate')
    .set('X-Tenant', E2E_TENANT_SLUG)
    .send({
      login: E2E_RESOLVER_SEED_USER.login,
      password: E2E_RESOLVER_SEED_USER.password,
    });
  const token = res.body?.token;
  if (res.status >= 200 && res.status < 300 && token) {
    return String(token);
  }
  throw new Error(
    `Falha ao autenticar usuário não-admin (${res.status}): ${JSON.stringify(res.body)}`,
  );
}

function sectorKeys(data: unknown): string[] {
  if (!data || !Array.isArray((data as { data?: unknown }).data)) return [];
  return (data as { data: Array<{ key: string }> }).data.map(s =>
    String(s.key).toLowerCase(),
  );
}

describe('Setores (E2E) — catálogo e enabled_sectors', () => {
  let app: App;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await setupTestApp();
    adminToken = await getAuthToken(app);
    userToken = await getNonAdminToken(app);
  });

  it('GET /tenant/setores sem auth retorna 401', async () => {
    const res = await request(app).get('/api/v1/tenant/setores');
    expect(res.status).toBe(401);
  });

  it('GET /tenant/setores com token lista farmácia e enfermagem (seed)', async () => {
    const res = await request(app)
      .get('/api/v1/tenant/setores')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const keys = sectorKeys(res.body);
    expect(keys).toContain('farmacia');
    expect(keys).toContain('enfermagem');
  });

  it('POST /tenant/setores como usuário comum retorna 403', async () => {
    const res = await request(app)
      .post('/api/v1/tenant/setores')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        key: 'nao_deve_criar',
        nome: 'Não criar',
        proportionProfile: 'farmacia',
      });
    expect(res.status).toBe(403);
  });

  it('POST /tenant/setores com chave inválida retorna 400', async () => {
    const res = await request(app)
      .post('/api/v1/tenant/setores')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'com espaço',
        nome: 'Setor inválido',
        proportionProfile: 'farmacia',
      });
    expect(res.status).toBe(400);
  });

  it('admin cria setor personalizado e PUT tenant/config habilita enabled_sectors', async () => {
    const key = `e2e_sec_${Date.now()}`;
    const create = await request(app)
      .post('/api/v1/tenant/setores')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key,
        nome: 'Setor E2E',
        proportionProfile: 'enfermagem',
      });
    expect(create.status).toBe(201);
    expect(create.body).toMatchObject({
      key: key.toLowerCase(),
      nome: 'Setor E2E',
      proportion_profile: 'enfermagem',
    });

    const list = await request(app)
      .get('/api/v1/tenant/setores')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(sectorKeys(list.body)).toContain(key.toLowerCase());

    const dup = await request(app)
      .post('/api/v1/tenant/setores')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key,
        nome: 'Duplicado',
        proportionProfile: 'farmacia',
      });
    expect(dup.status).toBe(409);

    const cfgRes = await request(app)
      .get('/api/v1/tenant/config')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(cfgRes.status).toBe(200);
    const modules = cfgRes.body.modules as {
      enabled: string[];
      enabled_sectors: string[];
      automatic_price_search: boolean;
      automatic_reposicao_notifications: boolean;
    };
    expect(modules.enabled_sectors.length).toBeGreaterThan(0);

    const badPut = await request(app)
      .put('/api/v1/tenant/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        modules: {
          ...modules,
          enabled_sectors: [
            ...modules.enabled_sectors,
            'setor_inexistente_xyz',
          ],
        },
      });
    expect(badPut.status).toBe(400);
    expect(String(badPut.body?.error ?? '')).toMatch(
      /catálogo|enabled_sectors/i,
    );

    const okPut = await request(app)
      .put('/api/v1/tenant/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        modules: {
          ...modules,
          enabled_sectors: [
            ...new Set([...modules.enabled_sectors, key.toLowerCase()]),
          ],
        },
      });
    expect(okPut.status).toBe(200);
    expect(okPut.body.modules.enabled_sectors).toContain(key.toLowerCase());

    const cfgAfter = await request(app)
      .get('/api/v1/tenant/config')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(cfgAfter.status).toBe(200);
    expect(cfgAfter.body.modules.enabled_sectors).toContain(key.toLowerCase());
  });
});
