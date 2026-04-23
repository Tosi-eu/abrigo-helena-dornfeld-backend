import request from 'supertest';
import { closeTestApp, setupTestApp } from '@tests/helpers/database.helper';
import { getAuthToken } from '@tests/helpers/auth.helper';
import { App } from 'supertest/types';

describe('Cabinet E2E - CRUD básico', () => {
  let app: App;
  let createdNumber: number;
  let categoryId: number;
  let authToken: string;
  const cabinetNumero = 800_000 + Math.floor(Math.random() * 99_000);

  beforeAll(async () => {
    app = await setupTestApp();
    authToken = await getAuthToken(app);

    const cat = await request(app)
      .post('/api/v1/categoria-armario')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ nome: 'Categoria Teste' });

    categoryId = cat.body.id;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('deve criar um armário', async () => {
    const res = await request(app)
      .post('/api/v1/armarios')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ numero: cabinetNumero, categoria_id: categoryId });

    expect(res.status).toBe(201);
    expect(res.body.numero).toBe(cabinetNumero);

    createdNumber = res.body.numero;
  });

  it('deve atualizar um armário', async () => {
    const res = await request(app)
      .put(`/api/v1/armarios/${createdNumber}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ categoria_id: categoryId });

    expect(res.status).toBe(200);
    expect(res.body.categoria_id).toBe(categoryId);
  });

  it('não deve atualizar com categoria inválida', async () => {
    const res = await request(app)
      .put(`/api/v1/armarios/${createdNumber}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ categoria_id: 0 });

    expect(res.status).toBe(400);
  });

  it('deve remover um armário', async () => {
    const res = await request(app)
      .delete(`/api/v1/armarios/${createdNumber}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(204);
  });

  it('não deve remover novamente', async () => {
    const res = await request(app)
      .delete(`/api/v1/armarios/${createdNumber}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});
