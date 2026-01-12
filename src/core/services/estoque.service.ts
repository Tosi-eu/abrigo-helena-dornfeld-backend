import { StockRepository } from '../../infrastructure/database/repositories/estoque.repository';
import { CacheKeyHelper } from '../../infrastructure/helpers/redis.helper';
import { MedicineStock, InputStock } from '../domain/estoque';
import {
  ItemType,
  StockItemStatus,
  QueryPaginationParams,
} from '../utils/utils';
import { CacheService } from './redis.service';
import { PriceSearchService } from './price-search.service';
import { MedicineRepository } from '../../infrastructure/database/repositories/medicamento.repository';
import { InputRepository } from '../../infrastructure/database/repositories/insumo.repository';

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

  async medicineStockIn(data: MedicineStock): Promise<{ message: string; priceSearchResult?: { found: boolean; price: number | null } }> {
    if (
      !data.medicamento_id ||
      (!data.armario_id && !data.gaveta_id) ||
      !data.quantidade
    ) {
      throw new Error('Campos obrigatórios faltando.');
    }

    let priceSearchResult: { found: boolean; price: number | null } | undefined;

    // Se o preço não foi informado, tentar buscar automaticamente
    if (!data.preco && this.priceSearchService) {
      console.log(`[STOCK IN] Preço não informado, iniciando busca automática para medicamento ID ${data.medicamento_id}`);
      
      try {
        const medicine = await this.medicineRepo.findMedicineById(data.medicamento_id);
        if (medicine) {
          console.log(`[STOCK IN] Medicamento encontrado: ${medicine.nome} (${medicine.dosagem}${medicine.unidade_medida})`);
          
          const searchResult = await this.priceSearchService.searchPrice(
            medicine.nome,
            'medicine',
            medicine.dosagem,
            'São Carlos',
            'São Paulo',
            medicine.unidade_medida,
          );

          if (searchResult && searchResult.averagePrice !== null && searchResult.averagePrice > 0) {
            const precoUnitario = searchResult.averagePrice;
            const precoTotal = precoUnitario * data.quantidade;
            console.log(`[STOCK IN] Preço unitário encontrado: R$ ${precoUnitario.toFixed(2)} (fonte: ${searchResult.source})`);
            console.log(`[STOCK IN] Preço total (unitário × quantidade): R$ ${precoTotal.toFixed(2)} (${precoUnitario.toFixed(2)} × ${data.quantidade})`);
            data.preco = precoTotal;
            priceSearchResult = { found: true, price: precoUnitario };
          } else {
            console.log(`[STOCK IN] Nenhum preço encontrado para medicamento ID ${data.medicamento_id}`);
            priceSearchResult = { found: false, price: null };
          }
        } else {
          console.log(`[STOCK IN] Medicamento ID ${data.medicamento_id} não encontrado`);
          priceSearchResult = { found: false, price: null };
        }
      } catch (error) {
        console.error(`[STOCK IN] Erro ao buscar preço para medicamento ID ${data.medicamento_id}:`, error);
        priceSearchResult = { found: false, price: null };
      }
    }

    // Se o preço foi informado manualmente, multiplicar pela quantidade
    if (data.preco && !priceSearchResult) {
      data.preco = data.preco * data.quantidade;
      console.log(`[STOCK IN] Preço manual informado multiplicado pela quantidade: R$ ${data.preco.toFixed(2)}`);
    }

    const result = await this.repo.createMedicineStockIn(data);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return { ...result, priceSearchResult };
  }

  async inputStockIn(data: InputStock): Promise<{ message: string; priceSearchResult?: { found: boolean; price: number | null } }> {
    if (
      !data.insumo_id ||
      (!data.armario_id && !data.gaveta_id) ||
      !data.quantidade ||
      !data.tipo
    ) {
      throw new Error('Campos obrigatórios faltando.');
    }

    let priceSearchResult: { found: boolean; price: number | null } | undefined;

    // Se o preço não foi informado, tentar buscar automaticamente
    if (!data.preco && this.priceSearchService) {
      console.log(`[STOCK IN] Preço não informado, iniciando busca automática para insumo ID ${data.insumo_id}`);
      
      try {
        const input = await this.inputRepo.findInputById(data.insumo_id);
        if (input) {
          console.log(`[STOCK IN] Insumo encontrado: ${input.nome}`);
          
          const searchResult = await this.priceSearchService.searchPrice(
            input.nome,
            'input',
            undefined,
            'São Carlos',
            'São Paulo',
          );

          if (searchResult && searchResult.averagePrice !== null && searchResult.averagePrice > 0) {
            const precoUnitario = searchResult.averagePrice;
            const precoTotal = precoUnitario * data.quantidade;
            console.log(`[STOCK IN] Preço unitário encontrado: R$ ${precoUnitario.toFixed(2)} (fonte: ${searchResult.source})`);
            console.log(`[STOCK IN] Preço total (unitário × quantidade): R$ ${precoTotal.toFixed(2)} (${precoUnitario.toFixed(2)} × ${data.quantidade})`);
            data.preco = precoTotal;
            priceSearchResult = { found: true, price: precoUnitario };
          } else {
            console.log(`[STOCK IN] Nenhum preço encontrado para insumo ID ${data.insumo_id}`);
            priceSearchResult = { found: false, price: null };
          }
        } else {
          console.log(`[STOCK IN] Insumo ID ${data.insumo_id} não encontrado`);
          priceSearchResult = { found: false, price: null };
        }
      } catch (error) {
        console.error(`[STOCK IN] Erro ao buscar preço para insumo ID ${data.insumo_id}:`, error);
        priceSearchResult = { found: false, price: null };
      }
    }

    // Se o preço foi informado manualmente, multiplicar pela quantidade
    if (data.preco && !priceSearchResult) {
      data.preco = data.preco * data.quantidade;
      console.log(`[STOCK IN] Preço manual informado multiplicado pela quantidade: R$ ${data.preco.toFixed(2)}`);
    }

    const result = await this.repo.createInputStockIn(data);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return { ...result, priceSearchResult };
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
  ) {
    const stock = await this.repo.findMedicineStockById(estoque_id);

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (stock.casela_id == null) {
      throw new Error('Somente medicamentos com casela podem ser transferidos');
    }

    if (stock.status === StockItemStatus.SUSPENSO) {
      throw new Error('Medicamento suspenso não pode ser transferido');
    }

    if (stock.setor === setor) {
      throw new Error('Medicamento já está neste setor');
    }

    const result = await this.repo.transferMedicineSector(estoque_id, setor);

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
  ) {
    const stock = await this.repo.findInputStockById(estoque_id);

    if (!stock) {
      throw new Error('Insumo não encontrado');
    }

    if (stock.casela_id == null) {
      throw new Error('Somente insumos com casela podem ser transferidos');
    }

    if (stock.status === StockItemStatus.SUSPENSO) {
      throw new Error('Insumo suspenso não pode ser transferido');
    }

    if (stock.setor === setor) {
      throw new Error('Insumo já está neste setor');
    }

    const result = await this.repo.transferInputSector(estoque_id, setor);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }
}
