import request from 'supertest';
import { setupTestApp } from '@tests/helpers/database.helper';
import { prisma } from '@repositories/prisma';
import { App } from 'supertest/types';
import { seedDB, SeedResult } from '@repositories/seed/estoque.seed';
import { ItemType, StockRawResponse } from '@helpers/utils';

let app: App;
let seed: SeedResult;

beforeAll(async () => {
  app = await setupTestApp();
  seed = await seedDB(app);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Input Stock E2E - CRUD', () => {
  let createdInputStockId: number;

  it('deve registrar entrada de insumo', async () => {
    const res = await request(app)
      .post('/api/v1/estoque/entrada')
      .set('Authorization', `Bearer ${seed.token}`)
      .send({
        insumo_id: seed.inputId,
        armario_id: seed.cabinetId,
        gaveta_id: null,
        validade: '2099-12-31',
        quantidade: 20,
        tipo: 'geral',
        setor: 'farmacia',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Entrada de insumo registrada.');
  });

  it('deve listar insumos no estoque', async () => {
    const res = await request(app)
      .get(
        `/api/v1/estoque?type=insumo&page=1&limit=100&cabinet=${encodeURIComponent(String(seed.cabinetId))}`,
      )
      .set('Authorization', `Bearer ${seed.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();

    const found = res.body.data.find(
      (item: StockRawResponse) =>
        Number(item.item_id) === Number(seed.inputId) &&
        item.tipo_item === 'insumo',
    );

    expect(found).toBeDefined();
    if (found) createdInputStockId = found.estoque_id;
  });

  it('deve registrar saída de insumo', async () => {
    expect(createdInputStockId).toBeDefined();
    const res = await request(app)
      .post('/api/v1/estoque/saida')
      .set('Authorization', `Bearer ${seed.token}`)
      .send({
        estoqueId: createdInputStockId,
        tipo: ItemType.INSUMO,
        quantidade: 5,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Saída de insumo realizada.');
  });

  it('não deve permitir saída maior que o estoque de insumo', async () => {
    expect(createdInputStockId).toBeDefined();
    const res = await request(app)
      .post('/api/v1/estoque/saida')
      .set('Authorization', `Bearer ${seed.token}`)
      .send({
        estoqueId: createdInputStockId,
        tipo: ItemType.INSUMO,
        quantidade: 9999,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Quantidade insuficiente');
  });
});
