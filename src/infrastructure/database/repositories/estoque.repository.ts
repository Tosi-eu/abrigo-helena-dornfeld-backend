import { MedicineStock, InputStock } from "../../../core/domain/estoque";
import MedicineStockModel from "../models/estoque-medicamento.model";
import InputStockModel from "../models/estoque-insumo.model";
import { QueryTypes } from "sequelize";
import { sequelize } from "../sequelize";
import { computeExpiryStatus, computeQuantityStatus } from "../../helpers/expiry-status";
import { ItemType, NonMovementedItem, OperationType, QueryPaginationParams, StockProportion } from "../../../core/utils/utils";

  export class StockRepository {
    async createMedicineStockIn(data: MedicineStock) {
    try {
      await MedicineStockModel.create({
        medicamento_id: data.medicamento_id,
        casela_id: data.casela_id ?? null,
        armario_id: data.armario_id,
        validade: data.validade ?? null,
        quantidade: data.quantidade,
        origem: data.origem ?? null,
        tipo: data.tipo ?? null,
      }); 

      return { message: "Entrada de medicamento registrada." };
    } catch (error: any) {
      throw new Error(error);
    }
  }

    async createInputStockIn(data: InputStock) {
      await InputStockModel.create({
        insumo_id: data.insumo_id,
        armario_id: data.armario_id,
        quantidade: data.quantidade,
        validade: data.validade,
        tipo: data.tipo
      });

      return { message: "Entrada de insumo registrada." };
    }

  async createStockOut(estoqueId: number, tipoItem: ItemType, quantidade: number) {
    if (tipoItem === "medicamento") {
      const register = await MedicineStockModel.findByPk(estoqueId);
      if (!register) throw new Error("register de medicamento não encontrado.");
      if (register.quantidade < quantidade) throw new Error("Quantidade insuficiente.");
      register.quantidade -= quantidade;
      await register.save();
      return { message: "Saída de medicamento realizada." };
    } else {
      const register = await InputStockModel.findByPk(estoqueId);
      if (!register) throw new Error("register de insumo não encontrado.");
      if (register.quantidade < quantidade) throw new Error("Quantidade insuficiente.");
      register.quantidade -= quantidade;
      await register.save();
      return { message: "Saída de insumo realizada." };
    }
  }

  async listStockItems(params: QueryPaginationParams) {
    const { filter, type, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    let baseQuery = "";

    if (!type) {
      let medicamentoQuery = `
        SELECT 
          'medicamento' AS tipo_item,
          em.id as estoque_id,
          m.id AS item_id,
          m.nome,
          m.principio_ativo,
          MIN(em.validade) AS validade,
          SUM(em.quantidade) AS quantidade,
          m.estoque_minimo AS minimo,
          em.origem,
          em.tipo as tipo,
          r.nome AS paciente,
          em.armario_id,
          em.casela_id
        FROM estoque_medicamento em
        JOIN medicamento m ON m.id = em.medicamento_id
        LEFT JOIN residente r ON r.num_casela = em.casela_id
        GROUP BY em.id, m.id, m.nome, m.principio_ativo, m.estoque_minimo, 
                em.origem, em.tipo, r.nome, em.armario_id, em.casela_id
      `;

      let insumoQuery = `
        SELECT 
          'insumo' as tipo_item,
          ei.id as estoque_id,
          i.id AS item_id,
          i.nome,
          i.descricao as descricao,
          ei.validade AS validade,
          SUM(ei.quantidade) AS quantidade,
          i.estoque_minimo AS minimo,
          NULL AS origem,
          ei.tipo AS tipo,
          NULL AS paciente,
          ei.armario_id,
          NULL AS casela_id
        FROM estoque_insumo ei
        JOIN insumo i ON i.id = ei.insumo_id
        GROUP BY ei.id, i.id, i.nome, ei.armario_id
      `;

      if (filter === "noStock") {
        insumoQuery += " HAVING SUM(ei.quantidade) = 0";
      }

      if (["noStock", "belowMin", "expired", "expiringSoon"].includes(filter)) {
        switch (filter) {
          case "noStock":
            medicamentoQuery += " HAVING SUM(em.quantidade) = 0";
            break;
        case "belowMin":
          medicamentoQuery += `
            HAVING SUM(em.quantidade) >= COALESCE(m.estoque_minimo, 0)
              AND SUM(em.quantidade) <= COALESCE(m.estoque_minimo, 0) * 1.35
          `;
          break;
          case "expired":
            medicamentoQuery += " HAVING MIN(em.validade) < CURRENT_DATE";
            break;
          case "expiringSoon":
            medicamentoQuery += `
              HAVING SUM(em.quantidade) > 0
              AND MIN(em.validade) IS NOT NULL
              AND MIN(em.validade) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '45 days'
            `;
            break;
        }
      }

      const medicineFilters = ["expired", "expiringSoon", "belowMin"];
      medicineFilters.includes(filter) ? baseQuery = medicamentoQuery : baseQuery = `${medicamentoQuery} UNION ALL ${insumoQuery}`;

    } 
    else if (type === "medicamento") {
      baseQuery = `
        SELECT 
         'medicamento' AS tipo_item,
          em.id as estoque_id,
          m.id AS item_id,
          m.nome,
          m.principio_ativo,
          MIN(em.validade) AS validade,
          SUM(em.quantidade) AS quantidade,
          m.estoque_minimo AS minimo,
          em.origem,
          em.tipo,
          r.nome AS paciente,
          em.armario_id,
          em.casela_id
        FROM estoque_medicamento em
        JOIN medicamento m ON m.id = em.medicamento_id
        LEFT JOIN residente r ON r.num_casela = em.casela_id
        GROUP BY em.id, m.id, m.nome, m.principio_ativo, m.estoque_minimo, 
                em.origem, em.tipo, r.nome, em.armario_id, em.casela_id
      `;
      switch (filter) {
        case "noStock":
          baseQuery += " HAVING SUM(em.quantidade) = 0";
          break;
        case "belowMin":
          baseQuery += `
            HAVING SUM(em.quantidade) > 0
            AND SUM(em.quantidade) <= COALESCE(m.estoque_minimo,0)
          `;
          break;
        case "expired":
          baseQuery += " HAVING MIN(em.validade) < CURRENT_DATE";
          break;
        case "expiringSoon":
          baseQuery += `
            HAVING SUM(em.quantidade) > 0
            AND MIN(em.validade) IS NOT NULL
            AND MIN(em.validade) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
          `;
          break;
      }
    } 
    else if (type === "insumo") {
      baseQuery = `
        SELECT 
          'insumo' AS tipo_item,
          ei.id as estoque_id,
          i.id AS item_id,
          i.nome,
          SUM(ei.quantidade) AS quantidade,
          ei.armario_id
        FROM estoque_insumo ei
        JOIN insumo i ON i.id = ei.insumo_id
        GROUP BY ei.id, i.id, i.nome, ei.armario_id
      `;
      if (filter === "noStock") {
        baseQuery += " HAVING SUM(ei.quantidade) = 0";
      }
    } 
    else if (type === "armarios") {
      baseQuery = `
        SELECT 
          a.num_armario AS armario_id,

          COALESCE((
            SELECT SUM(em.quantidade)
            FROM estoque_medicamento em
            WHERE em.armario_id = a.num_armario
          ), 0) AS total_medicamentos,

          COALESCE((
            SELECT SUM(ei.quantidade)
            FROM estoque_insumo ei
            WHERE ei.armario_id = a.num_armario
          ), 0) AS total_insumos,

          COALESCE((
            SELECT SUM(em.quantidade)
            FROM estoque_medicamento em
            WHERE em.armario_id = a.num_armario
          ), 0)
          +
          COALESCE((
            SELECT SUM(ei.quantidade)
            FROM estoque_insumo ei
            WHERE ei.armario_id = a.num_armario
          ), 0) AS total_geral

        FROM armario a
        ORDER BY a.num_armario
      `;
    }
    else {
      throw new Error("Tipo inválido. Use medicamento, insumo, armarios ou deixe vazio.");
    }

    if (type !== "armarios") {
      baseQuery += ` ORDER BY nome ASC LIMIT ${limit} OFFSET ${offset}`;
    }

    const results = await sequelize.query(baseQuery, { type: QueryTypes.SELECT });

    let countQuery = baseQuery;

    countQuery = countQuery.replace(/ORDER BY [\s\S]*?LIMIT.*OFFSET.*/i, "");

    const countResults = await sequelize.query(countQuery, { type: QueryTypes.SELECT });
    const total = countResults.length;

    const mapped = results.map((item: any) => {
      const isCabinetType = type === "armarios";

      let expiryInfo: {status: string | null, message: string | null } = { status: null, message: null };
      let quantityInfo: {status: string | null, message: string | null } = { status: null, message: null };

      if (!isCabinetType) {
        expiryInfo = computeExpiryStatus(item.validade);
        quantityInfo = computeQuantityStatus(item.quantidade, item.minimo);
      }

      item.validade = item.validade
        ? new Date(item.validade).toLocaleDateString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })
        : null;

      return {
        ...item,
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

  async getStockProportion(): Promise<StockProportion> {
    const totalMedicines = await MedicineStockModel.sum("quantidade");
    const totalIndividualType = await MedicineStockModel.sum("quantidade", { where: { tipo: OperationType.INDIVIDUAL } });
    const totalGeralType = await MedicineStockModel.sum("quantidade", { where: { tipo: OperationType.GERAL } });
    const totalEmergencyCarMedicines = await MedicineStockModel.sum("quantidade", {
      where: { tipo: OperationType.CARRINHO }
    });

    const totalEmergencyCarInputs = await InputStockModel.sum("quantidade", {
      where: { tipo: OperationType.CARRINHO }
    });
    const totalInputs = await InputStockModel.sum("quantidade", {
      where: { tipo: "geral" }
    });;

   return { 
      total_medicamentos: totalMedicines,
      total_individuais: totalIndividualType,
      total_gerais: totalGeralType,
      total_insumos: totalInputs,
      total_carrinho_medicamentos: totalEmergencyCarMedicines,
      total_carrinho_insumos: totalEmergencyCarInputs
    };
  } 

  async getNonMovementedMedicines(limit = 10) {
    const query = `
        SELECT 
          'medicamento' AS tipo_item,
          m.id AS item_id,
          m.nome,
          m.principio_ativo AS detalhe,
          MAX(mov.data) AS ultima_movimentacao,
          DATE_PART('day', CURRENT_DATE - COALESCE(MAX(mov.data), '1900-01-01')) AS dias_parados
        FROM medicamento m
        JOIN movimentacao mov ON mov.medicamento_id = m.id
        GROUP BY m.id, m.nome, m.principio_ativo

        UNION ALL

        SELECT 
          'insumo' AS tipo_item,
          i.id AS item_id,
          i.nome,
          i.descricao AS detalhe,
          MAX(mov.data) AS ultima_movimentacao,
          DATE_PART('day', CURRENT_DATE - COALESCE(MAX(mov.data), '1900-01-01')) AS dias_parados
        FROM insumo i
        LEFT JOIN movimentacao mov ON mov.insumo_id = i.id
        GROUP BY i.id, i.nome, i.descricao

        ORDER BY dias_parados DESC
        LIMIT :limit
      `;

    return sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements: { limit },
    }) as Promise<NonMovementedItem[]>;
  }
}

