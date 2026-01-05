import request from 'supertest';
import { setupTestApp } from '../../infrastructure/helpers/database.helper';
import { App } from 'supertest/types';

describe('Login E2E - CRUD', () => {
  let app: App;
  let userId: number;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  it('deve criar um usuário', async () => {
    const res = await request(app)
      .post('/api/v1/login')
      .send({ login: 'joao', password: '1234' });

    expect(res.status).toBe(201);
    expect(res.body.login).toBe('joao');
    expect(res.body.id).toBeDefined();

    userId = res.body.id;
  });

  it('não deve criar login duplicado', async () => {
    const res = await request(app)
      .post('/api/v1/login')
      .send({ login: 'joao', password: 'abcd' });

    expect(res.status).toBe(409);
  });

  it('deve autenticar com sucesso', async () => {
    const res = await request(app)
      .post('/api/v1/login/authenticate')
      .send({ login: 'joao', password: '1234' });

    expect(res.status).toBe(200);
    expect(res.body.login).toBe('joao');
  });

  it('não deve autenticar com senha errada', async () => {
    const res = await request(app)
      .post('/api/v1/login/authenticate')
      .send({ login: 'joao', password: 'senha_errada' });

    expect(res.status).toBe(401);
  });

  it('deve atualizar login e senha', async () => {
    const res = await request(app).put(`/api/v1/login/${userId}`).send({
      currentLogin: 'joao',
      currentPassword: '1234',
      login: 'joao2',
      password: 'nova123',
    });

    expect(res.status).toBe(200);
    expect(res.body.login).toBe('joao2');
  });

  it('não deve atualizar com senha atual incorreta', async () => {
    const res = await request(app).put(`/api/v1/login/${userId}`).send({
      currentLogin: 'joao2',
      currentPassword: 'errada',
      login: 'zz',
      password: 'abc',
    });

    expect(res.status).toBe(401);
  });

  it('deve resetar senha', async () => {
    const res = await request(app).post('/api/v1/login/reset-password').send({
      login: 'joao2',
      newPassword: 'senha_resettada',
    });

    expect(res.status).toBe(200);
    expect(res.body.login).toBe('joao2');
  });

  it('deve deletar o usuário', async () => {
    const res = await request(app).delete(`/api/v1/login/${userId}`);
    expect(res.status).toBe(204);
  });

  it('não deve deletar novamente', async () => {
    const res = await request(app).delete(`/api/v1/login/${userId}`);
    expect(res.status).toBe(404);
  });
});
