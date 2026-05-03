import request from 'supertest';
import { closeTestApp, setupTestApp } from '@tests/helpers/database.helper';
import {
  E2E_TENANT_SLUG,
  E2E_SEED_USER,
  E2E_RESOLVER_SEED_USER,
} from '@helpers/e2e-tenant-seed.helper';
import { getDb } from '@repositories/prisma';
import { App } from 'supertest/types';

describe('Login E2E - CRUD', () => {
  let app: App;
  let authToken: string | undefined;

  beforeAll(async () => {
    app = await setupTestApp();
    await getDb().login.deleteMany({
      where: {
        login: {
          in: [
            E2E_SEED_USER.login,
            E2E_RESOLVER_SEED_USER.login,
            'joao',
            'joao2',
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('deve criar um usuário', async () => {
    const res = await request(app)
      .post('/api/v1/login')
      .set('X-Tenant', E2E_TENANT_SLUG)
      .send({ login: 'joao', password: 'senha1234' });

    expect(res.status).toBe(201);
    expect(res.body.login).toBe('joao');
    expect(res.body.id).toBeDefined();
  });

  it('não deve criar login duplicado', async () => {
    const res = await request(app)
      .post('/api/v1/login')
      .set('X-Tenant', E2E_TENANT_SLUG)
      .send({ login: 'joao', password: 'abcd1234' });

    expect(res.status).toBe(409);
  });

  it('deve autenticar com sucesso', async () => {
    const res = await request(app)
      .post('/api/v1/login/authenticate')
      .set('X-Tenant', E2E_TENANT_SLUG)
      .send({ login: 'joao', password: 'senha1234' });

    expect(res.status).toBe(200);
    expect(res.body.user?.login).toBe('joao');
    authToken = res.body.token;
  });

  it('não deve autenticar com senha errada', async () => {
    const res = await request(app)
      .post('/api/v1/login/authenticate')
      .set('X-Tenant', E2E_TENANT_SLUG)
      .send({ login: 'joao', password: 'senhaerrada1' });

    expect(res.status).toBe(401);
  });

  it('deve atualizar login e senha', async () => {
    const res = await request(app)
      .put('/api/v1/login')
      .set('Authorization', `Bearer ${authToken ?? ''}`)
      .send({
        currentPassword: 'senha1234',
        login: 'joao2',
        password: 'nova1234',
      });

    expect(res.status).toBe(200);
    expect(res.body.login).toBe('joao2');
  });

  it('não deve atualizar com senha atual incorreta', async () => {
    const res = await request(app)
      .put('/api/v1/login')
      .set('Authorization', `Bearer ${authToken ?? ''}`)
      .send({
        currentPassword: 'errada123',
        login: 'zz',
        password: 'abc12345',
      });

    expect(res.status).toBe(401);
  });

  it('deve resetar senha (admin)', async () => {
    const res = await request(app)
      .post('/api/v1/login/reset-password')
      .set('Authorization', `Bearer ${authToken ?? ''}`)
      .send({
        login: 'joao2',
        newPassword: 'senha_resettada1',
      });

    expect(res.status).toBe(200);
    expect(res.body.login).toBe('joao2');
  });

  it('não deve resetar senha com login inexistente', async () => {
    const res = await request(app)
      .post('/api/v1/login/reset-password')
      .set('Authorization', `Bearer ${authToken ?? ''}`)
      .send({
        login: 'usuario_inexistente',
        newPassword: 'nova_senha1',
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Login não encontrado');
  });

  it('deve deletar o usuário', async () => {
    const res = await request(app)
      .delete('/api/v1/login')
      .set('Authorization', `Bearer ${authToken ?? ''}`);
    expect(res.status).toBe(204);
  });

  it('não deve deletar novamente', async () => {
    const res = await request(app)
      .delete('/api/v1/login')
      .set('Authorization', `Bearer ${authToken ?? ''}`);
    expect([401, 403, 404]).toContain(res.status);
  });
});
