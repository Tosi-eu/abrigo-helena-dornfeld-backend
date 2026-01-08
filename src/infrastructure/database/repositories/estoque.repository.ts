import { MedicineStock, InputStock } from '../../../core/domain/estoque';
import MedicineStockModel, { MedicineStockAttributes } from '../models/estoque-medicamento.model';
import InputStockModel, { InputStockAttributes } from '../models/estoque-insumo.model';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../sequelize';
import {
  computeExpiryStatus,
  computeQuantityStatus,
} from '../../helpers/expiry-status';
import {
  ItemType,
  MedicineStatus,
  OperationType,
  QueryPaginationParams,
} from '../../../core/utils/utils';
import { formatDateToPtBr } from '../../helpers/date.helper';
import { StockQueryResult } from '../../types/estoque.types';

export class StockRepository {
  async createMedicineStockIn(data: MedicineStock) {
    try {
      const existing = await MedicineStockModel.findOne({
        where: {
          medicamento_id: data.medicamento_id,
          armario_id: data.armario_id,
          gaveta_id: data.gaveta_id,
          validade: data.validade ?? null,
          tipo: data.tipo,
          casela_id: data.casela_id ?? null,
          origem: data.origem,
          lote: data.lote ?? null,
        },
      });

      if (existing) {
        existing.quantidade += data.quantidade;
        await existing.save();
        return { message: 'Quantidade somada ao estoque existente.' };
      }

      await MedicineStockModel.create({
        medicamento_id: data.medicamento_id,
        casela_id: data.casela_id ?? null,
        armario_id: data.armario_id,
        gaveta_id: data.gaveta_id,
        validade: data.validade,
        quantidade: data.quantidade,
        origem: data.origem,
        tipo: data.tipo,
        setor: data.setor,
        lote: data.lote ?? null,
      });

      return { message: 'Entrada de medicamento registrada.' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message);
    }
  }

  async createInputStockIn(data: InputStock) {
    const existing = await InputStockModel.findOne({
      where: {
        insumo_id: data.insumo_id,
        armario_id: data.armario_id,
        gaveta_id: data.gaveta_id,
        validade: data.validade ?? null,
        tipo: data.tipo,
        lote: data.lote ?? null,
      },
    });

    if (existing) {
      existing.quantidade += data.quantidade;
      await existing.save();
      return { message: 'Quantidade somada ao estoque existente.' };
    }

    await InputStockModel.create({
      insumo_id: data.insumo_id,
      armario_id: data.armario_id,
      gaveta_id: data.gaveta_id,
      quantidade: data.quantidade,
      validade: data.validade,
      tipo: data.tipo,
      setor: data.setor,
      lote: data.lote ?? null,
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

      if (!register) throw new Error('register de medicamento não encontrado.');

      if (register.quantidade < quantidade)
        throw new Error('Quantidade insuficiente.');

      if (register?.status === MedicineStatus.SUSPENSO) {
        throw new Error('Medicamento suspenso não pode ser movimentado');
      }

      register.quantidade -= quantidade;
      await register.save();
      return { message: 'Saída de medicamento realizada.' };
    } else {
      const register = await InputStockModel.findByPk(estoqueId);
      if (!register) throw new Error('register de insumo não encontrado.');
      if (register.quantidade < quantidade)
        throw new Error('Quantidade insuficiente.');
      register.quantidade -= quantidade;
      await register.save();
      return { message: 'Saída de insumo realizada.' };
    }
  }

  async listStockItems(params: QueryPaginationParams) {
    const { filter, type, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    let baseQuery = '';
    let whereMedicamento = '';
    let whereInsumo = '';

    if (filter) {
      switch (filter) {
        case 'noStock':
          whereMedicamento = 'WHERE em.quantidade = 0';
          whereInsumo = 'WHERE ei.quantidade = 0';
          break;
        case 'belowMin':
          whereMedicamento =
            'WHERE em.quantidade > 0 AND em.quantidade <= COALESCE(m.estoque_minimo,0)';
          whereInsumo =
            'WHERE ei.quantidade > 0 AND ei.quantidade <= COALESCE(i.estoque_minimo,0)';
          break;
        case 'expired':
          whereMedicamento =
            'WHERE em.quantidade > 0 AND em.validade < CURRENT_DATE';
          whereInsumo =
            'WHERE ei.quantidade > 0 AND ei.validade < CURRENT_DATE';
          break;
        case 'expiringSoon':
          whereMedicamento = `WHERE em.quantidade > 0 AND em.validade BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '45 days'`;
          whereInsumo = `WHERE ei.quantidade > 0 AND ei.validade BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '45 days'`;
          break;
      }
    }

    if (!type || type === 'medicamento') {
      const medicamentoQuery = `
      SELECT
        'medicamento' AS tipo_item,
        em.id AS estoque_id,
        m.id AS item_id,
        m.nome,
        m.principio_ativo,
        null AS descricao,
        em.validade,
        em.quantidade,
        m.estoque_minimo AS minimo,
        em.origem,
        em.tipo,
        r.nome AS paciente,
        em.armario_id,
        em.gaveta_id,
        em.casela_id,
        em.setor,
        em.status,
        em.suspended_at as suspenso_em,
        em.lote 
      FROM estoque_medicamento em
      JOIN medicamento m ON m.id = em.medicamento_id
      LEFT JOIN residente r ON r.num_casela = em.casela_id
      ${whereMedicamento}
    `;

      if (!type) {
        const insumoQuery = `
        SELECT
          'insumo' AS tipo_item,
          ei.id AS estoque_id,
          i.id AS item_id,
          i.nome,
          null AS principio_ativo,
          i.descricao AS descricao,
          ei.validade,
          ei.quantidade,
          i.estoque_minimo AS minimo,
          null AS origem,
          ei.tipo,
          null AS paciente,
          ei.armario_id,
          ei.gaveta_id,
          null AS casela_id,
          ei.setor,
          null as status,
          null as suspenso_em,
          ei.lote
        FROM estoque_insumo ei
        JOIN insumo i ON i.id = ei.insumo_id
        ${whereInsumo}
      `;

        baseQuery = `${medicamentoQuery} UNION ALL ${insumoQuery}`;
      } else {
        baseQuery = medicamentoQuery;
      }
    } else if (type === 'insumo') {
      baseQuery = `
      SELECT
        'insumo' AS tipo_item,
        ei.id AS estoque_id,
        i.id AS item_id,
        i.nome,
        ei.validade,
        ei.quantidade,
        i.estoque_minimo AS minimo,
        ei.armario_id,
        ei.tipo
      FROM estoque_insumo ei
      JOIN insumo i ON i.id = ei.insumo_id
      ${whereInsumo}
    `;
    } else if (type === 'armarios') {
      baseQuery = `
      SELECT 
        a.num_armario AS armario_id,
        COALESCE((SELECT SUM(em.quantidade) FROM estoque_medicamento em WHERE em.armario_id = a.num_armario), 0) AS total_medicamentos,
        COALESCE((SELECT SUM(ei.quantidade) FROM estoque_insumo ei WHERE ei.armario_id = a.num_armario), 0) AS total_insumos,
        COALESCE((SELECT SUM(em.quantidade) FROM estoque_medicamento em WHERE em.armario_id = a.num_armario),0)
        + COALESCE((SELECT SUM(ei.quantidade) FROM estoque_insumo ei WHERE ei.armario_id = a.num_armario),0) AS total_geral
      FROM armario a
      ORDER BY a.num_armario
    `;
    } else if (type === 'gavetas') {
      baseQuery = `
      SELECT 
        g.num_gaveta AS gaveta_id,
        COALESCE((SELECT SUM(em.quantidade) FROM estoque_medicamento em WHERE em.gaveta_id = g.num_gaveta), 0) AS total_medicamentos,
        COALESCE((SELECT SUM(ei.quantidade) FROM estoque_insumo ei WHERE ei.gaveta_id = g.num_gaveta), 0) AS total_insumos,
        COALESCE((SELECT SUM(em.quantidade) FROM estoque_medicamento em WHERE em.gaveta_id = g.num_gaveta),0)
        + COALESCE((SELECT SUM(ei.quantidade) FROM estoque_insumo ei WHERE ei.gaveta_id = g.num_gaveta),0) AS total_geral
      FROM gaveta g
      ORDER BY g.num_gaveta
    `;
    } else {
      throw new Error(
        'Tipo inválido. Use medicamento, insumo, armarios, gavetas ou deixe vazio.',
      );
    }

    if (type !== 'armarios' && type !== 'gavetas') {
      baseQuery += ` ORDER BY nome ASC LIMIT ${limit} OFFSET ${offset}`;
    }

    const results = await sequelize.query(baseQuery, {
      type: QueryTypes.SELECT,
    });
    const total = results.length;

    const mapped = (results as StockQueryResult[]).map((item: StockQueryResult) => {
      const isStorageType = type === 'armarios' || type === 'gavetas';

      let expiryInfo: { status: string | null; message: string | null } = {
        status: null,
        message: null,
      };
      let quantityInfo: { status: string | null; message: string | null } = {
        status: null,
        message: null,
      };

      if (!isStorageType && item.validade) {
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

  async getStockProportionBySector(setor: 'farmacia' | 'enfermagem'): Promise<{
    medicamentos_geral: number;
    medicamentos_individual: number;
    insumos: number;
    carrinho_medicamentos: number;
    carrinho_insumos: number;
  }> {
    if (setor === 'farmacia') {
      const medicamentosGeral = await MedicineStockModel.sum('quantidade', {
        where: {
          tipo: OperationType.GERAL,
          setor: 'farmacia',
        },
      });

      const medicamentosIndividual = await MedicineStockModel.sum(
        'quantidade',
        {
          where: {
            tipo: OperationType.INDIVIDUAL,
            setor: 'farmacia',
          },
        },
      );

      const insumos = await InputStockModel.sum('quantidade', {
        where: {
          tipo: OperationType.GERAL,
          setor: 'farmacia',
        },
      });

      return {
        medicamentos_geral: Number(medicamentosGeral || 0),
        medicamentos_individual: Number(medicamentosIndividual || 0),
        insumos: Number(insumos || 0),
        carrinho_medicamentos: 0,
        carrinho_insumos: 0,
      };
    }

    const carrinhoMedicamentos = await MedicineStockModel.sum('quantidade', {
      where: {
        tipo: OperationType.CARRINHO,
        setor: 'enfermagem',
      },
    });

    const medicamentosIndividual = await MedicineStockModel.sum('quantidade', {
      where: {
        tipo: OperationType.INDIVIDUAL,
        setor: 'enfermagem',
      },
    });

    const carrinhoInsumos = await InputStockModel.sum('quantidade', {
      where: {
        tipo: OperationType.CARRINHO,
        setor: 'enfermagem',
      },
    });

    return {
      medicamentos_geral: 0,
      medicamentos_individual: Number(medicamentosIndividual || 0),
      insumos: 0,
      carrinho_medicamentos: Number(carrinhoMedicamentos || 0),
      carrinho_insumos: Number(carrinhoInsumos || 0),
    };
  }

  async findMedicineStockById(id: number) {
    return MedicineStockModel.findByPk(id);
  }

  async removeIndividualMedicine(estoqueId: number) {
    await MedicineStockModel.update(
      {
        casela_id: null,
        tipo: 'geral',
      },
      {
        where: { id: estoqueId },
      },
    );

    return {
      message: 'Medicamento removido do estoque individual',
    };
  }

  async suspendIndividualMedicine(estoque_id: number) {
    await MedicineStockModel.update(
      {
        status: MedicineStatus.SUSPENSO,
        suspended_at: new Date(),
      },
      {
        where: { id: estoque_id },
      },
    );

    return {
      message: 'Medicamento suspenso com sucesso',
    };
  }

  async resumeIndividualMedicine(estoque_id: number) {
    await MedicineStockModel.update(
      {
        status: MedicineStatus.ATIVO,
        suspended_at: null,
      },
      {
        where: { id: estoque_id },
      },
    );

    return {
      message: 'Medicamento retomado com sucesso',
    };
  }

  async transferMedicineSector(
    estoqueId: number,
    setor: 'farmacia' | 'enfermagem',
  ) {
    await MedicineStockModel.update({ setor }, { where: { id: estoqueId } });

    return {
      message: 'Medicamento transferido de setor com sucesso',
    };
  }

  async findInputStockById(id: number) {
    return InputStockModel.findByPk(id);
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
    },
  ) {
    if (tipo === ItemType.MEDICAMENTO) {
      const stock = await this.findMedicineStockById(estoqueId);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      const updateData: Partial<MedicineStockAttributes> = {};

      if ('quantidade' in data) updateData.quantidade = data.quantidade;
      if ('armario_id' in data) updateData.armario_id = data.armario_id ?? null;
      if ('gaveta_id' in data) updateData.gaveta_id = data.gaveta_id ?? null;
      if ('validade' in data) updateData.validade = data.validade;
      if ('origem' in data) updateData.origem = data.origem;
      if ('setor' in data) updateData.setor = data.setor;
      if ('lote' in data) updateData.lote = data.lote ?? null;
      if ('casela_id' in data) updateData.casela_id = data.casela_id ?? null;
      if (data.tipo) updateData.tipo = data.tipo;      

      if (updateData.armario_id != null && updateData.gaveta_id != null) {
        throw new Error('Não é permitido preencher armário e gaveta ao mesmo tempo');
      }    
      
      if (updateData.validade != null && updateData.validade < new Date()) {
        throw new Error('A data de validade não pode ser anterior à data atual');
      }

      if(updateData.quantidade != null && updateData.quantidade < 1) {
        throw new Error('A quantidade não pode ser menor que 0');
      }

      if(updateData.casela_id != null && updateData.tipo !== OperationType.INDIVIDUAL) {
        throw new Error('A casela só pode ser preenchida para tipo individual');
      }

      if(updateData.validade == null) {
        throw new Error('A data de validade é obrigatória');
      }

      if(updateData.origem != null && updateData.origem.trim() === '') {
        throw new Error('A origem não pode ser vazia');
      }

      if(updateData.setor != null && updateData.setor.trim() === '') {
        throw new Error('O setor não pode ser vazio');
      }

      if(updateData.tipo != null && updateData.tipo.trim() === '') {
        throw new Error('O tipo não pode ser vazio');
      }   

      await MedicineStockModel.update(updateData, { where: { id: estoqueId } });
    } else {
      const stock = await this.findInputStockById(estoqueId);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      const updateData: Partial<InputStockAttributes> = {};
      
      if (data.quantidade != null) updateData.quantidade = data.quantidade;
      if (data.armario_id != null) updateData.armario_id = data.armario_id;
      if (data.gaveta_id != null) updateData.gaveta_id = data.gaveta_id;
      if (data.validade != null) updateData.validade = data.validade as Date;
      if (data.setor != null) updateData.setor = data.setor;
      if (data.lote != null) updateData.lote = data.lote;
      if (data.tipo != null && data.tipo !== "") {
        updateData.tipo = data.tipo;
      }

      await InputStockModel.update(updateData, { where: { id: estoqueId } });
    }

    return {
      message: 'Item de estoque atualizado com sucesso',
    };
  }

  async deleteStockItem(estoqueId: number, tipo: ItemType) {
    if (tipo === ItemType.MEDICAMENTO) {
      const stock = await this.findMedicineStockById(estoqueId);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      await MedicineStockModel.destroy({ where: { id: estoqueId } });
    } else {
      const stock = await this.findInputStockById(estoqueId);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      await InputStockModel.destroy({ where: { id: estoqueId } });
    }

    return {
      message: 'Item de estoque removido com sucesso',
    };
  }
}
