import { StockRepository } from '../../infrastructure/database/repositories/estoque.repository';
import { CacheKeyHelper } from '../../infrastructure/helpers/redis.helper';
import { MedicineStock, InputStock } from '../domain/estoque';
import {
  ItemType,
  StockItemStatus,
  QueryPaginationParams,
  OperationType,
} from '../utils/utils';
import Movement from '../domain/movimentacao';
import { MovementRepository } from '../../infrastructure/database/repositories/movimentacao.repository';
import { CacheService } from './redis.service';
import { PriceSearchService } from './price-search.service';
import { MedicineRepository } from '../../infrastructure/database/repositories/medicamento.repository';
import { InputRepository } from '../../infrastructure/database/repositories/insumo.repository';
import { logger } from '../../infrastructure/helpers/logger.helper';

export class StockService {
  private medicineRepo: MedicineRepository;
  private inputRepo: InputRepository;

  constructor(
    private readonly repo: StockRepository,
    private readonly cache: CacheService,
    private readonly priceSearchService?: PriceSearchService,
  ) {
    this.medicineRepo = new MedicineRepository();
    this.inputRepo = new InputRepository();
  }

  async medicineStockIn(data: MedicineStock): Promise<{ message: string }> {
    if (
      !data.medicamento_id ||
      (!data.armario_id && !data.gaveta_id) ||
      !data.quantidade
    ) {
      throw new Error('Campos obrigatórios faltando.');
    }


    const result = await this.repo.createMedicineStockIn(data);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async inputStockIn(data: InputStock): Promise<{ message: string }> {
    if (
      !data.insumo_id ||
      (!data.armario_id && !data.gaveta_id) ||
      !data.quantidade ||
      !data.tipo
    ) {
      throw new Error('Campos obrigatórios faltando.');
    }


    const result = await this.repo.createInputStockIn(data);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async stockOut(data: {
    estoqueId: number;
    tipo: ItemType;
    quantidade: number;
  }) {
    const { estoqueId, tipo, quantidade } = data;

    if (!estoqueId) throw new Error('Nenhum item foi selecionado');
    if (quantidade <= 0) throw new Error('Quantidade inválida.');
    if (!tipo) throw new Error('Tipo de item inválido.');

    const result = await this.repo.createStockOut(estoqueId, tipo, quantidade);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async listStock(params: QueryPaginationParams) {
    const cacheKey = CacheKeyHelper.stockList(params);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const data = await this.repo.listStockItems(params);

        // Only transform quantidade if it exists (armarios/gavetas types don't have it)
        return {
          ...data,
          data: data.data.map(item => {
            if ('quantidade' in item) {
              return {
                ...item,
                quantidade: Number(item.quantidade),
              };
            }
            return item;
          }),
        };
      },
      30,
    );
  }

  async getProportion(setor: 'farmacia' | 'enfermagem') {
    return this.cache.getOrSet(
      CacheKeyHelper.stockDashboard(setor),
      () => this.repo.getStockProportionBySector(setor),
      60,
    );
  }

  async removeIndividualMedicine(estoqueId: number) {
    const stock = await this.repo.findMedicineStockById(estoqueId);

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (stock.tipo !== 'individual') {
      throw new Error('Medicamento não é individual');
    }

    const result = await this.repo.removeIndividualMedicine(estoqueId);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async suspendIndividualMedicine(estoque_id: number) {
    const stock = await this.repo.findMedicineStockById(estoque_id);

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (stock.casela_id == null) {
      throw new Error('Somente medicamentos individuais podem ser suspensos');
    }

    if (stock.status === StockItemStatus.SUSPENSO) {
      throw new Error('Medicamento já está suspenso');
    }

    const result = await this.repo.suspendIndividualMedicine(estoque_id);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async resumeIndividualMedicine(estoque_id: number) {
    const stock = await this.repo.findMedicineStockById(estoque_id);

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (stock.casela_id == null) {
      throw new Error('Somente medicamentos individuais podem ser retomados');
    }

    if (stock.status !== StockItemStatus.SUSPENSO) {
      throw new Error('Medicamento não está suspenso');
    }

    const result = await this.repo.resumeIndividualMedicine(estoque_id);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async transferMedicineSector(
    estoque_id: number,
    setor: 'farmacia' | 'enfermagem',
    login_id: number,
    quantidade?: number,
    casela_id?: number,
    tipo?: string,
  ) {
    const stock = await this.repo.findMedicineStockById(estoque_id);

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    // Permitir transferência de medicamentos gerais informando casela_id

    if (stock.status === StockItemStatus.SUSPENSO) {
      throw new Error('Medicamento suspenso não pode ser transferido');
    }

    if (stock.setor === setor) {
      throw new Error('Medicamento já está neste setor');
    }

    if (quantidade !== undefined) {
      if (quantidade <= 0) {
        throw new Error('Quantidade deve ser maior que zero');
      }
      if (quantidade > stock.quantidade) {
        throw new Error(`Quantidade não pode ser maior que ${stock.quantidade}`);
      }
    }

    const setorOrigem = stock.setor;
    const quantidadeTransferida = quantidade || stock.quantidade;
    const result = await this.repo.transferMedicineSector(
      estoque_id,
      setor,
      quantidade,
      casela_id,
      tipo,
    );

    if (setorOrigem === 'farmacia' && setor === 'enfermagem') {
      const movementRepo = new MovementRepository();
      
      const movement: Movement = {
        tipo: OperationType.INDIVIDUAL,
        login_id,
        armario_id: stock.armario_id ?? undefined,
        gaveta_id: stock.gaveta_id ?? undefined,
        quantidade: quantidadeTransferida,
        medicamento_id: stock.medicamento_id,
        insumo_id: null,
        casela_id: casela_id ?? stock.casela_id,
        validade: stock.validade ?? new Date(),
        setor: 'farmacia', 
      };
      
      await movementRepo.create(movement);
    }

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async updateStockItem(
    estoqueId: number,
    tipo: ItemType,
    data: {
      quantidade?: number;
      armario_id?: number | null;
      gaveta_id?: number | null;
      validade?: Date | null;
      origem?: string | null;
      setor?: string;
      lote?: string | null;
      casela_id?: number | null;
      tipo?: string;
      preco?: number | null;
    },
  ) {
    if (tipo === ItemType.MEDICAMENTO) {
      const stock = await this.repo.findMedicineStockById(estoqueId);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      if (stock.status === StockItemStatus.SUSPENSO) {
        throw new Error(
          'Não é possível editar um medicamento suspenso. Reative-o primeiro.',
        );
      }
    } else {
      const stock = await this.repo.findInputStockById(estoqueId);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      if (stock.status === StockItemStatus.SUSPENSO) {
        throw new Error(
          'Não é possível editar um insumo suspenso. Reative-o primeiro.',
        );
      }
    }

    const result = await this.repo.updateStockItem(estoqueId, tipo, data);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async deleteStockItem(estoqueId: number, tipo: ItemType) {
    const result = await this.repo.deleteStockItem(estoqueId, tipo);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async removeIndividualInput(estoqueId: number) {
    const stock = await this.repo.findInputStockById(estoqueId);

    if (!stock) {
      throw new Error('Insumo não encontrado');
    }

    if (stock.tipo !== 'individual') {
      throw new Error('Insumo não é individual');
    }

    const result = await this.repo.removeIndividualInput(estoqueId);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async suspendIndividualInput(estoque_id: number) {
    const stock = await this.repo.findInputStockById(estoque_id);

    if (!stock) {
      throw new Error('Insumo não encontrado');
    }

    if (stock.casela_id == null) {
      throw new Error('Somente insumos individuais podem ser suspensos');
    }

    if (stock.status === StockItemStatus.SUSPENSO) {
      throw new Error('Insumo já está suspenso');
    }

    const result = await this.repo.suspendIndividualInput(estoque_id);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async resumeIndividualInput(estoque_id: number) {
    const stock = await this.repo.findInputStockById(estoque_id);

    if (!stock) {
      throw new Error('Insumo não encontrado');
    }

    if (stock.casela_id == null) {
      throw new Error('Somente insumos individuais podem ser retomados');
    }

    if (stock.status !== StockItemStatus.SUSPENSO) {
      throw new Error('Insumo não está suspenso');
    }

    const result = await this.repo.resumeIndividualInput(estoque_id);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async transferInputSector(
    estoque_id: number,
    setor: 'farmacia' | 'enfermagem',
    quantidade?: number,
    casela_id?: number,
    tipo?: string,
  ) {
    const stock = await this.repo.findInputStockById(estoque_id);

    if (!stock) {
      throw new Error('Insumo não encontrado');
    }

    // Permitir transferência de insumos gerais informando casela_id

    if (stock.status === StockItemStatus.SUSPENSO) {
      throw new Error('Insumo suspenso não pode ser transferido');
    }

    if (stock.setor === setor) {
      throw new Error('Insumo já está neste setor');
    }

    if (quantidade !== undefined) {
      if (quantidade <= 0) {
        throw new Error('Quantidade deve ser maior que zero');
      }
      if (quantidade > stock.quantidade) {
        throw new Error(`Quantidade não pode ser maior que ${stock.quantidade}`);
      }
    }

    const result = await this.repo.transferInputSector(
      estoque_id,
      setor,
      quantidade,
      casela_id,
      tipo,
    );

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }
}
