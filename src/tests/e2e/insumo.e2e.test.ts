import request from 'supertest';
import { setupTestApp } from '../../infrastructure/helpers/database.helper';
import { App } from 'supertest/types';

describe('InsumoController', () => {
  let app: App;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  it('deve criar um insumo', async () => {
    const res = await request(app)
      .post('/api/v1/insumos')
      .send({ nome: 'Seringa', descricao: '10ml', estoque_minimo: 5 });

    expect(res.status).toBe(201);
    expect(res.body.nome).toBe('Seringa');
  });

  it('não deve criar insumo sem nome', async () => {
    const res = await request(app)
      .post('/api/v1/insumos')
      .send({ descricao: 'Sem nome' });

    expect(res.status).toBe(400);
  });

  it('deve listar insumos paginados', async () => {
    const res = await request(app).get('/api/v1/insumos?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('deve atualizar um insumo existente', async () => {
    const res = await request(app)
      .put('/api/v1/insumos/1')
      .send({ nome: 'Seringa Atualizada', descricao: '10ml' });

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe('Seringa Atualizada');
  });

  it('deve retornar 404 ao atualizar insumo inexistente', async () => {
    const res = await request(app)
      .put('/api/v1/insumos/9999')
      .send({ nome: 'Teste' });

    expect(res.status).toBe(404);
  });

  it('deve deletar um insumo', async () => {
    const res = await request(app).delete('/api/v1/insumos/1');
    expect(res.status).toBe(204);
  });

  it('deve retornar 404 ao deletar insumo inexistente', async () => {
    const res = await request(app).delete('/api/v1/insumos/9999');
    expect(res.status).toBe(404);
  });
});
