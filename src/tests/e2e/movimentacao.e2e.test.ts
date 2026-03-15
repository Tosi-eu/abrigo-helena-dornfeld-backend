import { App } from 'supertest/types';
import request from 'supertest';
import { setupTestApp } from '../../infrastructure/helpers/database.helper';
import {
  seedDB,
  SeedResult,
} from '../../infrastructure/database/seed/estoque.seed';
import {
  seedEntriesDB,
  SeedEntries,
} from '../../infrastructure/database/seed/movimentacao.seed';
import { sequelize } from '../../infrastructure/database/sequelize';

describe('E2E Movimentação', () => {
  let app: App;
  let seed: SeedResult;
  let entries: SeedEntries;

  beforeAll(async () => {
    app = await setupTestApp();
    seed = await seedDB(app);
    entries = await seedEntriesDB(app, seed);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('deve criar movimentação de medicamento', async () => {
    const res = await request(app)
      .post('/api/v1/movimentacoes')
      .set('Cookie', seed.cookie)
      .send({
        tipo: 'entrada',
        data: new Date(),
        login_id: 1,
        insumo_id: null,
        medicamento_id: entries.medStockId,
        armario_id: seed.cabinetId,
        gaveta_id: null,
        quantidade: 10,
        casela_id: seed.residentCasela,
        validade: new Date(),
        origem: 'UBS',
        setor: 'farmacia',
        lote: 'LOTE-1',
        observacao: 'teste',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
  });

  it('deve criar movimentação de insumo', async () => {
    const res = await request(app)
      .post('/api/v1/movimentacoes')
      .set('Cookie', seed.cookie)
      .send({
        tipo: 'entrada',
        data: new Date(),
        login_id: 1,
        insumo_id: entries.inputStockId,
        medicamento_id: null,
        armario_id: seed.cabinetId,
        gaveta_id: null,
        quantidade: 10,
        casela_id: null,
        validade: new Date(),
        origem: 'UBS',
        setor: 'farmacia',
        lote: 'LOTE-1',
        observacao: 'teste',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
  });
});
