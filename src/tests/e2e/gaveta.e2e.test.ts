import request from 'supertest';
import { setupTestApp } from '../../infrastructure/helpers/database.helper';
import { App } from 'supertest/types';

describe('Drawer E2E - CRUD básico', () => {
  let app: App;
  let createdNumber: number;
  let categoryId: number;

  beforeAll(async () => {
    app = await setupTestApp();

    const cat = await request(app)
      .post('/api/categoria-gaveta')
      .send({ nome: 'Categoria Teste' });

    categoryId = cat.body.id;
  });

  it('deve criar uma gaveta', async () => {
    const res = await request(app)
      .post('/api/gavetas')
      .send({ numero: 1, categoria_id: categoryId });

    expect(res.status).toBe(201);
    expect(res.body.numero).toBe(1);

    createdNumber = res.body.numero;
  });

  it('deve atualizar uma gaveta', async () => {
    const res = await request(app)
      .put(`/api/gavetas/${createdNumber}`)
      .send({ categoria_id: categoryId });

    expect(res.status).toBe(200);
    expect(res.body.categoria_id).toBe(categoryId);
  });

  it('não deve atualizar com categoria inválida', async () => {
    const res = await request(app)
      .put(`/api/armarios/${createdNumber}`)
      .send({ categoria_id: 0 });

    expect(res.status).toBe(400);
  });

  it('deve remover uma gaveta', async () => {
    const res = await request(app).delete(`/api/gavetas/${createdNumber}`);
    expect(res.status).toBe(204);
  });

  it('não deve remover novamente', async () => {
    const res = await request(app).delete(`/api/gavetas/${createdNumber}`);
    expect(res.status).toBe(404);
  });
});
