import { StockRepository } from '../../infrastructure/database/repositories/estoque.repository';
import { CacheKeyHelper } from '../../infrastructure/helpers/redis.helper';
import { MedicineStock, InputStock } from '../domain/estoque';
import {
  ItemType,
  StockItemStatus,
  QueryPaginationParams,
  MovementType,
} from '../utils/utils';
import { MovementRepository } from '../../infrastructure/database/repositories/movimentacao.repository';
import { CacheService } from './redis.service';
import { PriceSearchService } from './price-search.service';
import { MedicineRepository } from '../../infrastructure/database/repositories/medicamento.repository';
import { InputRepository } from '../../infrastructure/database/repositories/insumo.repository';

export class StockService {
  private medicineRepo: MedicineRepository;
  private inputRepo: InputRepository;
  private movementRepo: MovementRepository;

  constructor(
    private readonly repo: StockRepository,
    private readonly cache: CacheService,
    private readonly priceSearchService?: PriceSearchService,
  ) {
    this.medicineRepo = new MedicineRepository();
    this.inputRepo = new InputRepository();
    this.movementRepo = new MovementRepository();
  }

  async medicineStockIn(data: MedicineStock, login_id: number): Promise<{ message: string }> {
    if (
      !data.medicamento_id ||
      (!data.armario_id && !data.gaveta_id) ||
      !data.quantidade ||
      !data.origem
    ) {
      throw new Error('Campos obrigatórios faltando.');
    }

    if (!login_id) {
      throw new Error('Usuário não autenticado');
    }

    const result = await this.repo.createMedicineStockIn(data);

    await this.movementRepo.create({
      tipo: MovementType.ENTRADA,
      login_id,
      medicamento_id: data.medicamento_id,
      insumo_id: null,
      quantidade: data.quantidade,
      casela_id: data.casela_id ?? null,
      validade: data.validade ?? new Date(),
      setor: data.setor,
      armario_id: data.armario_id ?? undefined,
      gaveta_id: data.gaveta_id ?? undefined,
      lote: data.lote ?? null,
    });

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async inputStockIn(data: InputStock, login_id: number): Promise<{ message: string }> {
    if (
      !data.insumo_id ||
      (!data.armario_id && !data.gaveta_id) ||
      !data.quantidade ||
      !data.tipo
    ) {
      throw new Error('Campos obrigatórios faltando.');
    }

    if (!login_id) {
      throw new Error('Usuário não autenticado');
    }

    const result = await this.repo.createInputStockIn(data);

    await this.movementRepo.create({
      tipo: MovementType.ENTRADA,
      login_id,
      medicamento_id: null,
      insumo_id: data.insumo_id,
      quantidade: data.quantidade,
      casela_id: data.casela_id ?? null,
      validade: data.validade ?? new Date(),
      setor: data.setor,
      armario_id: data.armario_id ?? undefined,
      gaveta_id: data.gaveta_id ?? undefined,
      lote: data.lote ?? null,
    });

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async stockOut(data: {
    estoqueId: number;
    tipo: ItemType;
    quantidade: number;
  }, login_id: number) {
    const { estoqueId, tipo, quantidade } = data;

    if (!estoqueId) throw new Error('Nenhum item foi selecionado');
    if (quantidade <= 0) throw new Error('Quantidade inválida.');
    if (!tipo) throw new Error('Tipo de item inválido.');
    if (!login_id) throw new Error('Usuário não autenticado');

    let stockItem;
    if (tipo === ItemType.MEDICAMENTO) {
      stockItem = await this.repo.findMedicineStockById(estoqueId);
    } else {
      stockItem = await this.repo.findInputStockById(estoqueId);
    }

    if (!stockItem) {
      throw new Error('Item de estoque não encontrado');
    }

    const result = await this.repo.createStockOut(estoqueId, tipo, quantidade);

    await this.movementRepo.create({
      tipo: MovementType.SAIDA,
      login_id,
      medicamento_id: tipo === ItemType.MEDICAMENTO ? (stockItem as any).medicamento_id : null,
      insumo_id: tipo === ItemType.INSUMO ? (stockItem as any).insumo_id : null,
      quantidade,
      casela_id: stockItem.casela_id ?? null,
      validade: stockItem.validade ?? new Date(),
      setor: stockItem.setor,
      armario_id: stockItem.armario_id ?? undefined,
      gaveta_id: stockItem.gaveta_id ?? undefined,
      lote: (stockItem as any).lote ?? null,
    });

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async listStock(params: QueryPaginationParams) {
    const cacheKey = CacheKeyHelper.stockList(params);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const data = await this.repo.listStockItems(params);

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
    quantidade: number,
    casela_id?: number,
  ) {
    const stock = await this.repo.findMedicineStockById(estoque_id);
  
    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if(!login_id) {
      throw new Error('Login é obrigatório');
    }
  
    if (stock.status === StockItemStatus.SUSPENSO) {
      throw new Error('Medicamento suspenso não pode ser transferido');
    }
  
    if (stock.setor !== 'farmacia') {
      throw new Error('Transferência permitida apenas de farmácia para enfermaria');
    }
  
    if (setor !== 'enfermagem') {
      throw new Error('Transferência permitida apenas para enfermaria');
    }
  
    const isIndividual = stock.casela_id != null;
    const resolvedCaselaId = isIndividual ? stock.casela_id : casela_id;
  
    if (isIndividual) {
      const result = await this.repo.transferMedicineSector(
        estoque_id,
        setor,
        quantidade
      );
  
      await this.movementRepo.create({
        tipo: MovementType.TRANSFER,
        login_id,
        medicamento_id: stock.medicamento_id,
        insumo_id: null,
        quantidade,
        casela_id: resolvedCaselaId,
        validade: stock.validade ?? new Date(),
        setor,
        armario_id: stock.armario_id ?? undefined,
        gaveta_id: stock.gaveta_id ?? undefined,
        lote: stock.lote ?? null,
      });
  
      await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());
      return result;
    }
  
    if (!casela_id) {
      throw new Error('Casela é obrigatória para transferir item geral');
    }
  
    if (!quantidade || quantidade <= 0) {
      throw new Error('Quantidade é obrigatória e deve ser maior que zero');
    }
  
    if (quantidade > stock.quantidade) {
      throw new Error(`Quantidade não pode ser maior que ${stock.quantidade}`);
    }
  
    const result = await this.repo.transferMedicineSector(
      estoque_id,
      setor,
      quantidade,
      casela_id,
    );
  
    // Create movement record for transfer
    await this.movementRepo.create({
      tipo: MovementType.TRANSFER,
      login_id,
      medicamento_id: stock.medicamento_id,
      insumo_id: null,
      quantidade,
      casela_id: resolvedCaselaId,
      validade: stock.validade ?? new Date(),
      setor,
      armario_id: stock.armario_id ?? undefined,
      gaveta_id: stock.gaveta_id ?? undefined,
      lote: stock.lote ?? null,
    });
  
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

      const { origem, ...inputData } = data;
      const result = await this.repo.updateStockItem(estoqueId, tipo, inputData);
      await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());
      return result;
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

  async transferInputSector(
    estoque_id: number,
    setor: 'farmacia' | 'enfermagem',
    quantidade: number,
    login_id: number,
    casela_id?: number,
  ) {
    const stock = await this.repo.findInputStockById(estoque_id);
  
    if (!stock) {
      throw new Error('Insumo não encontrado');
    }

    if (!login_id) {
      throw new Error('Usuário não autenticado');
    }
  
    if (stock.status === StockItemStatus.SUSPENSO) {
      throw new Error('Insumo suspenso não pode ser transferido');
    }
  
    if (stock.setor !== 'farmacia') {
      throw new Error('Transferência permitida apenas de farmácia para enfermaria');
    }
  
    if (setor !== 'enfermagem') {
      throw new Error('Transferência permitida apenas para enfermaria');
    }
  
    const isIndividual = stock.casela_id != null;
    const resolvedCaselaId = isIndividual ? stock.casela_id : casela_id;
  
    if (isIndividual) {
      const result = await this.repo.transferInputSector(
        estoque_id,
        setor,
        quantidade
      );
  
      await this.movementRepo.create({
        tipo: MovementType.TRANSFER,
        login_id,
        medicamento_id: null,
        insumo_id: stock.insumo_id,
        quantidade,
        casela_id: resolvedCaselaId,
        validade: stock.validade ?? new Date(),
        setor,
        armario_id: stock.armario_id ?? undefined,
        gaveta_id: stock.gaveta_id ?? undefined,
        lote: stock.lote ?? null,
      });
  
      await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());
      return result;
    }
  
    if (!casela_id) {
      throw new Error('Casela é obrigatória para transferir item geral');
    }
  
    if (!quantidade || quantidade <= 0) {
      throw new Error('Quantidade é obrigatória e deve ser maior que zero');
    }
  
    if (quantidade > stock.quantidade) {
      throw new Error(`Quantidade não pode ser maior que ${stock.quantidade}`);
    }
  
    const result = await this.repo.transferInputSector(
      estoque_id,
      setor,
      quantidade,
      casela_id,
    );
  
    await this.movementRepo.create({
      tipo: MovementType.TRANSFER,
      login_id,
      medicamento_id: null,
      insumo_id: stock.insumo_id,
      quantidade,
      casela_id: resolvedCaselaId,
      validade: stock.validade ?? new Date(),
      setor,
      armario_id: stock.armario_id ?? undefined,
      gaveta_id: stock.gaveta_id ?? undefined,
      lote: stock.lote ?? null,
    });
  
    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());
    return result;
  }
  
}
