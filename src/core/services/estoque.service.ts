import { StockRepository } from '../../infrastructure/database/repositories/estoque.repository';
import { CacheKeyHelper } from '../../infrastructure/helpers/redis.helper';
import { MedicineStock, InputStock } from '../domain/estoque';
import {
  ItemType,
  StockItemStatus,
  QueryPaginationParams,
  MovementType,
  SectorType,
  OperationType,
} from '../utils/utils';
import { MovementRepository } from '../../infrastructure/database/repositories/movimentacao.repository';
import { CacheService } from './redis.service';
import { MedicineRepository } from '../../infrastructure/database/repositories/medicamento.repository';
import { InputRepository } from '../../infrastructure/database/repositories/insumo.repository';
import { NotificationEventRepository } from '../../infrastructure/database/repositories/notificacao.repository';
import { NotificationDestinoType, NotificationEventType } from '../../infrastructure/database/models/notificacao.model';
import type { Transaction } from 'sequelize';

export class StockService {
  private medicineRepo: MedicineRepository;
  private inputRepo: InputRepository;
  private movementRepo: MovementRepository;

  constructor(
    private readonly repo: StockRepository,
    private readonly cache: CacheService,
    private readonly notificationRepo?: NotificationEventRepository,
  ) {
    this.medicineRepo = new MedicineRepository();
    this.inputRepo = new InputRepository();
    this.movementRepo = new MovementRepository();
  }

  async medicineStockIn(
    data: MedicineStock,
    login_id: number,
    transaction?: Transaction,
  ): Promise<{ message: string }> {
    if (
      !data.medicamento_id ||
      (!data.armario_id && !data.gaveta_id) ||
      !data.quantidade ||
      !data.origem
    ) {
      throw new Error('Campos obrigatórios faltando.');
    }

    if (data.quantidade <= 0) {
      throw new Error('Quantidade inválida.');
    }

    if (data.validade < new Date()) {
      throw new Error('Produto está vencido.');
    }

    if (data.casela_id && data.gaveta_id) {
      throw new Error('Casela e gaveta não podem ser informados juntos.');
    }

    if (!login_id) {
      throw new Error('Usuário não autenticado');
    }

    const result = await this.repo.createMedicineStockIn(data, transaction);

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
    }, transaction);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async inputStockIn(
    data: InputStock,
    login_id: number,
    transaction?: Transaction,
  ): Promise<{ message: string }> {
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

    const result = await this.repo.createInputStockIn(data, transaction);

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
    }, transaction);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async stockOut(
    data: {
      estoqueId: number;
      tipo: ItemType;
      quantidade: number;
    },
    login_id: number,
    transaction?: Transaction,
  ) {
    const { estoqueId, tipo, quantidade } = data;

    if (!estoqueId) throw new Error('Nenhum item foi selecionado');
    if (quantidade <= 0) throw new Error('Quantidade inválida.');
    if (!tipo) throw new Error('Tipo de item inválido.');
    if (!login_id) throw new Error('Usuário não autenticado');

    let stockItem;
    if (tipo === ItemType.MEDICAMENTO) {
      stockItem = await this.repo.findMedicineStockById(estoqueId, transaction);
    } else {
      stockItem = await this.repo.findInputStockById(estoqueId, transaction);
    }

    if (!stockItem) {
      throw new Error('Item de estoque não encontrado');
    }

    const result = await this.repo.createStockOut(estoqueId, tipo, quantidade, transaction);

    type MedicineStock = { medicamento_id: number; lote?: string | null };
    type InputStock = { insumo_id: number; lote?: string | null };
    const medicamentoId = tipo === ItemType.MEDICAMENTO
      ? (stockItem as MedicineStock).medicamento_id
      : null;
    const insumoId = tipo === ItemType.INSUMO
      ? (stockItem as InputStock).insumo_id
      : null;
    const lote = (stockItem as { lote?: string | null }).lote ?? null;

    await this.movementRepo.create({
      tipo: MovementType.SAIDA,
      login_id,
      medicamento_id: medicamentoId,
      insumo_id: insumoId,
      quantidade,
      casela_id: stockItem.casela_id ?? null,
      validade: stockItem.validade ?? new Date(),
      setor: stockItem.setor,
      armario_id: stockItem.armario_id ?? undefined,
      gaveta_id: stockItem.gaveta_id ?? undefined,
      lote,
    }, transaction);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async listStock(params: QueryPaginationParams, transaction?: Transaction) {
    const cacheKey = CacheKeyHelper.stockList(params);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const data = await this.repo.listStockItems(params, transaction);

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

  async getProportion(setor?: SectorType, transaction?: Transaction) {
    return this.cache.getOrSet(
      CacheKeyHelper.stockDashboard(setor ?? 'general'),
      () => this.repo.getStockProportionBySector(setor, transaction),
      60,
    );
  }

  /** Efficient alert counts for dashboard. No cache for fresh counts. */
  async getAlertCounts(transaction?: Transaction, expiringDays?: number) {
    return this.repo.getAlertCounts(transaction, expiringDays ?? 45);
  }

  /** Items (medicine + input) expiring in the next N days. */
  async getExpiringItems(
    days: number,
    page?: number,
    limit?: number,
    transaction?: Transaction,
  ) {
    return this.repo.getExpiringItems(days ?? 30, page ?? 1, limit ?? 50, transaction);
  }

  async suspendIndividualMedicine(estoque_id: number, transaction?: Transaction) {
    const stock = await this.repo.findMedicineStockById(estoque_id, transaction);

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (stock.casela_id == null) {
      throw new Error('Somente medicamentos individuais podem ser suspensos');
    }

    if (stock.status === StockItemStatus.SUSPENSO) {
      throw new Error('Medicamento já está suspenso');
    }

    const result = await this.repo.suspendIndividualMedicine(estoque_id, transaction);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async resumeIndividualMedicine(estoque_id: number, transaction?: Transaction) {
    const stock = await this.repo.findMedicineStockById(estoque_id, transaction);

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (stock.casela_id == null) {
      throw new Error('Somente medicamentos individuais podem ser retomados');
    }

    if (stock.status !== StockItemStatus.SUSPENSO) {
      throw new Error('Medicamento não está suspenso');
    }

    const result = await this.repo.resumeIndividualMedicine(estoque_id, transaction);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async transferMedicineSector(
    estoque_id: number,
    setor: 'farmacia' | 'enfermagem',
    login_id: number,
    quantidade: number,
    bypassCasela: boolean,
    casela_id?: number | null,
    observacao?: string | null,
    dias_para_repor?: number | null,
    transaction?: Transaction,
  ) {
    const stock = await this.repo.findMedicineStockById(estoque_id, transaction);

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (!login_id) {
      throw new Error('Login é obrigatório');
    }

    if (stock.status === StockItemStatus.SUSPENSO) {
      throw new Error('Medicamento suspenso não pode ser transferido');
    }

    if (stock.setor !== 'farmacia') {
      throw new Error(
        'Transferência permitida apenas de farmácia para enfermaria',
      );
    }

    if (setor !== 'enfermagem') {
      throw new Error('Transferência permitida apenas para enfermaria');
    }

    if (!quantidade || quantidade <= 0) {
      throw new Error('Quantidade é obrigatória e deve ser maior que zero');
    }

    if (quantidade > stock.quantidade) {
      throw new Error(`Quantidade não pode ser maior que ${stock.quantidade}`);
    }

    const hasCasela = casela_id != null;

    if (!hasCasela && !bypassCasela) {
      throw new Error('Casela é obrigatória para transferir');
    }

    const targetCaselaId = casela_id != null ? casela_id : stock.casela_id;

    const result = await this.repo.transferMedicineSector(
      estoque_id,
      setor,
      quantidade,
      bypassCasela,
      targetCaselaId as number,
      observacao,
      dias_para_repor ?? null,
      transaction,
    );

    await this.movementRepo.create({
      tipo: MovementType.TRANSFERENCIA,
      login_id,
      medicamento_id: stock.medicamento_id,
      insumo_id: null,
      quantidade,
      casela_id: targetCaselaId,
      validade: stock.validade ?? new Date(),
      setor,
      armario_id: stock.armario_id ?? undefined,
      gaveta_id: stock.gaveta_id ?? undefined,
      lote: stock.lote ?? null,
      observacao: observacao || null,
    }, transaction);
  
    if (
      this.notificationRepo &&
      dias_para_repor != null &&
      dias_para_repor > 0 &&
      targetCaselaId != null
    ) {
      const dataPrevista = new Date();
      dataPrevista.setDate(dataPrevista.getDate() + dias_para_repor);
      await this.notificationRepo.create({
        medicamento_id: stock.medicamento_id,
        residente_id: targetCaselaId as number,
        destino: NotificationDestinoType.ESTOQUE,
        data_prevista: dataPrevista,
        criado_por: login_id,
        visto: false,
        tipo_evento: NotificationEventType.REPOSICAO_ESTOQUE,
        quantidade,
        dias_para_repor,
      }, transaction);
    }

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async getDaysForReplacementForNursing(
    medicamento_id: number,
    casela_id: number,
    transaction?: Transaction,
  ): Promise<number | null> {
    return this.repo.getDaysForReplacementForNursing(medicamento_id, casela_id, transaction);
  }

  async transferInputSector(
    estoque_id: number,
    setor: 'farmacia' | 'enfermagem',
    quantidade: number,
    login_id: number,
    casela_id?: number,
    destino?: string | null,
    observacao?: string | null,
    dias_para_repor?: number | null,
    transaction?: Transaction,
  ) {
    const stock = await this.repo.findInputStockById(estoque_id, transaction);

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
      throw new Error(
        'Transferência permitida apenas de farmácia para enfermaria',
      );
    }

    if (setor !== 'enfermagem') {
      throw new Error('Transferência permitida apenas para enfermaria');
    }

    if (!quantidade || quantidade <= 0) {
      throw new Error('Quantidade é obrigatória e deve ser maior que zero');
    }

    if (quantidade > stock.quantidade) {
      throw new Error(`Quantidade não pode ser maior que ${stock.quantidade}`);
    }

    const hasDestino = destino != null && destino.trim() !== '';
    const hasCasela = casela_id != null;

    if (hasDestino && hasCasela) {
      throw new Error('Destino e casela não podem ser informados juntos');
    }

    if (!hasDestino && !hasCasela) {
      throw new Error('Casela ou destino é obrigatório para transferir');
    }

    const targetTipo = hasDestino
      ? OperationType.GERAL
      : OperationType.INDIVIDUAL;

    const targetCaselaId =
      targetTipo === OperationType.INDIVIDUAL ? casela_id : null;

    const targetDestino = targetTipo === OperationType.GERAL ? destino : null;

    const result = await this.repo.transferInputSector(
      estoque_id,
      setor,
      quantidade,
      targetCaselaId,
      targetDestino,
      observacao ?? null,
      dias_para_repor ?? null,
      transaction,
    );

    await this.movementRepo.create({
      tipo: MovementType.TRANSFERENCIA,
      login_id,
      medicamento_id: null,
      insumo_id: stock.insumo_id,
      quantidade,
      casela_id: targetCaselaId,
      validade: stock.validade ?? new Date(),
      setor,
      armario_id: stock.armario_id ?? undefined,
      gaveta_id: stock.gaveta_id ?? undefined,
      lote: stock.lote ?? null,
      destino: targetDestino,
      observacao: observacao || null,
    }, transaction);

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
      observacao?: string | null;
      dias_para_repor?: number | null;
    },
    transaction?: Transaction,
    loginId?: number,
  ) {
    let stock: { quantidade: number; setor: string; armario_id?: number | null; gaveta_id?: number | null; validade?: Date | null; lote?: string | null; medicamento_id?: number; insumo_id?: number; casela_id?: number | null } | null;

    if (tipo === ItemType.MEDICAMENTO) {
      const medStock = await this.repo.findMedicineStockById(estoqueId, transaction);
      if (!medStock) {
        throw new Error('Item de estoque não encontrado');
      }
      if (medStock.status === StockItemStatus.SUSPENSO) {
        throw new Error(
          'Não é possível editar um medicamento suspenso. Reative-o primeiro.',
        );
      }
      stock = medStock.get({ plain: true }) as typeof stock;
    } else {
      const inpStock = await this.repo.findInputStockById(estoqueId, transaction);
      if (!inpStock) {
        throw new Error('Item de estoque não encontrado');
      }
      if (inpStock.status === StockItemStatus.SUSPENSO) {
        throw new Error(
          'Não é possível editar um insumo suspenso. Reative-o primeiro.',
        );
      }
      stock = inpStock.get({ plain: true }) as typeof stock;
    }

    const oldQty = stock!.quantidade;

    const result = await this.repo.updateStockItem(estoqueId, tipo, data, transaction);

    if (
      data.quantidade != null &&
      loginId != null &&
      data.quantidade !== oldQty
    ) {
      const diff = data.quantidade - oldQty;
      const updated = result.data as Record<string, unknown> | null;
      if (updated && Math.abs(diff) > 0) {
        const setor = (updated.setor as string) || stock!.setor;
        const validade = updated.validade
          ? new Date(updated.validade as string | Date)
          : new Date();
        await this.movementRepo.create(
          {
            tipo: diff > 0 ? MovementType.ENTRADA : MovementType.SAIDA,
            login_id: loginId,
            medicamento_id: tipo === ItemType.MEDICAMENTO ? (updated.medicamento_id as number) : null,
            insumo_id: tipo === ItemType.INSUMO ? (updated.insumo_id as number) : null,
            quantidade: Math.abs(diff),
            casela_id: (updated.casela_id as number | null) ?? null,
            validade,
            setor,
            armario_id: (updated.armario_id as number | undefined) ?? undefined,
            gaveta_id: (updated.gaveta_id as number | undefined) ?? undefined,
            lote: (updated.lote as string | null) ?? null,
          },
          transaction,
        );
        await this.cache.invalidateByPattern(CacheKeyHelper.movementWildcard());
      }
    }

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async deleteStockItem(estoqueId: number, tipo: ItemType, transaction?: Transaction) {
    const result = await this.repo.deleteStockItem(estoqueId, tipo, transaction);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async suspendIndividualInput(estoque_id: number, transaction?: Transaction) {
    const stock = await this.repo.findInputStockById(estoque_id, transaction);

    if (!stock) {
      throw new Error('Insumo não encontrado');
    }

    if (stock.casela_id == null) {
      throw new Error('Somente insumos individuais podem ser suspensos');
    }

    if (stock.status === StockItemStatus.SUSPENSO) {
      throw new Error('Insumo já está suspenso');
    }

    const result = await this.repo.suspendIndividualInput(estoque_id, transaction);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async resumeIndividualInput(estoque_id: number, transaction?: Transaction) {
    const stock = await this.repo.findInputStockById(estoque_id, transaction);

    if (!stock) {
      throw new Error('Insumo não encontrado');
    }

    if (stock.casela_id == null) {
      throw new Error('Somente insumos individuais podem ser retomados');
    }

    if (stock.status !== StockItemStatus.SUSPENSO) {
      throw new Error('Insumo não está suspenso');
    }

    const result = await this.repo.resumeIndividualInput(estoque_id, transaction);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async removeIndividualMedicine(estoqueId: number, transaction?: Transaction) {
    const stock = await this.repo.findMedicineStockById(estoqueId, transaction);

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (stock.tipo !== 'individual') {
      throw new Error('Medicamento não é individual');
    }

    const result = await this.repo.removeIndividualMedicine(estoqueId, transaction);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async removeIndividualInput(estoqueId: number, transaction?: Transaction) {
    const stock = await this.repo.findInputStockById(estoqueId, transaction);

    if (!stock) {
      throw new Error('Insumo não encontrado');
    }

    if (stock.tipo !== 'individual') {
      throw new Error('Insumo não é individual');
    }

    const result = await this.repo.removeIndividualInput(estoqueId, transaction);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }
}
