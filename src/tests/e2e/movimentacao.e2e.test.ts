import { App } from 'supertest/types';
import request from 'supertest';
import { setupTestApp } from '@tests/helpers/database.helper';
import { seedDB, SeedResult } from '@repositories/seed/estoque.seed';
import { seedEntriesDB } from '@repositories/seed/movimentacao.seed';
import { prisma } from '@repositories/prisma';

describe('E2E Movimentação', () => {
  let app: App;
  let seed: SeedResult;

  beforeAll(async () => {
    app = await setupTestApp();
    seed = await seedDB(app);
    await seedEntriesDB(app, seed);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('deve criar movimentação de medicamento', async () => {
    const res = await request(app)
      .post('/api/v1/movimentacoes')
      .set('Authorization', `Bearer ${seed.token}`)
      .send({
        tipo: 'entrada',
        data: new Date(),
        login_id: 1,
        insumo_id: null,
        medicamento_id: seed.medicineId,
        armario_id: seed.cabinetId,
        gaveta_id: null,
        quantidade: 10,
        casela_id: seed.residentId,
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
      .set('Authorization', `Bearer ${seed.token}`)
      .send({
        tipo: 'entrada',
        data: new Date(),
        login_id: 1,
        insumo_id: seed.inputId,
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
