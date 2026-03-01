import request from 'supertest';
import { setupTestApp } from '../../infrastructure/helpers/database.helper';
import { sequelize } from '../../infrastructure/database/sequelize';
import { App } from 'supertest/types';
import {
  seedDB,
  SeedResult,
} from '../../infrastructure/database/seed/estoque.seed';
import { ItemType, StockRawResponse } from '../../core/utils/utils';

let app: App;
let seed: SeedResult;

beforeAll(async () => {
  app = await setupTestApp();
  seed = await seedDB(app);
});

afterAll(async () => {
  await sequelize.close();
});

describe('Input Stock E2E - CRUD', () => {
  let createdInputStockId: number;

  it('deve registrar entrada de insumo', async () => {
    const res = await request(app)
      .post('/api/v1/estoque/entrada')
      .set('Cookie', seed.cookie)
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
      .get('/api/v1/estoque')
      .set('Cookie', seed.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();

    const found = res.body.data.find(
      (item: StockRawResponse) =>
        item.item_id === seed.inputId && item.tipo_item === 'insumo',
    );

    expect(found).toBeDefined();
    if (found) createdInputStockId = found.estoque_id;
  });

  it('deve registrar saída de insumo', async () => {
    expect(createdInputStockId).toBeDefined();
    const res = await request(app)
      .post('/api/v1/estoque/saida')
      .set('Cookie', seed.cookie)
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
      .set('Cookie', seed.cookie)
      .send({
        estoqueId: createdInputStockId,
        tipo: ItemType.INSUMO,
        quantidade: 9999,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Quantidade insuficiente');
  });
});
