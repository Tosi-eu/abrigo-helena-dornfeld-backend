import { MedicineStock, InputStock } from '../../../core/domain/estoque';
import MedicineStockModel from '../models/estoque-medicamento.model';
import InputStockModel from '../models/estoque-insumo.model';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../sequelize';
import {
  computeExpiryStatus,
  computeQuantityStatus,
} from '../../helpers/expiry-status';
import {
  ItemType,
  OperationType,
  QueryPaginationParams,
  StockProportion,
} from '../../../core/utils/utils';
import { formatDateToPtBr } from '../../helpers/date.helper';

export class StockRepository {
  async createMedicineStockIn(data: MedicineStock) {
    const existing = await MedicineStockModel.findOne({
      where: {
        medicamento_id: data.medicamento_id,
        armario_id: data.armario_id ?? null,
        gaveta_id: data.gaveta_id ?? null,
        validade: data.validade ?? null,
        tipo: data.tipo,
        casela_id: data.casela_id ?? null,
        origem: data.origem,
      },
    });

    if (existing) {
      existing.quantidade += data.quantidade;
      await existing.save();
      return { message: 'Quantidade somada ao estoque existente.' };
    }

    await MedicineStockModel.create({
      medicamento_id: data.medicamento_id,
      armario_id: data.armario_id ?? null,
      gaveta_id: data.gaveta_id ?? null,
      casela_id: data.casela_id ?? null,
      validade: data.validade,
      quantidade: data.quantidade,
      origem: data.origem,
      tipo: data.tipo,
    });

    return { message: 'Entrada de medicamento registrada.' };
  }

  async createInputStockIn(data: InputStock) {
    const existing = await InputStockModel.findOne({
      where: {
        insumo_id: data.insumo_id,
        armario_id: data.armario_id ?? null,
        gaveta_id: data.gaveta_id ?? null,
        validade: data.validade ?? null,
        tipo: data.tipo,
      },
    });

    if (existing) {
      existing.quantidade += data.quantidade;
      await existing.save();
      return { message: 'Quantidade somada ao estoque existente.' };
    }

    await InputStockModel.create({
      insumo_id: data.insumo_id,
      armario_id: data.armario_id ?? null,
      gaveta_id: data.gaveta_id ?? null,
      quantidade: data.quantidade,
      validade: data.validade,
      tipo: data.tipo,
    });

    return { message: 'Entrada de insumo registrada.' };
  }

  async createStockOut(
    estoqueId: number,
    tipoItem: ItemType,
    quantidade: number,
  ) {
    if (tipoItem === 'medicamento') {
      const register = await MedicineStockModel.findByPk(estoqueId);

      if (!register) {
        throw new Error('Registro de medicamento não encontrado.');
      }

      if (register.quantidade < quantidade) {
        throw new Error('Quantidade insuficiente.');
      }

      register.quantidade -= quantidade;
      await register.save();

      return { message: 'Saída de medicamento realizada.' };
    }

    const register = await InputStockModel.findByPk(estoqueId);

    if (!register) {
      throw new Error('Registro de insumo não encontrado.');
    }

    if (register.quantidade < quantidade) {
      throw new Error('Quantidade insuficiente.');
    }

    register.quantidade -= quantidade;
    await register.save();

    return { message: 'Saída de insumo realizada.' };
  }

  async listStockItems(params: QueryPaginationParams) {
    const { filter, type, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    let whereMedicamento = '';
    let whereInsumo = '';

    switch (filter) {
      case 'noStock':
        whereMedicamento = 'WHERE em.quantidade = 0';
        whereInsumo = 'WHERE ei.quantidade = 0';
        break;

      case 'belowMin':
        whereMedicamento = `
          WHERE em.quantidade > 0
            AND em.quantidade <= COALESCE(m.estoque_minimo, 0)
        `;
        whereInsumo = `
          WHERE ei.quantidade > 0
            AND ei.quantidade <= COALESCE(i.estoque_minimo, 0)
        `;
        break;

      case 'expired':
        whereMedicamento =
          'WHERE em.quantidade > 0 AND em.validade < CURRENT_DATE';
        whereInsumo = 'WHERE ei.quantidade > 0 AND ei.validade < CURRENT_DATE';
        break;

      case 'expiringSoon':
        whereMedicamento = `
          WHERE em.quantidade > 0
            AND em.validade BETWEEN CURRENT_DATE
            AND CURRENT_DATE + INTERVAL '45 days'
        `;
        whereInsumo = `
          WHERE ei.quantidade > 0
            AND ei.validade BETWEEN CURRENT_DATE
            AND CURRENT_DATE + INTERVAL '45 days'
        `;
        break;
    }

    let query = '';

    if (!type || type === 'medicamento') {
      query = `
        SELECT
          'medicamento' AS tipo_item,
          em.id AS estoque_id,
          m.id AS item_id,
          m.nome,
          m.principio_ativo,
          em.validade,
          em.quantidade,
          m.estoque_minimo AS minimo,
          em.origem,
          em.tipo,
          r.nome AS paciente,
          em.armario_id,
          em.casela_id,
          em.gaveta_id
        FROM estoque_medicamento em
        JOIN medicamento m ON m.id = em.medicamento_id
        LEFT JOIN residente r ON r.num_casela = em.casela_id
        ${whereMedicamento}
      `;
    }

    if (!type) {
      query += `
        UNION ALL
        SELECT
          'insumo' AS tipo_item,
          ei.id AS estoque_id,
          i.id AS item_id,
          i.nome,
          NULL AS principio_ativo,
          ei.validade,
          ei.quantidade,
          i.estoque_minimo AS minimo,
          NULL AS origem,
          ei.tipo,
          NULL AS paciente,
          ei.armario_id,
          NULL AS casela_id,
          ei.gaveta_id
        FROM estoque_insumo ei
        JOIN insumo i ON i.id = ei.insumo_id
        ${whereInsumo}
      `;
    }

    if (type === 'insumo') {
      query = `
        SELECT
          'insumo' AS tipo_item,
          ei.id AS estoque_id,
          i.id AS item_id,
          i.nome,
          ei.validade,
          ei.quantidade,
          i.estoque_minimo AS minimo,
          ei.armario_id,
          ei.gaveta_id
        FROM estoque_insumo ei
        JOIN insumo i ON i.id = ei.insumo_id
        ${whereInsumo}
      `;
    }

    query += ` ORDER BY nome ASC LIMIT ${limit} OFFSET ${offset}`;

    const results = await sequelize.query(query, {
      type: QueryTypes.SELECT,
    });

    const mapped = results.map((item: any) => {
      const expiryInfo = computeExpiryStatus(item.validade);
      const quantityInfo = computeQuantityStatus(item.quantidade, item.minimo);

      return {
        ...item,
        validade: formatDateToPtBr(item.validade),
        st_expiracao: expiryInfo.status,
        msg_expiracao: expiryInfo.message,
        st_quantidade: quantityInfo.status,
        msg_quantidade: quantityInfo.message,
      };
    });

    return {
      data: mapped,
      page,
      limit,
      hasNext: mapped.length === limit,
    };
  }

  async getStockProportion(): Promise<StockProportion> {
    return {
      total_medicamentos: await MedicineStockModel.sum('quantidade'),
      total_individuais: await MedicineStockModel.sum('quantidade', {
        where: { tipo: OperationType.INDIVIDUAL },
      }),
      total_gerais: await MedicineStockModel.sum('quantidade', {
        where: { tipo: OperationType.GERAL },
      }),
      total_carrinho_medicamentos: await MedicineStockModel.sum('quantidade', {
        where: { tipo: OperationType.CARRINHO },
      }),
      total_insumos: await InputStockModel.sum('quantidade', {
        where: { tipo: 'geral' },
      }),
      total_carrinho_insumos: await InputStockModel.sum('quantidade', {
        where: { tipo: OperationType.CARRINHO },
      }),
    };
  }
}
