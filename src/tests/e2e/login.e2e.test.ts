import request from 'supertest';
import { setupTestApp } from '../../infrastructure/helpers/database.helper';
import { App } from 'supertest/types';

describe('Login E2E - CRUD', () => {
  let app: App;
  let userId: number;
  let authCookie: string | undefined;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  it('deve criar um usuário', async () => {
    const res = await request(app)
      .post('/api/v1/login')
      .send({ login: 'joao', password: 'senha1234' });

    expect(res.status).toBe(201);
    expect(res.body.login).toBe('joao');
    expect(res.body.id).toBeDefined();

    userId = res.body.id;
  });

  it('não deve criar login duplicado', async () => {
    const res = await request(app)
      .post('/api/v1/login')
      .send({ login: 'joao', password: 'abcd1234' });

    expect(res.status).toBe(409);
  });

  it('deve autenticar com sucesso', async () => {
    const res = await request(app)
      .post('/api/v1/login/authenticate')
      .send({ login: 'joao', password: 'senha1234' });

    expect(res.status).toBe(200);
    expect(res.body.user?.login).toBe('joao');
    authCookie = res.headers['set-cookie']?.[0];
  });

  it('não deve autenticar com senha errada', async () => {
    const res = await request(app)
      .post('/api/v1/login/authenticate')
      .send({ login: 'joao', password: 'senhaerrada1' });

    expect(res.status).toBe(401);
  });

  it('deve atualizar login e senha', async () => {
    const res = await request(app)
      .put('/api/v1/login')
      .set('Cookie', authCookie ?? '')
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
      .set('Cookie', authCookie ?? '')
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
      .set('Cookie', authCookie ?? '')
      .send({
        login: 'joao2',
        newPassword: 'senha_resettada',
      });

    expect(res.status).toBe(200);
    expect(res.body.login).toBe('joao2');
  });

  it('não deve resetar senha com login inexistente', async () => {
    const res = await request(app)
      .post('/api/v1/login/reset-password')
      .set('Cookie', authCookie ?? '')
      .send({
        login: 'usuario_inexistente',
        newPassword: 'nova_senha',
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Login não encontrado');
  });

  it('deve deletar o usuário', async () => {
    const res = await request(app)
      .delete('/api/v1/login')
      .set('Cookie', authCookie ?? '');
    expect(res.status).toBe(204);
  });

  it('não deve deletar novamente', async () => {
    const res = await request(app)
      .delete('/api/v1/login')
      .set('Cookie', authCookie ?? '');
    expect([401, 404]).toContain(res.status);
  });
});
