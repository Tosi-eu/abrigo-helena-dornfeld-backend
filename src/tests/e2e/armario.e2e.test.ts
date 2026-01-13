import request from 'supertest';
import { setupTestApp } from '../../infrastructure/helpers/database.helper';
import { App } from 'supertest/types';

describe('Cabinet E2E - CRUD básico', () => {
  let app: App;
  let createdNumber: number;
  let categoryId: number;

  beforeAll(async () => {
    app = await setupTestApp();

    const cat = await request(app)
      .post('/api/v1/categoria-armario')
      .send({ nome: 'Categoria Teste' });

    categoryId = cat.body.id;
  });

  it('deve criar um armário', async () => {
    const res = await request(app)
      .post('/api/v1/armarios')
      .send({ numero: 1, categoria_id: categoryId });

    expect(res.status).toBe(201);
    expect(res.body.numero).toBe(1);

    createdNumber = res.body.numero;
  });

  it('deve atualizar um armário', async () => {
    const res = await request(app)
      .put(`/api/v1/armarios/${createdNumber}`)
      .send({ categoria_id: categoryId });

    expect(res.status).toBe(200);
    expect(res.body.categoria_id).toBe(categoryId);
  });

  it('não deve atualizar com categoria inválida', async () => {
    const res = await request(app)
      .put(`/api/v1/armarios/${createdNumber}`)
      .send({ categoria_id: 0 });

    expect(res.status).toBe(400);
  });

  it('deve remover um armário', async () => {
    const res = await request(app).delete(`/api/v1/armarios/${createdNumber}`);
    expect(res.status).toBe(204);
  });

  it('não deve remover novamente', async () => {
    const res = await request(app).delete(`/api/v1/armarios/${createdNumber}`);
    expect(res.status).toBe(404);
  });
});
