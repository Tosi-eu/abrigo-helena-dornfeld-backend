import { App } from 'supertest/types';
import { closeTestApp, setupTestApp } from '@tests/helpers/database.helper';
import { getAuthToken } from '@tests/helpers/auth.helper';
import request from 'supertest';

describe('Resident E2E - CRUD básico', () => {
  let createdCasela: number;
  let app: App;
  let authToken: string;

  beforeAll(async () => {
    app = await setupTestApp();
    authToken = await getAuthToken(app);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('deve criar um residente', async () => {
    const res = await request(app)
      .post('/api/v1/residentes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ casela: 10, nome: 'Fulano' });

    expect(res.status).toBe(201);
    expect(res.body.casela).toBe(10);

    createdCasela = res.body.casela;
  });

  it('deve atualizar um residente', async () => {
    const res = await request(app)
      .put(`/api/v1/residentes/${createdCasela}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ nome: 'Fulano Atualizado' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Fulano Atualizado');
  });

  it('não deve atualizar com nome inválido', async () => {
    const res = await request(app)
      .put(`/api/v1/residentes/${createdCasela}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ nome: '' });

    expect(res.status).toBe(400);
  });

  it('deve remover um residente', async () => {
    const res = await request(app)
      .delete(`/api/v1/residentes/${createdCasela}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(204);
  });

  it('não deve remover novamente', async () => {
    const res = await request(app)
      .delete(`/api/v1/residentes/${createdCasela}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});
