import type { InputStockRecord, MedicineStockRecord } from '@porto-sdk/sdk';
import { Prisma } from '@prisma/client';
import type { EstoqueInsumo, EstoqueMedicamento } from '@prisma/client';
import { getDb } from '@repositories/prisma';
import {
  computeExpiryStatus,
  computeQuantityStatus,
} from '@helpers/expiry-status';
import {
  ItemType,
  StockItemStatus,
  OperationType,
  QueryPaginationParams,
  SectorType,
  StockFilterType,
  StockQueryType,
} from '@helpers/utils';
import { formatDateToPtBr, getTodayAtNoonBrazil } from '@helpers/date.helper';
import {
  SECTOR_CONFIG,
  StockGroup,
  StockQueryResult,
  ExpiringStockItem,
} from '@domain/estoque.types';

function db(tx?: Prisma.TransactionClient) {
  return tx ?? getDb();
}

type PrismaTx = Prisma.TransactionClient | ReturnType<typeof getDb>;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export class PrismaStockRepository {
  async createMedicineStockIn(
    data: MedicineStockRecord,
    tenantId: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = db(transaction);
    try {
      const validade = startOfDay(
        data.validade != null ? new Date(data.validade as Date) : new Date(),
      );

      const existing = await client.estoqueMedicamento.findFirst({
        where: {
          medicamento_id: data.medicamento_id,
          armario_id: data.armario_id ?? null,
          gaveta_id: data.gaveta_id ?? null,
          validade,
          tipo: data.tipo,
          casela_id: data.casela_id ?? null,
          origem: data.origem,
          lote: data.lote ?? null,
        },
      });

      if (existing) {
        const updated = await client.estoqueMedicamento.update({
          where: { id: existing.id },
          data: { quantidade: existing.quantidade + data.quantidade },
        });
        return {
          message: 'Quantidade somada ao estoque existente.',
          data: updated,
        };
      }

      const created = await client.estoqueMedicamento.create({
        data: {
          tenant_id: tenantId,
          medicamento_id: data.medicamento_id,
          casela_id: data.casela_id ?? null,
          armario_id: data.armario_id ?? null,
          gaveta_id: data.gaveta_id ?? null,
          validade,
          quantidade: data.quantidade,
          origem: data.origem,
          tipo: data.tipo,
          setor: data.setor,
          lote: data.lote ?? null,
          observacao: data.observacao ?? null,
          status: StockItemStatus.ATIVO,
        },
      });

      return {
        message: 'Entrada de medicamento registrada.',
        data: created,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message);
    }
  }

  async createInputStockIn(
    data: InputStockRecord,
    tenantId: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = db(transaction);
    const validade =
      data.validade != null ? new Date(data.validade as Date) : new Date();

    const existing = await client.estoqueInsumo.findFirst({
      where: {
        insumo_id: data.insumo_id,
        armario_id: data.armario_id ?? null,
        gaveta_id: data.gaveta_id ?? null,
        validade,
        tipo: data.tipo,
        casela_id: data.casela_id ?? null,
        lote: data.lote ?? null,
      },
    });

    if (data.casela_id && data.tipo !== OperationType.INDIVIDUAL) {
      throw new Error('Casela só pode ser usada para insumo individual');
    }

    if (existing) {
      const updated = await client.estoqueInsumo.update({
        where: { id: existing.id },
        data: { quantidade: existing.quantidade + data.quantidade },
      });
      return {
        message: 'Quantidade somada ao estoque existente.',
        data: updated,
      };
    }

    const created = await client.estoqueInsumo.create({
      data: {
        tenant_id: tenantId,
        insumo_id: data.insumo_id,
        casela_id: data.casela_id ?? null,
        armario_id: data.armario_id ?? null,
        gaveta_id: data.gaveta_id ?? null,
        quantidade: data.quantidade,
        validade,
        tipo: data.tipo,
        setor: data.setor,
        lote: data.lote ?? null,
        status: (data.status ?? StockItemStatus.ATIVO) as string,
        suspended_at: data.suspended_at ?? null,
      },
    });

    return {
      message: 'Entrada de insumo registrada.',
      data: created,
    };
  }

  async createStockOut(
    estoqueId: number,
    tipoItem: ItemType,
    quantidade: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = db(transaction);
    if (tipoItem === 'medicamento') {
      const register = await client.estoqueMedicamento.findUnique({
        where: { id: estoqueId },
      });

      if (!register) throw new Error('register de medicamento não encontrado.');

      if (register.quantidade < quantidade)
        throw new Error('Quantidade insuficiente.');

      if (register.status === StockItemStatus.SUSPENSO) {
        throw new Error('Medicamento suspenso não pode ser movimentado');
      }

      const updated = await client.estoqueMedicamento.update({
        where: { id: estoqueId },
        data: { quantidade: register.quantidade - quantidade },
      });
      return {
        message: 'Saída de medicamento realizada.',
        data: updated,
      };
    } else {
      const register = await client.estoqueInsumo.findUnique({
        where: { id: estoqueId },
      });
      if (!register) throw new Error('register de insumo não encontrado.');
      if (register.quantidade < quantidade)
        throw new Error('Quantidade insuficiente.');

      if (register.status === StockItemStatus.SUSPENSO) {
        throw new Error('Insumo suspenso não pode ser movimentado');
      }

      const updated = await client.estoqueInsumo.update({
        where: { id: estoqueId },
        data: { quantidade: register.quantidade - quantidade },
      });
      return {
        message: 'Saída de insumo realizada.',
        data: updated,
      };
    }
  }

  async listStockItems(
    params: QueryPaginationParams,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = db(transaction);
    const { filter, type, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    if (type === 'armarios') {
      const cabinets = await client.armario.findMany({
        orderBy: { num_armario: 'asc' },
        select: { num_armario: true },
      });

      const cabinetIds = cabinets.map(c => c.num_armario);
      if (cabinetIds.length === 0) {
        return {
          data: [],
          total: 0,
          page,
          limit,
          hasNext: false,
        };
      }

      const [medicineTotals, inputTotals] = await Promise.all([
        client.estoqueMedicamento.groupBy({
          by: ['armario_id'],
          where: { armario_id: { in: cabinetIds } },
          _sum: { quantidade: true },
        }),
        client.estoqueInsumo.groupBy({
          by: ['armario_id'],
          where: { armario_id: { in: cabinetIds } },
          _sum: { quantidade: true },
        }),
      ]);

      const medicineMap = new Map(
        medicineTotals.map(item => [
          item.armario_id as number,
          Number(item._sum.quantidade ?? 0),
        ]),
      );
      const inputMap = new Map(
        inputTotals.map(item => [
          item.armario_id as number,
          Number(item._sum.quantidade ?? 0),
        ]),
      );

      const results = cabinets.map(cabinet => {
        const totalMedicamentos = medicineMap.get(cabinet.num_armario) || 0;
        const totalInsumos = inputMap.get(cabinet.num_armario) || 0;

        return {
          armario_id: cabinet.num_armario,
          total_medicamentos: totalMedicamentos,
          total_insumos: totalInsumos,
          total_geral: totalMedicamentos + totalInsumos,
        };
      });

      return {
        data: results,
        total: results.length,
        page,
        limit,
        hasNext: false,
      };
    }

    if (type === StockQueryType.GAVETAS) {
      const drawers = await client.gaveta.findMany({
        orderBy: { num_gaveta: 'asc' },
        select: { num_gaveta: true },
      });

      const drawerIds = drawers.map(d => d.num_gaveta);
      if (drawerIds.length === 0) {
        return {
          data: [],
          total: 0,
          page,
          limit,
          hasNext: false,
        };
      }

      const [medicineTotals, inputTotals] = await Promise.all([
        client.estoqueMedicamento.groupBy({
          by: ['gaveta_id'],
          where: { gaveta_id: { in: drawerIds } },
          _sum: { quantidade: true },
        }),
        client.estoqueInsumo.groupBy({
          by: ['gaveta_id'],
          where: { gaveta_id: { in: drawerIds } },
          _sum: { quantidade: true },
        }),
      ]);

      const medicineMap = new Map(
        medicineTotals.map(item => [
          item.gaveta_id as number,
          Number(item._sum.quantidade ?? 0),
        ]),
      );
      const inputMap = new Map(
        inputTotals.map(item => [
          item.gaveta_id as number,
          Number(item._sum.quantidade ?? 0),
        ]),
      );

      const results = drawers.map(drawer => {
        const totalMedicamentos = medicineMap.get(drawer.num_gaveta) || 0;
        const totalInsumos = inputMap.get(drawer.num_gaveta) || 0;

        return {
          gaveta_id: drawer.num_gaveta,
          total_medicamentos: totalMedicamentos,
          total_insumos: totalInsumos,
          total_geral: totalMedicamentos + totalInsumos,
        };
      });

      return {
        data: results,
        total: results.length,
        page,
        limit,
        hasNext: false,
      };
    }

    const today = startOfDay(new Date());
    const in45Days = new Date(today);
    in45Days.setDate(in45Days.getDate() + 45);

    const buildMedicineWhere = (): Prisma.EstoqueMedicamentoWhereInput => {
      const base: Prisma.EstoqueMedicamentoWhereInput = {};
      switch (filter) {
        case 'belowMin':
          base.quantidade = { gte: 0 };
          break;
        case 'expired':
          base.quantidade = { gt: 0 };
          base.validade = { lt: today };
          break;
        case 'expiringSoon':
          base.quantidade = { gt: 0 };
          base.validade = { gte: today, lte: in45Days };
          break;
        default:
          break;
      }
      return base;
    };

    const buildInputWhere = (): Prisma.EstoqueInsumoWhereInput => {
      const base: Prisma.EstoqueInsumoWhereInput = {};
      switch (filter) {
        case 'belowMin':
          base.quantidade = { gte: 0 };
          break;
        case 'expired':
          base.quantidade = { gt: 0 };
          base.validade = { lt: today };
          break;
        case 'expiringSoon':
          base.quantidade = { gt: 0 };
          base.validade = { gte: today, lte: in45Days };
          break;
        case StockFilterType.NEAR_MIN:
          base.quantidade = { gt: 0 };
          break;
        default:
          break;
      }
      return base;
    };

    const medicineWhere = buildMedicineWhere();
    const inputWhereBase = buildInputWhere();
    const results: StockQueryResult[] = [];

    const shouldIncludeMedicines =
      !params.itemType || params.itemType === 'medicamento';
    const shouldIncludeInputs =
      !params.itemType || params.itemType === 'insumo';

    if ((!type || type === 'medicamento') && shouldIncludeMedicines) {
      if (params.cabinet) {
        medicineWhere.armario_id = Number(params.cabinet);
      }
      if (params.drawer) {
        medicineWhere.gaveta_id = Number(params.drawer);
      }
      if (params.casela) {
        medicineWhere.casela_id = Number(params.casela);
      }
      if (params.sector) {
        medicineWhere.setor = params.sector;
      }
      if (params.lot) {
        medicineWhere.lote = {
          contains: params.lot,
          mode: 'insensitive',
        };
      }

      let medicamentoFilter: Prisma.MedicamentoWhereInput | undefined;
      if (params.name && params.name.trim()) {
        medicamentoFilter = {
          nome: { contains: params.name.trim(), mode: 'insensitive' },
        };
      }

      const medIdsForName = medicamentoFilter
        ? (
            await client.medicamento.findMany({
              where: medicamentoFilter,
              select: { id: true },
            })
          ).map(m => m.id)
        : null;

      if (medIdsForName && medIdsForName.length === 0) {
        // no-op
      } else {
        if (medIdsForName) {
          medicineWhere.medicamento_id = { in: medIdsForName };
        }

        const medicineStocks = await client.estoqueMedicamento.findMany({
          where: medicineWhere,
          orderBy: { id: 'asc' },
          take: type ? limit : undefined,
          skip: type ? offset : undefined,
        });

        const medIds = [...new Set(medicineStocks.map(s => s.medicamento_id))];
        const medicines = await client.medicamento.findMany({
          where: { id: { in: medIds } },
        });
        const medMap = new Map(medicines.map(m => [m.id, m]));

        const caselaPairs = medicineStocks
          .filter(s => s.casela_id != null)
          .map(s => ({
            tenant_id: s.tenant_id,
            num_casela: s.casela_id as number,
          }));
        const resKey = (t: number, c: number) => `${t}:${c}`;
        const uniqPairs = [
          ...new Map(
            caselaPairs.map(p => [resKey(p.tenant_id, p.num_casela), p]),
          ).values(),
        ];
        const residents =
          uniqPairs.length === 0
            ? []
            : await client.residente.findMany({
                where: {
                  OR: uniqPairs.map(p => ({
                    tenant_id: p.tenant_id,
                    num_casela: p.num_casela,
                  })),
                },
              });
        const resMap = new Map(
          residents.map(r => [resKey(r.tenant_id, r.num_casela), r]),
        );

        for (const stock of medicineStocks) {
          const medicine = medMap.get(stock.medicamento_id);
          const resident =
            stock.casela_id != null
              ? resMap.get(resKey(stock.tenant_id, stock.casela_id))
              : undefined;

          if (filter === 'belowMin') {
            const minStock = medicine?.estoque_minimo ?? 0;
            if (stock.quantidade >= minStock) continue;
          }

          if (filter === 'nearMin') {
            const minStock = medicine?.estoque_minimo ?? 0;
            if (minStock === 0) continue;
            if (stock.quantidade <= minStock) continue;
            const upperLimit = minStock * 1.35;
            if (stock.quantidade > upperLimit) continue;
          }

          results.push({
            tipo_item: 'medicamento',
            estoque_id: stock.id,
            item_id: medicine?.id,
            nome: medicine?.nome,
            principio_ativo: medicine?.principio_ativo || null,
            dosagem: medicine?.dosagem || null,
            unidade_medida: medicine?.unidade_medida || null,
            descricao: null,
            validade: stock.validade,
            quantidade: stock.quantidade,
            minimo: medicine?.estoque_minimo || 0,
            origem: stock.origem || null,
            tipo: stock.tipo || null,
            paciente: resident?.nome || null,
            armario_id: stock.armario_id || null,
            gaveta_id: stock.gaveta_id || null,
            casela_id: stock.casela_id || null,
            setor: stock.setor,
            status: stock.status || null,
            suspenso_em: stock.suspended_at || null,
            lote: stock.lote || null,
            observacao: stock.observacao || null,
            dias_para_repor: stock.dias_para_repor ?? null,
            destino: null,
          } as StockQueryResult);
        }
      }
    }

    if ((!type || type === 'insumo') && shouldIncludeInputs) {
      const inputWhere: Prisma.EstoqueInsumoWhereInput = { ...inputWhereBase };

      if (params.cabinet) {
        inputWhere.armario_id = Number(params.cabinet);
      }
      if (params.drawer) {
        inputWhere.gaveta_id = Number(params.drawer);
      }
      if (params.casela) {
        inputWhere.casela_id = Number(params.casela);
      }
      if (params.sector) {
        inputWhere.setor = params.sector;
      }
      if (params.lot) {
        inputWhere.lote = {
          contains: params.lot,
          mode: 'insensitive',
        };
      }

      let insumoFilter: Prisma.InsumoWhereInput | undefined;
      if (params.name && params.name.trim()) {
        insumoFilter = {
          nome: { contains: params.name.trim(), mode: 'insensitive' },
        };
      }

      const insIdsForName = insumoFilter
        ? (
            await client.insumo.findMany({
              where: insumoFilter,
              select: { id: true },
            })
          ).map(i => i.id)
        : null;

      if (insIdsForName && insIdsForName.length === 0) {
        // no-op
      } else {
        if (insIdsForName) {
          inputWhere.insumo_id = { in: insIdsForName };
        }

        const inputStocks = await client.estoqueInsumo.findMany({
          where: inputWhere,
          orderBy: { id: 'asc' },
          take: type ? limit : undefined,
          skip: type ? offset : undefined,
        });

        const insIds = [...new Set(inputStocks.map(s => s.insumo_id))];
        const insumos = await client.insumo.findMany({
          where: { id: { in: insIds } },
        });
        const insMap = new Map(insumos.map(i => [i.id, i]));

        const caselaPairsInp = inputStocks
          .filter(s => s.casela_id != null)
          .map(s => ({
            tenant_id: s.tenant_id,
            num_casela: s.casela_id as number,
          }));
        const resKey = (t: number, c: number) => `${t}:${c}`;
        const uniqPairsInp = [
          ...new Map(
            caselaPairsInp.map(p => [resKey(p.tenant_id, p.num_casela), p]),
          ).values(),
        ];
        const residentsInp =
          uniqPairsInp.length === 0
            ? []
            : await client.residente.findMany({
                where: {
                  OR: uniqPairsInp.map(p => ({
                    tenant_id: p.tenant_id,
                    num_casela: p.num_casela,
                  })),
                },
              });
        const resMapInp = new Map(
          residentsInp.map(r => [resKey(r.tenant_id, r.num_casela), r]),
        );

        for (const stock of inputStocks) {
          const input = insMap.get(stock.insumo_id);
          const resident =
            stock.casela_id != null
              ? resMapInp.get(resKey(stock.tenant_id, stock.casela_id))
              : undefined;

          if (filter === StockFilterType.BELOW_MIN) {
            const minStock = input?.estoque_minimo ?? 0;
            if (stock.quantidade >= minStock) continue;
          }

          if (filter === StockFilterType.NEAR_MIN) {
            const minStock = input?.estoque_minimo ?? 0;
            if (minStock === 0) continue;
            if (stock.quantidade <= minStock) continue;
            const upperLimit = minStock * 1.2;
            if (stock.quantidade > upperLimit) continue;
          }

          results.push({
            tipo_item: 'insumo',
            estoque_id: stock.id,
            item_id: input?.id,
            nome: input?.nome,
            principio_ativo: null,
            descricao: input?.descricao || null,
            validade: stock.validade,
            quantidade: stock.quantidade,
            minimo: input?.estoque_minimo || 0,
            origem: null,
            tipo: stock.tipo,
            paciente: resident?.nome || null,
            armario_id: stock.armario_id || null,
            gaveta_id: stock.gaveta_id || null,
            casela_id: stock.casela_id || null,
            setor: stock.setor,
            status: stock.status || null,
            suspenso_em: stock.suspended_at || null,
            destino: stock.destino || null,
            lote: stock.lote || null,
            observacao: stock.observacao || null,
            dias_para_repor: stock.dias_para_repor ?? null,
          } as StockQueryResult);
        }
      }
    }

    results.sort((a, b) => {
      const nomeA = (a.nome || '').toLowerCase();
      const nomeB = (b.nome || '').toLowerCase();
      return nomeA.localeCompare(nomeB);
    });

    const total = results.length;
    const paginatedResults = !type
      ? results.slice(offset, offset + limit)
      : results;

    const mapped = paginatedResults.map((item: StockQueryResult) => {
      let expiryInfo: { status: string | null; message: string | null } = {
        status: null,
        message: null,
      };
      let quantityInfo: { status: string | null; message: string | null } = {
        status: null,
        message: null,
      };

      if (item.validade) {
        const validadeDate =
          item.validade instanceof Date
            ? item.validade
            : new Date(item.validade as string);
        expiryInfo = computeExpiryStatus(validadeDate);
        quantityInfo = computeQuantityStatus(
          item.quantidade ?? 0,
          item.minimo ?? 0,
        );
      }

      return {
        ...item,
        validade: item.validade ? formatDateToPtBr(item.validade) : null,
        st_expiracao: expiryInfo.status,
        msg_expiracao: expiryInfo.message,
        st_quantidade: quantityInfo.status,
        msg_quantidade: quantityInfo.message,
      };
    });

    return {
      data: mapped,
      total,
      page,
      limit,
      hasNext: total > page * limit,
    };
  }

  async getFilterOptions(transaction?: Prisma.TransactionClient) {
    const client = db(transaction);
    const [medCabinets, inpCabinets, medCaselas, inpCaselas, medLots, inpLots] =
      await Promise.all([
        client.estoqueMedicamento.findMany({
          where: { armario_id: { not: null } },
          distinct: ['armario_id'],
          select: { armario_id: true },
        }),
        client.estoqueInsumo.findMany({
          where: { armario_id: { not: null } },
          distinct: ['armario_id'],
          select: { armario_id: true },
        }),
        client.estoqueMedicamento.findMany({
          where: { casela_id: { not: null } },
          distinct: ['casela_id'],
          select: { casela_id: true },
        }),
        client.estoqueInsumo.findMany({
          where: { casela_id: { not: null } },
          distinct: ['casela_id'],
          select: { casela_id: true },
        }),
        client.estoqueMedicamento.findMany({
          where: {
            lote: { not: null },
            NOT: { lote: '' },
          },
          distinct: ['lote'],
          select: { lote: true },
        }),
        client.estoqueInsumo.findMany({
          where: {
            lote: { not: null },
            NOT: { lote: '' },
          },
          distinct: ['lote'],
          select: { lote: true },
        }),
      ]);

    const cabinets = Array.from(
      new Set([
        ...medCabinets.map(r => r.armario_id as number),
        ...inpCabinets.map(r => r.armario_id as number),
      ]),
    ).sort((a, b) => a - b);

    const caselas = Array.from(
      new Set([
        ...medCaselas.map(r => r.casela_id as number),
        ...inpCaselas.map(r => r.casela_id as number),
      ]),
    ).sort((a, b) => a - b);

    const lots = Array.from(
      new Set([
        ...medLots.map(r => r.lote as string),
        ...inpLots.map(r => r.lote as string),
      ]),
    )
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)));

    return { cabinets, caselas, lots };
  }

  private async sumStock(
    model: 'medicamento' | 'insumo',
    options: {
      setor?: SectorType;
      tipos?: OperationType[];
    },
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = db(tx);
    const whereMed: Prisma.EstoqueMedicamentoWhereInput = {
      ...(options.setor && { setor: options.setor }),
      ...(options.tipos && { tipo: { in: options.tipos } }),
    };
    const whereInp: Prisma.EstoqueInsumoWhereInput = {
      ...(options.setor && { setor: options.setor }),
      ...(options.tipos && { tipo: { in: options.tipos } }),
    };

    if (model === 'medicamento') {
      const agg = await client.estoqueMedicamento.aggregate({
        where: whereMed,
        _sum: { quantidade: true },
      });
      return Number(agg._sum.quantidade ?? 0);
    }
    const agg = await client.estoqueInsumo.aggregate({
      where: whereInp,
      _sum: { quantidade: true },
    });
    return Number(agg._sum.quantidade ?? 0);
  }

  async getStockProportionBySector(
    setor?: SectorType,
    transaction?: Prisma.TransactionClient,
  ): Promise<Record<StockGroup, number>> {
    const baseResult: Record<StockGroup, number> = {
      medicamentos_geral: 0,
      medicamentos_individual: 0,
      insumos_geral: 0,
      insumos_individual: 0,
      carrinho_emergencia_medicamentos: 0,
      carrinho_psicotropicos_medicamentos: 0,
      carrinho_emergencia_insumos: 0,
      carrinho_psicotropicos_insumos: 0,
    };

    if (!setor) {
      const [
        medicamentosGeral,
        medicamentosIndividual,
        insumosGeral,
        insumosIndividual,
        carrinhoEmergenciaMedicamentos,
        carrinhoPsicotropicosMedicamentos,
        carrinhoEmergenciaInsumos,
        carrinhoPsicotropicosInsumos,
      ] = await Promise.all([
        this.sumStock(
          'medicamento',
          { tipos: [OperationType.GERAL] },
          transaction,
        ),
        this.sumStock(
          'medicamento',
          { tipos: [OperationType.INDIVIDUAL] },
          transaction,
        ),
        this.sumStock('insumo', { tipos: [OperationType.GERAL] }, transaction),
        this.sumStock(
          'insumo',
          { tipos: [OperationType.INDIVIDUAL] },
          transaction,
        ),
        this.sumStock(
          'medicamento',
          { tipos: [OperationType.CARRINHO_EMERGENCIA] },
          transaction,
        ),
        this.sumStock(
          'medicamento',
          { tipos: [OperationType.CARRINHO_PSICOTROPICOS] },
          transaction,
        ),
        this.sumStock(
          'insumo',
          { tipos: [OperationType.CARRINHO_EMERGENCIA] },
          transaction,
        ),
        this.sumStock(
          'insumo',
          { tipos: [OperationType.CARRINHO_PSICOTROPICOS] },
          transaction,
        ),
      ]);

      return {
        medicamentos_geral: medicamentosGeral,
        medicamentos_individual: medicamentosIndividual,
        insumos_geral: insumosGeral,
        insumos_individual: insumosIndividual,
        carrinho_emergencia_medicamentos: carrinhoEmergenciaMedicamentos,
        carrinho_psicotropicos_medicamentos: carrinhoPsicotropicosMedicamentos,
        carrinho_emergencia_insumos: carrinhoEmergenciaInsumos,
        carrinho_psicotropicos_insumos: carrinhoPsicotropicosInsumos,
      };
    }

    const config = SECTOR_CONFIG[setor];

    for (const [group, tipos] of Object.entries(config.medicines)) {
      baseResult[group as StockGroup] = await this.sumStock(
        'medicamento',
        {
          setor,
          tipos,
        },
        transaction,
      );
    }

    for (const [group, tipos] of Object.entries(config.inputs)) {
      baseResult[group as StockGroup] = await this.sumStock(
        'insumo',
        {
          setor,
          tipos,
        },
        transaction,
      );
    }

    return baseResult;
  }

  async findMedicineStockById(
    id: number,
    transaction?: Prisma.TransactionClient,
  ): Promise<EstoqueMedicamento | null> {
    return db(transaction).estoqueMedicamento.findUnique({ where: { id } });
  }

  async getDaysForReplacementForNursing(
    medicamento_id: number,
    casela_id: number,
    transaction?: Prisma.TransactionClient,
  ): Promise<number | null> {
    const row = await db(transaction).estoqueMedicamento.findFirst({
      where: {
        medicamento_id,
        casela_id,
        setor: 'enfermagem',
        dias_para_repor: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      select: { dias_para_repor: true },
    });
    const value = row?.dias_para_repor;
    return value != null ? Number(value) : null;
  }

  async removeIndividualMedicine(
    estoqueId: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = db(transaction);
    await client.estoqueMedicamento.update({
      where: { id: estoqueId },
      data: {
        casela_id: null,
        tipo: 'geral',
        setor: SectorType.FARMACIA,
      },
    });

    const updated = await client.estoqueMedicamento.findUnique({
      where: { id: estoqueId },
    });
    return {
      message: 'Medicamento removido do estoque individual',
      data: updated,
    };
  }

  async removeIndividualInput(
    estoqueId: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = db(transaction);
    await client.estoqueInsumo.update({
      where: { id: estoqueId },
      data: {
        casela_id: null,
        tipo: 'geral',
        setor: SectorType.FARMACIA,
      },
    });

    const updated = await client.estoqueInsumo.findUnique({
      where: { id: estoqueId },
    });
    return {
      message: 'Insumo removido do estoque individual',
      data: updated,
    };
  }

  async suspendIndividualMedicine(
    estoque_id: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = db(transaction);
    await client.estoqueMedicamento.update({
      where: { id: estoque_id },
      data: {
        status: StockItemStatus.SUSPENSO,
        suspended_at: new Date(),
      },
    });

    const updated = await client.estoqueMedicamento.findUnique({
      where: { id: estoque_id },
    });
    return {
      message: 'Medicamento suspenso com sucesso',
      data: updated,
    };
  }

  async resumeIndividualMedicine(
    estoque_id: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = db(transaction);
    await client.estoqueMedicamento.update({
      where: { id: estoque_id },
      data: {
        status: StockItemStatus.ATIVO,
        suspended_at: null,
      },
    });

    const updated = await client.estoqueMedicamento.findUnique({
      where: { id: estoque_id },
    });
    return {
      message: 'Medicamento retomado com sucesso',
      data: updated,
    };
  }

  async findInputStockById(
    id: number,
    transaction?: Prisma.TransactionClient,
  ): Promise<EstoqueInsumo | null> {
    return db(transaction).estoqueInsumo.findUnique({ where: { id } });
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
  ) {
    const client = db(transaction);
    if (tipo === ItemType.MEDICAMENTO) {
      const stock = await this.findMedicineStockById(estoqueId, transaction);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      const updateData: Prisma.EstoqueMedicamentoUpdateInput = {};

      if ('quantidade' in data) updateData.quantidade = data.quantidade;
      if ('armario_id' in data) updateData.armario_id = data.armario_id ?? null;
      if ('gaveta_id' in data) updateData.gaveta_id = data.gaveta_id ?? null;
      if ('validade' in data && data.validade !== undefined)
        updateData.validade = data.validade ?? undefined;
      if ('origem' in data && data.origem !== undefined && data.origem !== null)
        updateData.origem = data.origem;
      if ('setor' in data) updateData.setor = data.setor;
      if ('lote' in data) updateData.lote = data.lote ?? null;
      if ('casela_id' in data) updateData.casela_id = data.casela_id ?? null;
      if ('observacao' in data) updateData.observacao = data.observacao;
      if ('dias_para_repor' in data)
        updateData.dias_para_repor = data.dias_para_repor ?? null;
      if ('tipo' in data) updateData.tipo = data.tipo;

      if (updateData.armario_id != null && updateData.gaveta_id != null) {
        throw new Error(
          'Não é permitido preencher armário e gaveta ao mesmo tempo',
        );
      }

      const nextDias =
        'dias_para_repor' in data ? data.dias_para_repor : undefined;
      if (nextDias != null && nextDias < 0) {
        throw new Error('Dias para repor não pode ser negativo');
      }

      if (
        'quantidade' in data &&
        data.quantidade != null &&
        data.quantidade < 1
      ) {
        throw new Error('A quantidade não pode ser menor que 1');
      }

      const nextCasela = 'casela_id' in data ? data.casela_id : stock.casela_id;
      const nextTipo = 'tipo' in data ? data.tipo : stock.tipo;
      if (nextCasela != null && nextTipo !== OperationType.INDIVIDUAL) {
        throw new Error('A casela só pode ser preenchida para tipo individual');
      }

      if ('validade' in data && data.validade == null) {
        throw new Error('A data de validade é obrigatória');
      }

      if (
        'origem' in data &&
        data.origem != null &&
        String(data.origem).trim() === ''
      ) {
        throw new Error('A origem não pode ser vazia');
      }

      if (
        'setor' in data &&
        data.setor != null &&
        String(data.setor).trim() === ''
      ) {
        throw new Error('O setor não pode ser vazio');
      }

      if (
        'tipo' in data &&
        data.tipo != null &&
        String(data.tipo).trim() === ''
      ) {
        throw new Error('O tipo não pode ser vazio');
      }

      await client.estoqueMedicamento.update({
        where: { id: estoqueId },
        data: updateData,
      });
      const updated = await this.findMedicineStockById(estoqueId, transaction);
      return {
        message: 'Item de estoque atualizado com sucesso',
        data: updated,
      };
    } else {
      const stock = await this.findInputStockById(estoqueId, transaction);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      const updateData: Prisma.EstoqueInsumoUpdateInput = {};

      if ('quantidade' in data) updateData.quantidade = data.quantidade;
      if ('armario_id' in data) updateData.armario_id = data.armario_id ?? null;
      if ('gaveta_id' in data) updateData.gaveta_id = data.gaveta_id ?? null;
      if ('validade' in data && data.validade !== undefined)
        updateData.validade = data.validade ?? undefined;
      if ('setor' in data) updateData.setor = data.setor;
      if ('lote' in data) updateData.lote = data.lote ?? null;
      if ('casela_id' in data) updateData.casela_id = data.casela_id ?? null;
      if ('observacao' in data) updateData.observacao = data.observacao;
      if ('dias_para_repor' in data)
        updateData.dias_para_repor = data.dias_para_repor ?? null;
      if ('tipo' in data) updateData.tipo = data.tipo;

      if (updateData.armario_id != null && updateData.gaveta_id != null) {
        throw new Error(
          'Não é permitido preencher armário e gaveta ao mesmo tempo',
        );
      }

      const nextDiasInp =
        'dias_para_repor' in data ? data.dias_para_repor : undefined;
      if (nextDiasInp != null && nextDiasInp < 0) {
        throw new Error('Dias para repor não pode ser negativo');
      }

      if (
        'quantidade' in data &&
        data.quantidade != null &&
        data.quantidade < 1
      ) {
        throw new Error('A quantidade não pode ser menor que 1');
      }

      const nextCaselaInp =
        'casela_id' in data ? data.casela_id : stock.casela_id;
      const nextTipoInp = 'tipo' in data ? data.tipo : stock.tipo;
      if (nextCaselaInp != null && nextTipoInp !== OperationType.INDIVIDUAL) {
        throw new Error('A casela só pode ser preenchida para tipo individual');
      }

      if ('validade' in data && data.validade == null) {
        throw new Error('A data de validade é obrigatória');
      }

      if (
        'setor' in data &&
        data.setor != null &&
        String(data.setor).trim() === ''
      ) {
        throw new Error('O setor não pode ser vazio');
      }

      if (
        'tipo' in data &&
        data.tipo != null &&
        String(data.tipo).trim() === ''
      ) {
        throw new Error('O tipo não pode ser vazio');
      }

      await client.estoqueInsumo.update({
        where: { id: estoqueId },
        data: updateData,
      });
      const updated = await this.findInputStockById(estoqueId, transaction);
      return {
        message: 'Item de estoque atualizado com sucesso',
        data: updated,
      };
    }
  }

  async deleteStockItem(
    estoqueId: number,
    tipo: ItemType,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = db(transaction);
    if (tipo === ItemType.MEDICAMENTO) {
      const stock = await this.findMedicineStockById(estoqueId, transaction);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      const deleted = { ...stock } as unknown as Record<string, unknown>;
      await client.estoqueMedicamento.delete({ where: { id: estoqueId } });
      return {
        message: 'Item de estoque removido com sucesso',
        data: deleted,
      };
    } else {
      const stock = await this.findInputStockById(estoqueId, transaction);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      const deleted = { ...stock } as unknown as Record<string, unknown>;
      await client.estoqueInsumo.delete({ where: { id: estoqueId } });
      return {
        message: 'Item de estoque removido com sucesso',
        data: deleted,
      };
    }
  }

  async suspendIndividualInput(
    estoque_id: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = db(transaction);
    await client.estoqueInsumo.update({
      where: { id: estoque_id },
      data: {
        status: StockItemStatus.SUSPENSO,
        suspended_at: new Date(),
      },
    });

    const updated = await client.estoqueInsumo.findUnique({
      where: { id: estoque_id },
    });
    return {
      message: 'Insumo suspenso com sucesso',
      data: updated,
    };
  }

  async resumeIndividualInput(
    estoque_id: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = db(transaction);
    await client.estoqueInsumo.update({
      where: { id: estoque_id },
      data: {
        status: StockItemStatus.ATIVO,
        suspended_at: null,
      },
    });

    const updated = await client.estoqueInsumo.findUnique({
      where: { id: estoque_id },
    });
    return {
      message: 'Insumo retomado com sucesso',
      data: updated,
    };
  }

  async transferMedicineSector(
    estoqueId: number,
    setor: 'farmacia' | 'enfermagem',
    quantidade: number,
    bypassCasela: boolean,
    casela_id: number,
    observacao?: string | null,
    dias_para_repor?: number | null,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = db(transaction);
    const stock = await client.estoqueMedicamento.findUnique({
      where: { id: estoqueId },
    });

    if (!stock) {
      throw new Error('Estoque não encontrado');
    }

    if (!casela_id && !bypassCasela) {
      throw new Error('Casela é obrigatória para transferência de setor');
    }

    if (!quantidade || quantidade <= 0) {
      throw new Error('Quantidade inválida, deve ser um valor positivo');
    }

    if (quantidade > stock.quantidade) {
      throw new Error(`Quantidade não pode ser maior que ${stock.quantidade}`);
    }

    if (stock.quantidade === 0) {
      throw new Error('Não há estoque disponível para transferir');
    }

    if (!stock.origem) {
      throw new Error('Origem é obrigatória para medicamentos');
    }

    if (!casela_id && dias_para_repor != null) {
      throw new Error(
        'Dias para reposição só pode ser definido para estoque individual',
      );
    }

    if (dias_para_repor && (isNaN(dias_para_repor) || dias_para_repor < 0)) {
      throw new Error('Dias para repor deve ser um número positivo ou zero');
    }

    const finalCaselaId = bypassCasela ? null : casela_id;
    const finalDetails = bypassCasela
      ? 'para uso geral'
      : (observacao ?? stock.observacao);
    const finalStockType = bypassCasela
      ? OperationType.GERAL
      : OperationType.INDIVIDUAL;

    const existing = await client.estoqueMedicamento.findFirst({
      where: {
        medicamento_id: stock.medicamento_id,
        casela_id: finalCaselaId,
        validade: stock.validade,
        setor,
        lote: stock.lote ?? null,
        tipo: finalStockType,
      },
    });

    if (existing) {
      await client.estoqueMedicamento.update({
        where: { id: existing.id },
        data: {
          quantidade: existing.quantidade + quantidade,
          observacao:
            observacao != null
              ? observacao
              : (existing.observacao ?? undefined),
          dias_para_repor:
            dias_para_repor != null
              ? dias_para_repor
              : (existing.dias_para_repor ?? undefined),
          ultima_reposicao: getTodayAtNoonBrazil(),
        },
      });
    } else {
      const stockTenantId = stock.tenant_id;
      if (stockTenantId == null) {
        throw new Error('Tenant não identificado no registro de estoque');
      }
      await client.estoqueMedicamento.create({
        data: {
          tenant_id: stockTenantId,
          medicamento_id: stock.medicamento_id,
          casela_id: finalCaselaId,
          armario_id: stock.armario_id,
          gaveta_id: stock.gaveta_id,
          validade: stock.validade,
          quantidade,
          origem: stock.origem,
          tipo: finalStockType,
          setor,
          lote: stock.lote,
          status: stock.status,
          observacao: finalDetails ?? undefined,
          dias_para_repor: dias_para_repor ?? null,
          ultima_reposicao: getTodayAtNoonBrazil(),
        },
      });
    }

    const updatedSource = await client.estoqueMedicamento.update({
      where: { id: stock.id },
      data: { quantidade: stock.quantidade - quantidade },
    });

    const target = existing
      ? await client.estoqueMedicamento.findUnique({
          where: { id: existing.id },
        })
      : await client.estoqueMedicamento.findFirst({
          where: {
            medicamento_id: stock.medicamento_id,
            casela_id: finalCaselaId,
            validade: stock.validade,
            setor,
            lote: stock.lote ?? null,
            tipo: finalStockType,
          },
        });
    return {
      message: 'Medicamento transferido de setor com sucesso',
      data: {
        source: updatedSource,
        target: target,
      },
    };
  }

  async transferInputSector(
    estoqueId: number,
    setor: 'farmacia' | 'enfermagem',
    quantidade: number,
    casela_id?: number | null,
    destino?: string | null,
    observacao?: string | null,
    dias_para_repor?: number | null,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = db(transaction);
    const stock = await client.estoqueInsumo.findUnique({
      where: { id: estoqueId },
    });

    if (!stock) {
      throw new Error('Estoque não encontrado');
    }

    const hasDestino = destino != null && destino.trim() !== '';

    if (hasDestino && casela_id) {
      throw new Error('Destino e casela não podem ser informados juntos');
    }

    if (!quantidade || quantidade <= 0) {
      throw new Error('Quantidade inválida, deve ser um valor positivo');
    }

    if (stock.quantidade === 0) {
      throw new Error('Não há estoque disponível para transferir');
    }

    if (quantidade > stock.quantidade) {
      throw new Error(`Quantidade não pode ser maior que ${stock.quantidade}`);
    }

    if (!casela_id && dias_para_repor != null) {
      throw new Error(
        'Dias para reposição só pode ser definido para estoque individual',
      );
    }

    if (dias_para_repor && (isNaN(dias_para_repor) || dias_para_repor < 0)) {
      throw new Error('Dias para repor deve ser um número positivo ou zero');
    }

    const finalTipo = hasDestino
      ? OperationType.GERAL
      : OperationType.INDIVIDUAL;

    const existing = await client.estoqueInsumo.findFirst({
      where: {
        insumo_id: stock.insumo_id,
        casela_id: casela_id ?? null,
        validade: stock.validade,
        setor,
        lote: stock.lote ?? null,
        tipo: finalTipo,
        destino: hasDestino ? destino : null,
      },
    });

    if (existing) {
      await client.estoqueInsumo.update({
        where: { id: existing.id },
        data: {
          quantidade: existing.quantidade + quantidade,
          observacao:
            observacao != null
              ? observacao
              : (existing.observacao ?? undefined),
          dias_para_repor:
            dias_para_repor != null
              ? dias_para_repor
              : (existing.dias_para_repor ?? undefined),
          ultima_reposicao: getTodayAtNoonBrazil(),
        },
      });
    } else {
      const stockTenantId = stock.tenant_id;
      if (stockTenantId == null) {
        throw new Error('Tenant não identificado no registro de estoque');
      }
      await client.estoqueInsumo.create({
        data: {
          tenant_id: stockTenantId,
          insumo_id: stock.insumo_id,
          casela_id: casela_id ?? null,
          armario_id: stock.armario_id,
          gaveta_id: stock.gaveta_id,
          validade: stock.validade,
          quantidade,
          tipo: finalTipo,
          setor,
          lote: stock.lote,
          status: stock.status,
          destino: hasDestino ? destino : null,
          observacao: observacao ?? stock.observacao ?? undefined,
          dias_para_repor: dias_para_repor ?? null,
          ultima_reposicao: getTodayAtNoonBrazil(),
        },
      });
    }

    const updatedSource = await client.estoqueInsumo.update({
      where: { id: stock.id },
      data: { quantidade: stock.quantidade - quantidade },
    });

    const target = existing
      ? await client.estoqueInsumo.findUnique({ where: { id: existing.id } })
      : await client.estoqueInsumo.findFirst({
          where: {
            insumo_id: stock.insumo_id,
            casela_id: casela_id ?? null,
            validade: stock.validade,
            setor,
            lote: stock.lote ?? null,
            tipo: finalTipo,
            destino: hasDestino ? destino : null,
          },
        });
    return {
      message: 'Insumo transferido de setor com sucesso',
      data: {
        source: updatedSource,
        target: target,
      },
    };
  }

  async getExpiringItems(
    days: number,
    page: number = 1,
    limit: number = 50,
    transaction?: Prisma.TransactionClient,
  ): Promise<{ data: ExpiringStockItem[]; total: number; hasNext: boolean }> {
    const client = db(transaction);
    const today = startOfDay(new Date());
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + Math.min(365, Math.max(1, days)));

    const [medRows, inpRows] = await Promise.all([
      client.estoqueMedicamento.findMany({
        where: {
          quantidade: { gt: 0 },
          validade: { gte: today, lte: endDate },
        },
        orderBy: { validade: 'asc' },
        take: 500,
      }),
      client.estoqueInsumo.findMany({
        where: {
          quantidade: { gt: 0 },
          validade: { gte: today, lte: endDate },
        },
        orderBy: { validade: 'asc' },
        take: 500,
      }),
    ]);

    const medIds = [...new Set(medRows.map(r => r.medicamento_id))];
    const insIds = [...new Set(inpRows.map(r => r.insumo_id))];
    const medDetails = await client.medicamento.findMany({
      where: { id: { in: medIds } },
    });
    const insDetails = await client.insumo.findMany({
      where: { id: { in: insIds } },
    });
    const medMap = new Map(medDetails.map(m => [m.id, m]));
    const insMap = new Map(insDetails.map(i => [i.id, i]));

    const allCaselaPairs = [
      ...medRows
        .filter(s => s.casela_id != null)
        .map(s => ({
          tenant_id: s.tenant_id,
          num_casela: s.casela_id as number,
        })),
      ...inpRows
        .filter(s => s.casela_id != null)
        .map(s => ({
          tenant_id: s.tenant_id,
          num_casela: s.casela_id as number,
        })),
    ];
    const resKey = (t: number, c: number) => `${t}:${c}`;
    const uniqPairs = [
      ...new Map(
        allCaselaPairs.map(p => [resKey(p.tenant_id, p.num_casela), p]),
      ).values(),
    ];
    const residents =
      uniqPairs.length === 0
        ? []
        : await client.residente.findMany({
            where: {
              OR: uniqPairs.map(p => ({
                tenant_id: p.tenant_id,
                num_casela: p.num_casela,
              })),
            },
          });
    const resMap = new Map(
      residents.map(r => [resKey(r.tenant_id, r.num_casela), r]),
    );

    const toItem = (plain: EstoqueMedicamento): ExpiringStockItem => {
      const medicine = medMap.get(plain.medicamento_id);
      const validade = plain.validade ? new Date(plain.validade) : null;
      const dias = validade
        ? Math.ceil((validade.getTime() - today.getTime()) / 86400000)
        : 0;
      const resident =
        plain.casela_id != null
          ? resMap.get(resKey(plain.tenant_id, plain.casela_id))
          : undefined;
      return {
        tipo_item: 'medicamento',
        item_id: plain.medicamento_id,
        estoque_id: plain.id,
        nome: medicine?.nome ?? '-',
        principio_ativo: medicine?.principio_ativo ?? null,
        dosagem: medicine?.dosagem ?? null,
        unidade_medida: medicine?.unidade_medida ?? null,
        descricao: null,
        validade: validade ? formatDateToPtBr(validade) : null,
        quantidade: plain.quantidade,
        lote: plain.lote ?? null,
        setor: plain.setor ?? null,
        paciente: resident?.nome ?? null,
        dias_para_vencer: dias,
      };
    };

    const toItemInp = (plain: EstoqueInsumo): ExpiringStockItem => {
      const input = insMap.get(plain.insumo_id);
      const validade = plain.validade ? new Date(plain.validade) : null;
      const dias = validade
        ? Math.ceil((validade.getTime() - today.getTime()) / 86400000)
        : 0;
      const resident =
        plain.casela_id != null
          ? resMap.get(resKey(plain.tenant_id, plain.casela_id))
          : undefined;
      return {
        tipo_item: 'insumo',
        item_id: plain.insumo_id,
        estoque_id: plain.id,
        nome: input?.nome ?? '-',
        principio_ativo: null,
        descricao: input?.descricao ?? null,
        validade: validade ? formatDateToPtBr(validade) : null,
        quantidade: plain.quantidade,
        lote: plain.lote ?? null,
        setor: plain.setor ?? null,
        paciente: resident?.nome ?? null,
        dias_para_vencer: dias,
      };
    };

    const all = [
      ...medRows.map(r => toItem(r)),
      ...inpRows.map(r => toItemInp(r)),
    ].sort((a, b) => (a.dias_para_vencer ?? 0) - (b.dias_para_vencer ?? 0));

    const total = all.length;
    const start = (page - 1) * limit;
    const data = all.slice(start, start + limit);

    return {
      data,
      total,
      hasNext: start + data.length < total,
    };
  }

  private async countRaw(client: PrismaTx, sql: Prisma.Sql): Promise<number> {
    const rows = await client.$queryRaw<[{ count: bigint }]>(sql);
    return Number(rows[0]?.count ?? 0);
  }

  async getAlertCounts(
    transaction?: Prisma.TransactionClient,
    expiringDays: number = 45,
  ): Promise<{
    noStock: number;
    belowMin: number;
    nearMin: number;
    expired: number;
    expiringSoon: number;
  }> {
    const client = db(transaction);
    const safeDays = Math.min(365, Math.max(1, expiringDays));

    const [
      noStockMed,
      noStockInp,
      belowMinMed,
      belowMinInp,
      nearMinMed,
      nearMinInp,
      expiredMed,
      expiredInp,
      expiringMed,
      expiringInp,
    ] = await Promise.all([
      client.estoqueMedicamento.count({ where: { quantidade: 0 } }),
      client.estoqueInsumo.count({ where: { quantidade: 0 } }),
      this.countRaw(
        client,
        Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM estoque_medicamento em
        INNER JOIN medicamento m ON m.id = em.medicamento_id
        WHERE em.quantidade >= 0
          AND em.quantidade < m.estoque_minimo`,
      ),
      this.countRaw(
        client,
        Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM estoque_insumo ei
        INNER JOIN insumo i ON i.id = ei.insumo_id
        WHERE ei.quantidade >= 0
          AND ei.quantidade < i.estoque_minimo`,
      ),
      this.countRaw(
        client,
        Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM estoque_medicamento em
        INNER JOIN medicamento m ON m.id = em.medicamento_id
        WHERE em.quantidade > m.estoque_minimo
          AND em.quantidade <= (m.estoque_minimo * 1.2)`,
      ),
      this.countRaw(
        client,
        Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM estoque_insumo ei
        INNER JOIN insumo i ON i.id = ei.insumo_id
        WHERE ei.quantidade > i.estoque_minimo
          AND ei.quantidade <= (i.estoque_minimo * 1.2)`,
      ),
      client.estoqueMedicamento.count({
        where: {
          quantidade: { gt: 0 },
          validade: { lt: new Date(new Date().toISOString().slice(0, 10)) },
        },
      }),
      client.estoqueInsumo.count({
        where: {
          quantidade: { gt: 0 },
          validade: { lt: new Date(new Date().toISOString().slice(0, 10)) },
        },
      }),
      this.countRaw(
        client,
        Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM estoque_medicamento em
        WHERE em.quantidade > 0
          AND em.validade >= CURRENT_DATE
          AND em.validade <= CURRENT_DATE + ${safeDays} * INTERVAL '1 day'`,
      ),
      this.countRaw(
        client,
        Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM estoque_insumo ei
        WHERE ei.quantidade > 0
          AND ei.validade >= CURRENT_DATE
          AND ei.validade <= CURRENT_DATE + ${safeDays} * INTERVAL '1 day'`,
      ),
    ]);

    return {
      noStock: noStockMed + noStockInp,
      belowMin: belowMinMed + belowMinInp,
      nearMin: nearMinMed + nearMinInp,
      expired: expiredMed + expiredInp,
      expiringSoon: expiringMed + expiringInp,
    };
  }
}
