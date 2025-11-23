jest.mock("../../infrastructure/database/models/medicamento.model", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
}));

import { Medicamento } from "../../core/domain/medicamento";
import { MedicamentoService } from "../../core/services/medicamento.service";
import MedicamentoModel from "../../infrastructure/database/models/medicamento.model";
import { MedicamentoRepository } from "../../infrastructure/database/repositories/medicamento.repository";


describe("Medicamento Domain Entity", () => {
  describe("Constructor", () => {
    it("should create Medicamento with all fields", () => {
      const medicamento = new Medicamento(
        1,
        "Paracetamol",
        500,
        "mg",
         50,
        "Paracetamol",
      );

      expect(medicamento.id).toBe(1);
      expect(medicamento.nome).toBe("Paracetamol");
      expect(medicamento.dosagem).toBe(500);
      expect(medicamento.unidade_medida).toBe("mg");
      expect(medicamento.principio_ativo).toBe("Paracetamol");
      expect(medicamento.estoque_minimo).toBe(50);
    });

    it("should allow creating Medicamento without principio_ativo", () => {
      const medicamento = new Medicamento(
        2,
        "Dipirona",
        500,
        "mg",
        40,
        null
      );

      expect(medicamento.principio_ativo).toBeNull();
      expect(medicamento.nome).toBe("Dipirona");
    });
  });
});

describe("MedicamentoService", () => {
  let medicamentoService: MedicamentoService;
  let mockMedicamentoRepository: any;

  beforeEach(() => {
    mockMedicamentoRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    medicamentoService = new MedicamentoService(mockMedicamentoRepository);
  });

  describe("cadastrarNovo", () => {
    it("deve cadastrar um medicamento com dados válidos", async () => {
      const medicamentoData = {
        nome: "Paracetamol",
        dosagem: 500,
        unidade_medida: "mg",
        principio_ativo: "Paracetamol",
        estoque_minimo: 50,
      };

      const medicamentoCriado = { id: 1, ...medicamentoData };

      mockMedicamentoRepository.create.mockResolvedValue(medicamentoCriado);

      const resultado = await medicamentoService.cadastrarNovo(medicamentoData);

      expect(mockMedicamentoRepository.create).toHaveBeenCalledWith(medicamentoData);
      expect(resultado).toEqual(medicamentoCriado);
    });

    it("deve lançar erro se o nome não for fornecido", async () => {
      const medicamentoData = {
        dosagem: 500,
        unidade_medida: "mg",
        estoque_minimo: 50,
      };

      await expect(medicamentoService.cadastrarNovo(medicamentoData as any))
        .rejects.toThrow("Nome, dosagem e unidade de medida são obrigatórios.");

      expect(mockMedicamentoRepository.create).not.toHaveBeenCalled();
    });

    it("deve lançar erro se a dosagem não for fornecida", async () => {
      const medicamentoData = {
        nome: "Paracetamol",
        unidade_medida: "mg",
        estoque_minimo: 50,
      };

      await expect(medicamentoService.cadastrarNovo(medicamentoData as any))
        .rejects.toThrow("Nome, dosagem e unidade de medida são obrigatórios.");

      expect(mockMedicamentoRepository.create).not.toHaveBeenCalled();
    });

    it("deve lançar erro se a unidade de medida não for fornecida", async () => {
      const medicamentoData = {
        nome: "Paracetamol",
        dosagem: 500,
        estoque_minimo: 50,
      };

      await expect(medicamentoService.cadastrarNovo(medicamentoData as any))
        .rejects.toThrow("Nome, dosagem e unidade de medida são obrigatórios.");

      expect(mockMedicamentoRepository.create).not.toHaveBeenCalled();
    });

    it("deve lançar erro se a dosagem for zero", async () => {
      const medicamentoData = {
        nome: "Paracetamol",
        dosagem: 0,
        unidade_medida: "mg",
        estoque_minimo: 50,
      };

      await expect(medicamentoService.cadastrarNovo(medicamentoData))
        .rejects.toThrow("A dosagem deve ser positiva.");

      expect(mockMedicamentoRepository.create).not.toHaveBeenCalled();
    });

    it("deve lançar erro se a dosagem for negativa", async () => {
      const medicamentoData = {
        nome: "Paracetamol",
        dosagem: -50,
        unidade_medida: "mg",
        estoque_minimo: 50,
      };

      await expect(medicamentoService.cadastrarNovo(medicamentoData))
        .rejects.toThrow("A dosagem deve ser positiva.");

      expect(mockMedicamentoRepository.create).not.toHaveBeenCalled();
    });

    it("deve cadastrar medicamento sem princípio ativo", async () => {
      const medicamentoData = {
        nome: "Genérico",
        dosagem: 250,
        unidade_medida: "ml",
        estoque_minimo: 20,
      };

      const medicamentoCriado = { id: 2, ...medicamentoData, principio_ativo: null };

      mockMedicamentoRepository.create.mockResolvedValue(medicamentoCriado);

      const resultado = await medicamentoService.cadastrarNovo(medicamentoData);

      expect(resultado).toEqual(medicamentoCriado);
    });

    it("deve propagar erros vindos do repository", async () => {
      const medicamentoData = {
        nome: "Paracetamol",
        dosagem: 500,
        unidade_medida: "mg",
        estoque_minimo: 50,
      };

      const erro = new Error("Erro ao conectar ao banco de dados");

      mockMedicamentoRepository.create.mockRejectedValue(erro);

      await expect(medicamentoService.cadastrarNovo(medicamentoData))
        .rejects.toThrow("Erro ao conectar ao banco de dados");
    });

    it("deve validar strings vazias", async () => {
      const medicamentoData = {
        nome: "",
        dosagem: 500,
        unidade_medida: "mg",
        estoque_minimo: 50,
      };

      await expect(medicamentoService.cadastrarNovo(medicamentoData))
        .rejects.toThrow("Nome, dosagem e unidade de medida são obrigatórios.");
    });

    it("deve aceitar diversas unidades de medida", async () => {
      const unidades = ["mg", "ml", "g", "l", "mcg", "UI"];

      for (const unidade of unidades) {
        const medicamentoData = {
          nome: `Medic ${unidade}`,
          dosagem: 100,
          unidade_medida: unidade,
          estoque_minimo: 10,
        };

        const criado = { id: 1, ...medicamentoData };

        mockMedicamentoRepository.create.mockResolvedValue(criado);

        const resultado = await medicamentoService.cadastrarNovo(medicamentoData);

        expect(resultado.unidade_medida).toBe(unidade);
      }
    });
  });
});

describe("MedicamentoRepository", () => {
  let repository: MedicamentoRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new MedicamentoRepository();
  });

  jest.mock("../../infrastructure/database/models/medicamento.model");

  describe("create", () => {
    it("deve criar um medicamento e retornar entidade de domínio", async () => {
      const medicamentoData = {
        nome: "Paracetamol",
        dosagem: 500,
        unidade_medida: "mg",
        principio_ativo: "Paracetamol",
        estoque_minimo: 50,
      };

      const medicamentoRecord = {
        id: 1,
        ...medicamentoData,
      };

      (MedicamentoModel.create as jest.Mock).mockResolvedValue(
        medicamentoRecord
      );

      const resultado = await repository.create(medicamentoData);

      expect(MedicamentoModel.create).toHaveBeenCalledWith(medicamentoData);
      expect(resultado).toBeInstanceOf(Medicamento);
      expect(resultado.id).toBe(1);
    });

    it("deve criar medicamento com princípio ativo null", async () => {
      const medicamentoData = {
        nome: "Ibuprofeno",
        dosagem: 400,
        unidade_medida: "mg",
        estoque_minimo: 30,
      };

      const medicamentoRecord = {
        id: 2,
        nome: "Ibuprofeno",
        dosagem: 400,
        unidade_medida: "mg",
        principio_ativo: null,
        estoque_minimo: 30,
      };

      (MedicamentoModel.create as jest.Mock).mockResolvedValue(
        medicamentoRecord
      );

      const resultado = await repository.create(medicamentoData);

      expect(MedicamentoModel.create).toHaveBeenCalledWith({
        ...medicamentoData,
        principio_ativo: null,
      });
      expect(resultado.principio_ativo).toBeNull();
    });

    it("deve tratar undefined de princípio ativo como null", async () => {
      const medicamentoData = {
        nome: "Dipirona",
        dosagem: 500,
        unidade_medida: "mg",
        principio_ativo: undefined,
        estoque_minimo: 40,
      };

      const medicamentoRecord = {
        id: 3,
        nome: "Dipirona",
        dosagem: 500,
        unidade_medida: "mg",
        principio_ativo: null,
        estoque_minimo: 40,
      };

      (MedicamentoModel.create as jest.Mock).mockResolvedValue(
        medicamentoRecord
      );

      const resultado = await repository.create(medicamentoData);

      expect(MedicamentoModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ principio_ativo: null })
      );

      expect(resultado.principio_ativo).toBeNull();
    });

    it("deve lançar erro personalizado quando o banco falha", async () => {
      const medicamentoData = {
        nome: "Paracetamol",
        dosagem: 500,
        unidade_medida: "mg",
        estoque_minimo: 50,
      };

      const erro = new Error("Violação de constraint");

      (MedicamentoModel.create as jest.Mock).mockRejectedValue(erro);

      await expect(repository.create(medicamentoData)).rejects.toThrow(
        "Violação de constraint"
      );
    });

    it("deve preservar todos os dados", async () => {
      const medicamentoData = {
        nome: "Amoxicilina",
        dosagem: 875,
        unidade_medida: "mg",
        principio_ativo: "Amoxicilina",
        estoque_minimo: 100,
      };

      const medicamentoRecord = {
        id: 10,
        ...medicamentoData,
      };

      (MedicamentoModel.create as jest.Mock).mockResolvedValue(
        medicamentoRecord
      );

      const resultado = await repository.create(medicamentoData);

      expect(resultado.id).toBe(10);
      expect(resultado.nome).toBe(medicamentoData.nome);
      expect(resultado.dosagem).toBe(medicamentoData.dosagem);
      expect(resultado.unidade_medida).toBe(medicamentoData.unidade_medida);
      expect(resultado.principio_ativo).toBe(medicamentoData.principio_ativo);
      expect(resultado.estoque_minimo).toBe(medicamentoData.estoque_minimo);
    });

    it("deve converter valores ignorando propriedades extras do Sequelize", async () => {
      const medicamentoData = {
        nome: "Losartana",
        dosagem: 50,
        unidade_medida: "mg",
        principio_ativo: "Losartana Potássica",
        estoque_minimo: 60,
      };

      const medicamentoRecord = {
        id: 7,
        ...medicamentoData,
        dataValues: {},
        previousDataValues: {},
        somethingElse: 999,
      };

      (MedicamentoModel.create as jest.Mock).mockResolvedValue(
        medicamentoRecord
      );

      const resultado = await repository.create(medicamentoData);

      expect(resultado).toBeInstanceOf(Medicamento);

      // Propriedades da entidade
      expect(resultado.nome).toBe("Losartana");
      expect(resultado.principio_ativo).toBe("Losartana Potássica");

      // Propriedades DO SEQUELIZE NÃO DEVEM EXISTIR
      expect(resultado).not.toHaveProperty("dataValues");
      expect(resultado).not.toHaveProperty("previousDataValues");
      expect(resultado).not.toHaveProperty("somethingElse");
    });
  });
});
