import request from "supertest";
import express, { Express, Request, Response } from "express";
import { MedicamentoController } from "../../infrastructure/web/controllers/medicamento.controller";
import { MedicamentoService } from "../../core/services/medicamento.service";

jest.mock("../../infrastructure/database/sequelize", () => ({
  authenticate: jest.fn().mockResolvedValue(true),
  define: jest.fn(),
}));

type MockMedicamentoService = {
  cadastrarNovo: jest.Mock;
};

describe("MedicamentoController", () => {
  let app: Express;
  let mockMedicamentoService: MockMedicamentoService;
  let controller: MedicamentoController;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockMedicamentoService = {
      cadastrarNovo: jest.fn(),
    };

    controller = new MedicamentoController(
      mockMedicamentoService as unknown as MedicamentoService
    );

    app.post("/api/medicamentos", (req: Request, res: Response) =>
      controller.create(req, res)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/medicamentos", () => {
    it("deve retornar 201 e o medicamento criado quando os dados são válidos", async () => {
      const medicamentoData = {
        nome: "Paracetamol",
        dosagem: 500,
        unidade_medida: "mg",
        principio_ativo: "Paracetamol",
        estoque_minimo: 50,
      };

      const medicamentoCriado = {
        id: 1,
        ...medicamentoData,
      };

      mockMedicamentoService.cadastrarNovo.mockResolvedValue(medicamentoCriado);

      const response = await request(app)
        .post("/api/medicamentos")
        .send(medicamentoData)
        .expect(201);

      expect(response.body).toEqual(medicamentoCriado);
      expect(mockMedicamentoService.cadastrarNovo).toHaveBeenCalledWith(
        medicamentoData
      );
    });

    it("deve retornar 400 quando o nome não é fornecido", async () => {
      const medicamentoData = {
        dosagem: 500,
        unidade_medida: "mg",
        estoque_minimo: 50,
      };

      mockMedicamentoService.cadastrarNovo.mockRejectedValue(
        new Error("Nome, dosagem e unidade de medida são campos obrigatórios.")
      );

      const response = await request(app)
        .post("/api/medicamentos")
        .send(medicamentoData)
        .expect(400);

      expect(response.body.error).toBe(
        "Nome, dosagem e unidade de medida são campos obrigatórios."
      );
    });

    it("deve retornar 400 quando a dosagem não é fornecida", async () => {
      const medicamentoData = {
        nome: "Paracetamol",
        unidade_medida: "mg",
        estoque_minimo: 50,
      };

      mockMedicamentoService.cadastrarNovo.mockRejectedValue(
        new Error("Nome, dosagem e unidade de medida são campos obrigatórios.")
      );

      const response = await request(app)
        .post("/api/medicamentos")
        .send(medicamentoData)
        .expect(400);

      expect(response.body.error).toBe(
        "Nome, dosagem e unidade de medida são campos obrigatórios."
      );
    });

    it("deve retornar 400 quando a unidade de medida não é fornecida", async () => {
      const medicamentoData = {
        nome: "Paracetamol",
        dosagem: 500,
        estoque_minimo: 50,
      };

      mockMedicamentoService.cadastrarNovo.mockRejectedValue(
        new Error("Nome, dosagem e unidade de medida são campos obrigatórios.")
      );

      const response = await request(app)
        .post("/api/medicamentos")
        .send(medicamentoData)
        .expect(400);

      expect(response.body.error).toBe(
        "Nome, dosagem e unidade de medida são campos obrigatórios."
      );
    });

    it("deve retornar 400 quando a dosagem é zero", async () => {
      const medicamentoData = {
        nome: "Paracetamol",
        dosagem: 0,
        unidade_medida: "mg",
        estoque_minimo: 50,
      };

      mockMedicamentoService.cadastrarNovo.mockRejectedValue(
        new Error("A dosagem deve ser um valor positivo.")
      );

      const response = await request(app)
        .post("/api/medicamentos")
        .send(medicamentoData)
        .expect(400);

      expect(response.body.error).toBe("A dosagem deve ser um valor positivo.");
    });

    it("deve retornar 400 quando a dosagem é negativa", async () => {
      const medicamentoData = {
        nome: "Paracetamol",
        dosagem: -100,
        unidade_medida: "mg",
        estoque_minimo: 50,
      };

      mockMedicamentoService.cadastrarNovo.mockRejectedValue(
        new Error("A dosagem deve ser um valor positivo.")
      );

      const response = await request(app)
        .post("/api/medicamentos")
        .send(medicamentoData)
        .expect(400);

      expect(response.body.error).toBe("A dosagem deve ser um valor positivo.");
    });

    it("deve criar medicamento sem princípio ativo", async () => {
      const medicamentoData = {
        nome: "Medicamento Genérico",
        dosagem: 250,
        unidade_medida: "ml",
        estoque_minimo: 20,
      };

      const medicamentoCriado = {
        id: 2,
        ...medicamentoData,
        principio_ativo: null,
      };

      mockMedicamentoService.cadastrarNovo.mockResolvedValue(medicamentoCriado);

      const response = await request(app)
        .post("/api/medicamentos")
        .send(medicamentoData)
        .expect(201);

      expect(response.body.principio_ativo).toBeNull();
    });

    it("deve retornar 400 com erro do banco", async () => {
      mockMedicamentoService.cadastrarNovo.mockRejectedValue(
        new Error("Erro ao criar medicamento no banco de dados: ECONNREFUSED")
      );

      const response = await request(app)
        .post("/api/medicamentos")
        .send({
          nome: "Paracetamol",
          dosagem: 500,
          unidade_medida: "mg",
          estoque_minimo: 50,
        })
        .expect(400);

      expect(response.body.error).toContain("Erro ao criar medicamento");
    });

    it("deve aceitar JSON válido", async () => {
      const medicamentoData = {
        nome: "Aspirina",
        dosagem: 100,
        unidade_medida: "mg",
        principio_ativo: "Ácido Acetilsalicílico",
        estoque_minimo: 25,
      };

      const medicamentoCriado = {
        id: 5,
        ...medicamentoData,
      };

      mockMedicamentoService.cadastrarNovo.mockResolvedValue(medicamentoCriado);

      const response = await request(app)
        .post("/api/medicamentos")
        .send(medicamentoData)
        .expect(201);

      expect(response.body.nome).toBe("Aspirina");
    });

    it("deve processar diferentes unidades de medida", async () => {
      const unidadesDeMedida = ["mg", "ml", "g", "mcg"];

      for (const unidade of unidadesDeMedida) {
        const medicamentoData = {
          nome: `Medicamento ${unidade}`,
          dosagem: 100,
          unidade_medida: unidade,
          estoque_minimo: 10,
        };

        mockMedicamentoService.cadastrarNovo.mockResolvedValue({
          id: 10,
          ...medicamentoData,
        });

        const response = await request(app)
          .post("/api/medicamentos")
          .send(medicamentoData)
          .expect(201);

        expect(response.body.unidade_medida).toBe(unidade);
      }
    });

    it("deve retornar JSON mesmo em erro", async () => {
      mockMedicamentoService.cadastrarNovo.mockRejectedValue(
        new Error("Nome, dosagem e unidade de medida são campos obrigatórios.")
      );

      const response = await request(app)
        .post("/api/medicamentos")
        .send({
          nome: "",
          dosagem: 500,
          unidade_medida: "mg",
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });
});
