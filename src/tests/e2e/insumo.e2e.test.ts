import request from 'supertest';
import { setupTestApp } from '@tests/helpers/database.helper';
import { getAuthToken } from '@tests/helpers/auth.helper';
import { App } from 'supertest/types';

describe('InsumoController', () => {
  let app: App;
  let authToken: string;
  let createdInsumoId: number;
  const nomeInsumo = `Seringa E2E ${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  beforeAll(async () => {
    app = await setupTestApp();
    authToken = await getAuthToken(app);
  });

  it('deve criar um insumo', async () => {
    const res = await request(app)
      .post('/api/v1/insumos')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ nome: nomeInsumo, descricao: '10ml', estoque_minimo: 5 });

    expect(res.status).toBe(201);
    expect(res.body.nome).toBe(nomeInsumo);
    expect(res.body.id).toBeDefined();
    createdInsumoId = Number(res.body.id);
  });

  it('não deve criar insumo sem nome', async () => {
    const res = await request(app)
      .post('/api/v1/insumos')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ descricao: 'Sem nome' });

    expect(res.status).toBe(400);
  });

  it('deve listar insumos paginados', async () => {
    const res = await request(app)
      .get('/api/v1/insumos?page=1&limit=10')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(
      res.body.data.some(
        (row: { id?: number; nome?: string }) =>
          row.id === createdInsumoId && row.nome === nomeInsumo,
      ),
    ).toBe(true);
  });

  it('deve atualizar um insumo existente', async () => {
    const nomeAposUpdate = `${nomeInsumo} atualizado`;
    const res = await request(app)
      .put(`/api/v1/insumos/${createdInsumoId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ nome: nomeAposUpdate, descricao: '10ml' });

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe(nomeAposUpdate);
  });

  it('deve retornar 404 ao atualizar insumo inexistente', async () => {
    const res = await request(app)
      .put('/api/v1/insumos/9999')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ nome: 'Teste' });

    expect(res.status).toBe(404);
  });

  it('deve deletar um insumo', async () => {
    const res = await request(app)
      .delete(`/api/v1/insumos/${createdInsumoId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(204);
  });

  it('deve retornar 404 ao deletar insumo inexistente', async () => {
    const res = await request(app)
      .delete('/api/v1/insumos/9999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});
