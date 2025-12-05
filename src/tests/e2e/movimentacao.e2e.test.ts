import { App } from "supertest/types";
import request from "supertest";
import { setupTestApp } from "../../infrastructure/helpers/database.helper";
import { seedDB, SeedResult } from "../../infrastructure/database/seed/estoque.seed";
import { seedEntriesDB, SeedEntries } from "../../infrastructure/database/seed/movimentacao.seed";
import { sequelize } from "../../infrastructure/database/sequelize";

describe("E2E Movimentação", () => {
  let app: App;
  let seed: SeedResult;
  let entries: SeedEntries;

  let medMovementId: number;
  let inputMovementId: number;

  beforeAll(async () => {
    app = await setupTestApp();
    seed = await seedDB(app);
    entries = await seedEntriesDB(app, seed);
  });

  afterAll(async () => {
      await sequelize.close();
    });

  it("deve criar movimentação de medicamento", async () => {
    const res = await request(app)
      .post("/api/movimentacoes")
      .send({
        tipo: "entrada",
        data: new Date(),
        login_id: 1,
        insumo_id: null,
        medicamento_id: entries.medStockId, 
        armario_id: seed.cabinetId,
        quantidade: 10, 
        casela_id: seed.residentCasela,
      })
      .expect(201);

    medMovementId = res.body.id;

    expect(res.body.estoque_id).toBe(entries.medStockId);
  });

  it("deve criar movimentação de insumo", async () => {
    const res = await request(app)
      .post("/api/movimentacoes")
      .send({
        tipo: "entrada",
        data: new Date(),
        login_id: 1,
        insumo_id:  entries.inputStockId,
        medicamento_id: null, 
        armario_id: seed.cabinetId,
        quantidade: 10, 
        casela_id: null,
      })
      .expect(201);

    inputMovementId = res.body.id;

    expect(res.body.estoque_id).toBe(entries.inputStockId);
  });
});

