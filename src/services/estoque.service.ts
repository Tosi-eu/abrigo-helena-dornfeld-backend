import type { PrismaStockRepository } from '@repositories/estoque.repository';
import { CacheKeyHelper } from '@helpers/redis.helper';
import type { InputStockRecord, MedicineStockRecord } from '@porto-sdk/sdk';
import {
  ItemType,
  StockItemStatus,
  QueryPaginationParams,
  MovementType,
  SectorType,
  OperationType,
} from '@helpers/utils';
import { CacheService } from './redis.service';
import type { PrismaNotificationEventRepository } from '@repositories/notificacao.repository';
import { PrismaSetorRepository } from '@repositories/setor.repository';
import { PrismaMedicineRepository } from '@repositories/medicamento.repository';
import { PrismaInputRepository } from '@repositories/insumo.repository';
import { PrismaMovementRepository } from '@repositories/movimentacao.repository';
import { redisRepository } from '@config/redis.client';
import type { EstoqueInsumo, EstoqueMedicamento, Prisma } from '@prisma/client';
import {
  NotificationDestinoType,
  NotificationEventType,
} from '@domain/notificacao.types';

export class StockService {
  private medicineRepo: PrismaMedicineRepository;
  private inputRepo: PrismaInputRepository;
  private movementRepo: PrismaMovementRepository;
  private readonly setorRepo = new PrismaSetorRepository();
  private readonly stockCacheVersionKey = CacheKeyHelper.stockCacheVersionKey();

  constructor(
    private readonly repo: PrismaStockRepository,
    private readonly cache: CacheService,
    private readonly notificationRepo?: PrismaNotificationEventRepository,
  ) {
    this.medicineRepo = new PrismaMedicineRepository();
    this.inputRepo = new PrismaInputRepository();
    this.movementRepo = new PrismaMovementRepository();
  }

  private async getStockCacheVersion(): Promise<number> {
    const current = await redisRepository.get<number>(
      this.stockCacheVersionKey,
    );
    if (current == null) {
      await redisRepository.set(this.stockCacheVersionKey, 1);
      return 1;
    }

    return current;
  }

  private async bumpStockCacheVersion(): Promise<void> {
    await redisRepository.incrBy(this.stockCacheVersionKey, 1);
  }

  async medicineStockIn(
    data: MedicineStockRecord,
    login_id: number,
    tenantId: number,
    transaction?: Prisma.TransactionClient,
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

    const validadeDate =
      data.validade instanceof Date
        ? data.validade
        : data.validade
          ? new Date(data.validade as string)
          : new Date();
    if (validadeDate < new Date()) {
      throw new Error('Produto está vencido.');
    }

    const normalized = {
      ...data,
      setor: data.setor || 'farmacia',
      validade: validadeDate,
    };

    if (data.casela_id && data.gaveta_id) {
      throw new Error('Casela e gaveta não podem ser informados juntos.');
    }

    if (!login_id) {
      throw new Error('Usuário não autenticado');
    }

    const setorRow = await this.setorRepo.findByTenantAndKey(
      tenantId,
      String(normalized.setor).trim().toLowerCase(),
      transaction,
    );
    if (!setorRow) {
      throw new Error(
        'Setor inválido. Defina os setores do abrigo (catálogo) ou use um existente.',
      );
    }
    const normalizedWithSector = {
      ...normalized,
      setor: setorRow.key,
      sector_id: setorRow.id,
    };

    const result = await this.repo.createMedicineStockIn(
      normalizedWithSector,
      tenantId,
      transaction,
    );

    await this.movementRepo.create(
      {
        tenant_id: tenantId,
        tipo: MovementType.ENTRADA,
        login_id,
        medicamento_id: normalizedWithSector.medicamento_id,
        insumo_id: null,
        quantidade: normalizedWithSector.quantidade,
        casela_id: normalizedWithSector.casela_id ?? null,
        validade: normalizedWithSector.validade ?? new Date(),
        setor: normalizedWithSector.setor,
        sector_id: setorRow.id,
        armario_id: normalizedWithSector.armario_id ?? undefined,
        gaveta_id: normalizedWithSector.gaveta_id ?? undefined,
        lote: normalizedWithSector.lote ?? null,
      },
      transaction,
    );

    await this.bumpStockCacheVersion();

    return result;
  }

  async inputStockIn(
    data: InputStockRecord,
    login_id: number,
    tenantId: number,
    transaction?: Prisma.TransactionClient,
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

    const normalized = {
      ...data,
      setor: data.setor || 'farmacia',
      validade:
        data.validade instanceof Date
          ? data.validade
          : data.validade
            ? new Date(data.validade as string)
            : new Date(),
    };

    const setorRowInp = await this.setorRepo.findByTenantAndKey(
      tenantId,
      String(normalized.setor).trim().toLowerCase(),
      transaction,
    );
    if (!setorRowInp) {
      throw new Error(
        'Setor inválido. Defina os setores do abrigo (catálogo) ou use um existente.',
      );
    }
    const normalizedInpWithSector = {
      ...normalized,
      setor: setorRowInp.key,
      sector_id: setorRowInp.id,
    };

    const result = await this.repo.createInputStockIn(
      normalizedInpWithSector,
      tenantId,
      transaction,
    );

    await this.movementRepo.create(
      {
        tenant_id: tenantId,
        tipo: MovementType.ENTRADA,
        login_id,
        medicamento_id: null,
        insumo_id: normalizedInpWithSector.insumo_id,
        quantidade: normalizedInpWithSector.quantidade,
        casela_id: normalizedInpWithSector.casela_id ?? null,
        validade: normalizedInpWithSector.validade ?? new Date(),
        setor: normalizedInpWithSector.setor,
        sector_id: setorRowInp.id,
        armario_id: normalizedInpWithSector.armario_id ?? undefined,
        gaveta_id: normalizedInpWithSector.gaveta_id ?? undefined,
        lote: normalizedInpWithSector.lote ?? null,
      },
      transaction,
    );

    await this.bumpStockCacheVersion();

    return result;
  }

  async stockOut(
    data: {
      estoqueId: number;
      tipo: ItemType;
      quantidade: number;
    },
    login_id: number,
    tenantId: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const { estoqueId, tipo, quantidade } = data;

    if (!estoqueId) throw new Error('Nenhum item foi selecionado');
    if (quantidade <= 0) throw new Error('Quantidade inválida.');
    if (!tipo) throw new Error('Tipo de item inválido.');
    if (!login_id) throw new Error('Usuário não autenticado');

    let stockItem: EstoqueMedicamento | EstoqueInsumo | null = null;
    if (tipo === ItemType.MEDICAMENTO) {
      stockItem = await this.repo.findMedicineStockById(
        estoqueId,
        transaction,
        tenantId,
      );
    } else {
      stockItem = await this.repo.findInputStockById(
        estoqueId,
        transaction,
        tenantId,
      );
    }

    if (!stockItem) {
      throw new Error('Item de estoque não encontrado');
    }

    const result = await this.repo.createStockOut(
      estoqueId,
      tipo,
      quantidade,
      transaction,
    );

    const medicamentoId =
      tipo === ItemType.MEDICAMENTO
        ? (stockItem as EstoqueMedicamento).medicamento_id
        : null;
    const insumoId =
      tipo === ItemType.INSUMO ? (stockItem as EstoqueInsumo).insumo_id : null;
    const lote = stockItem.lote ?? null;
    await this.movementRepo.create(
      {
        tenant_id: tenantId,
        tipo: MovementType.SAIDA,
        login_id,
        medicamento_id: medicamentoId,
        insumo_id: insumoId,
        quantidade,
        casela_id: stockItem.casela_id ?? null,
        validade: stockItem.validade ?? new Date(),
        setor: stockItem.setor,
        sector_id:
          'sector_id' in stockItem && stockItem.sector_id != null
            ? Number(stockItem.sector_id)
            : null,
        armario_id: stockItem.armario_id ?? undefined,
        gaveta_id: stockItem.gaveta_id ?? undefined,
        lote,
      },
      transaction,
    );

    await this.bumpStockCacheVersion();

    return result;
  }

  async listStock(
    params: QueryPaginationParams,
    transaction?: Prisma.TransactionClient,
  ) {
    const version = await this.getStockCacheVersion();
    const cacheKey = CacheKeyHelper.stockList(params, version);

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

  async getProportion(
    tenantId: number,
    setor?: SectorType,
    transaction?: Prisma.TransactionClient,
  ) {
    const version = await this.getStockCacheVersion();
    return this.cache.getOrSet(
      CacheKeyHelper.stockDashboard(
        `${tenantId}:${setor ?? 'general'}`,
        version,
      ),
      () => this.repo.getStockProportionBySector(tenantId, setor, transaction),
      60,
    );
  }

  async getProportionBySectorId(
    tenantId: number,
    sectorId: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const version = await this.getStockCacheVersion();
    return this.cache.getOrSet(
      CacheKeyHelper.stockDashboard(`${tenantId}:sector:${sectorId}`, version),
      () =>
        this.repo.getStockProportionBySectorId(tenantId, sectorId, transaction),
      60,
    );
  }

  async getFilterOptions(
    tenantId: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const version = await this.getStockCacheVersion();
    return this.cache.getOrSet(
      CacheKeyHelper.stockFilterOptions(version) + `:${tenantId}`,
      () => this.repo.getFilterOptions(tenantId, transaction),
      120,
    );
  }

  async getAlertCounts(
    tenantId: number,
    transaction?: Prisma.TransactionClient,
    expiringDays?: number,
  ) {
    return this.repo.getAlertCounts(tenantId, transaction, expiringDays ?? 45);
  }

  async getExpiringItems(
    tenantId: number,
    days: number,
    page?: number,
    limit?: number,
    transaction?: Prisma.TransactionClient,
  ) {
    return this.repo.getExpiringItems(
      tenantId,
      days ?? 30,
      page ?? 1,
      limit ?? 50,
      transaction,
    );
  }

  async suspendIndividualMedicine(
    estoque_id: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const stock = await this.repo.findMedicineStockById(
      estoque_id,
      transaction,
    );

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (stock.casela_id == null) {
      throw new Error('Somente medicamentos individuais podem ser suspensos');
    }

    if (stock.status === StockItemStatus.SUSPENSO) {
      throw new Error('Medicamento já está suspenso');
    }

    const result = await this.repo.suspendIndividualMedicine(
      estoque_id,
      transaction,
    );

    await this.bumpStockCacheVersion();

    return result;
  }

  async resumeIndividualMedicine(
    estoque_id: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const stock = await this.repo.findMedicineStockById(
      estoque_id,
      transaction,
    );

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (stock.casela_id == null) {
      throw new Error('Somente medicamentos individuais podem ser retomados');
    }

    if (stock.status !== StockItemStatus.SUSPENSO) {
      throw new Error('Medicamento não está suspenso');
    }

    const result = await this.repo.resumeIndividualMedicine(
      estoque_id,
      transaction,
    );

    await this.bumpStockCacheVersion();

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
    transaction?: Prisma.TransactionClient,
  ) {
    const stock = await this.repo.findMedicineStockById(
      estoque_id,
      transaction,
    );

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

    const tenantId = stock.tenant_id;
    if (tenantId == null) {
      throw new Error('Tenant não identificado no registro de estoque');
    }
    const destSetorMed = await this.setorRepo.findByTenantAndKey(
      tenantId,
      String(setor).trim().toLowerCase(),
      transaction,
    );
    await this.movementRepo.create(
      {
        tenant_id: tenantId,
        tipo: MovementType.TRANSFERENCIA,
        login_id,
        medicamento_id: stock.medicamento_id,
        insumo_id: null,
        quantidade,
        casela_id: targetCaselaId,
        validade: stock.validade ?? new Date(),
        setor,
        sector_id: destSetorMed?.id ?? null,
        armario_id: stock.armario_id ?? undefined,
        gaveta_id: stock.gaveta_id ?? undefined,
        lote: stock.lote ?? null,
        observacao: observacao || null,
      },
      transaction,
    );

    if (
      this.notificationRepo &&
      dias_para_repor != null &&
      dias_para_repor > 0 &&
      targetCaselaId != null
    ) {
      const dataPrevista = new Date();
      dataPrevista.setDate(dataPrevista.getDate() + dias_para_repor);
      await this.notificationRepo.create(
        {
          tenant_id: tenantId,
          medicamento_id: stock.medicamento_id,
          residente_id: targetCaselaId as number,
          destino: NotificationDestinoType.ESTOQUE,
          data_prevista: dataPrevista,
          criado_por: login_id,
          visto: false,
          tipo_evento: NotificationEventType.REPOSICAO_ESTOQUE,
          quantidade,
          dias_para_repor,
        },
        transaction,
      );
    }

    await this.bumpStockCacheVersion();

    return result;
  }

  async getDaysForReplacementForNursing(
    tenantId: number,
    medicamento_id: number,
    casela_id: number,
    transaction?: Prisma.TransactionClient,
  ): Promise<number | null> {
    return this.repo.getDaysForReplacementForNursing(
      tenantId,
      medicamento_id,
      casela_id,
      transaction,
    );
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
    transaction?: Prisma.TransactionClient,
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

    const tenantId = stock.tenant_id;
    if (tenantId == null) {
      throw new Error('Tenant não identificado no registro de estoque');
    }
    const destSetorInp = await this.setorRepo.findByTenantAndKey(
      tenantId,
      String(setor).trim().toLowerCase(),
      transaction,
    );
    await this.movementRepo.create(
      {
        tenant_id: tenantId,
        tipo: MovementType.TRANSFERENCIA,
        login_id,
        medicamento_id: null,
        insumo_id: stock.insumo_id,
        quantidade,
        casela_id: targetCaselaId,
        validade: stock.validade ?? new Date(),
        setor,
        sector_id: destSetorInp?.id ?? null,
        armario_id: stock.armario_id ?? undefined,
        gaveta_id: stock.gaveta_id ?? undefined,
        lote: stock.lote ?? null,
        destino: targetDestino,
        observacao: observacao || null,
      },
      transaction,
    );

    await this.bumpStockCacheVersion();

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
    transaction?: Prisma.TransactionClient,
    loginId?: number,
  ) {
    let stock: {
      quantidade: number;
      setor: string;
      armario_id?: number | null;
      gaveta_id?: number | null;
      validade?: Date | null;
      lote?: string | null;
      medicamento_id?: number;
      insumo_id?: number;
      casela_id?: number | null;
    } | null;

    if (tipo === ItemType.MEDICAMENTO) {
      const medStock = await this.repo.findMedicineStockById(
        estoqueId,
        transaction,
      );
      if (!medStock) {
        throw new Error('Item de estoque não encontrado');
      }
      if (medStock.status === StockItemStatus.SUSPENSO) {
        throw new Error(
          'Não é possível editar um medicamento suspenso. Reative-o primeiro.',
        );
      }
      stock = medStock;
    } else {
      const inpStock = await this.repo.findInputStockById(
        estoqueId,
        transaction,
      );
      if (!inpStock) {
        throw new Error('Item de estoque não encontrado');
      }
      if (inpStock.status === StockItemStatus.SUSPENSO) {
        throw new Error(
          'Não é possível editar um insumo suspenso. Reative-o primeiro.',
        );
      }
      stock = inpStock;
    }

    if (stock == null) {
      throw new Error('Item de estoque não encontrado');
    }

    const oldQty = stock.quantidade;

    const result = await this.repo.updateStockItem(
      estoqueId,
      tipo,
      data,
      transaction,
    );

    if (
      data.quantidade != null &&
      loginId != null &&
      data.quantidade !== oldQty
    ) {
      const diff = data.quantidade - oldQty;
      const updated = result.data as Record<string, unknown> | null;
      if (updated && Math.abs(diff) > 0) {
        const setor = (updated.setor as string) || stock.setor;
        const validade = updated.validade
          ? new Date(updated.validade as string | Date)
          : new Date();
        const tenantId = updated.tenant_id as number | undefined;
        if (tenantId == null) {
          throw new Error('Tenant não identificado no registro de estoque');
        }
        const setorRowAdj = await this.setorRepo.findByTenantAndKey(
          tenantId,
          String(setor).trim().toLowerCase(),
          transaction,
        );
        await this.movementRepo.create(
          {
            tenant_id: tenantId,
            tipo: diff > 0 ? MovementType.ENTRADA : MovementType.SAIDA,
            login_id: loginId,
            medicamento_id:
              tipo === ItemType.MEDICAMENTO
                ? (updated.medicamento_id as number)
                : null,
            insumo_id:
              tipo === ItemType.INSUMO ? (updated.insumo_id as number) : null,
            quantidade: Math.abs(diff),
            casela_id: (updated.casela_id as number | null) ?? null,
            validade,
            setor,
            sector_id: setorRowAdj?.id ?? null,
            armario_id: (updated.armario_id as number | undefined) ?? undefined,
            gaveta_id: (updated.gaveta_id as number | undefined) ?? undefined,
            lote: (updated.lote as string | null) ?? null,
          },
          transaction,
        );
        await this.cache.invalidateByPattern(CacheKeyHelper.movementWildcard());
      }
    }

    await this.bumpStockCacheVersion();

    return result;
  }

  async deleteStockItem(
    estoqueId: number,
    tipo: ItemType,
    transaction?: Prisma.TransactionClient,
  ) {
    const result = await this.repo.deleteStockItem(
      estoqueId,
      tipo,
      transaction,
    );

    await this.bumpStockCacheVersion();

    return result;
  }

  async suspendIndividualInput(
    estoque_id: number,
    transaction?: Prisma.TransactionClient,
  ) {
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

    const result = await this.repo.suspendIndividualInput(
      estoque_id,
      transaction,
    );

    await this.bumpStockCacheVersion();

    return result;
  }

  async resumeIndividualInput(
    estoque_id: number,
    transaction?: Prisma.TransactionClient,
  ) {
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

    const result = await this.repo.resumeIndividualInput(
      estoque_id,
      transaction,
    );

    await this.bumpStockCacheVersion();

    return result;
  }

  async removeIndividualMedicine(
    estoqueId: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const stock = await this.repo.findMedicineStockById(estoqueId, transaction);

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (stock.tipo !== 'individual') {
      throw new Error('Medicamento não é individual');
    }

    const result = await this.repo.removeIndividualMedicine(
      estoqueId,
      transaction,
    );

    await this.bumpStockCacheVersion();

    return result;
  }

  async removeIndividualInput(
    estoqueId: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const stock = await this.repo.findInputStockById(estoqueId, transaction);

    if (!stock) {
      throw new Error('Insumo não encontrado');
    }

    if (stock.tipo !== 'individual') {
      throw new Error('Insumo não é individual');
    }

    const result = await this.repo.removeIndividualInput(
      estoqueId,
      transaction,
    );

    await this.bumpStockCacheVersion();

    return result;
  }
}
