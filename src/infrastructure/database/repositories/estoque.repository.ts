import { EstoqueMedicamento, EstoqueInsumo } from "../../../core/domain/estoque";
import EstoqueMedicamentoModel from "../models/estoque-medicamento.model";
import EstoqueInsumoModel from "../models/estoque-insumo.model";
import { QueryTypes } from "sequelize";
import { sequelize } from "../sequelize";

export interface ProporcaoEstoque {
  total_medicamentos: number;
  total_individuais: number;
  total_gerais: number;
  total_insumos: number;
}

  export class EstoqueRepository {
    async registrarEntradaMedicamento(data: EstoqueMedicamento) {
      await EstoqueMedicamentoModel.create({
        medicamento_id: data.medicamento_id,
        casela_id: data.casela_id ?? null,
        armario_id: data.armario_id,
        validade: data.validade ?? null,
        quantidade: data.quantidade,
        origem: data.origem ?? null,
        tipo: data.tipo ?? null,
      }); 

      return { message: "Entrada de medicamento registrada." };
    }

    async registrarEntradaInsumo(data: EstoqueInsumo) {
      await EstoqueInsumoModel.create({
        insumo_id: data.insumo_id,
        armario_id: data.armario_id,
        quantidade: data.quantidade,
      });

      return { message: "Entrada de insumo registrada." };
    }

  async registrarSaidaMedicamento(itemId: number, armarioId: number, quantidade: number) {
    const registro = await EstoqueMedicamentoModel.findOne({
      where: { medicamento_id: itemId, armario_id: armarioId },
    });

    if (!registro) throw new Error("Registro não encontrado.");

    registro.quantidade -= quantidade;
    await registro.save();

    return { message: "Saída realizada" };
  }

  async registrarSaidaInsumo(itemId: number, armarioId: number, quantidade: number) {
    const registro = await EstoqueInsumoModel.findOne({
      where: { insumo_id: itemId, armario_id: armarioId },
    });

    if (!registro) throw new Error("Registro não encontrado.");

    registro.quantidade -= quantidade;
    await registro.save();

    return { message: "Saída realizada" };
  }

  async listarEstoque(params: { filter: string; type: string }) {
    const { filter, type } = params;

    let baseQuery = "";

    if (!type || type === "all") {
      let medicamentoQuery = `
        SELECT 
          'medicamento' AS tipo,
          m.id AS item_id,
          m.nome,
          m.principio_ativo,
          MIN(em.validade) AS validade,
          SUM(em.quantidade) AS quantidade,
          m.estoque_minimo AS minimo,
          em.origem,
          em.tipo AS subtipo,
          r.nome AS paciente,
          em.armario_id,
          em.casela_id
        FROM estoque_medicamento em
        JOIN medicamento m ON m.id = em.medicamento_id
        LEFT JOIN residente r ON r.num_casela = em.casela_id
        GROUP BY m.id, m.nome, m.principio_ativo, m.estoque_minimo, 
                em.origem, em.tipo, r.nome, em.armario_id, em.casela_id
      `;

      if (["noStock", "belowMin", "expired", "expiringSoon"].includes(filter)) {
        switch (filter) {
          case "noStock":
            medicamentoQuery += " HAVING SUM(em.quantidade) = 0";
            break;
          case "belowMin":
            medicamentoQuery += `
              HAVING SUM(em.quantidade) > 0
              AND SUM(em.quantidade) <= COALESCE(m.estoque_minimo,0)
            `;
            break;
          case "expired":
            medicamentoQuery += " HAVING MIN(em.validade) < CURRENT_DATE";
            break;
          case "expiringSoon":
            medicamentoQuery += `
              HAVING SUM(em.quantidade) > 0
              AND MIN(em.validade) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
            `;
            break;
        }
      }

      let insumoQuery = `
        SELECT 
          'insumo' AS tipo,
          i.id AS item_id,
          i.nome,
          NULL AS principio_ativo,
          NULL AS validade,
          SUM(ei.quantidade) AS quantidade,
          NULL AS minimo,
          NULL AS origem,
          NULL AS subtipo,
          NULL AS paciente,
          ei.armario_id,
          NULL AS casela_id
        FROM estoque_insumo ei
        JOIN insumo i ON i.id = ei.insumo_id
        GROUP BY i.id, i.nome, ei.armario_id
      `;

      if (filter === "noStock") {
        insumoQuery += " HAVING SUM(ei.quantidade) = 0";
      }

      baseQuery = `${medicamentoQuery} UNION ALL ${insumoQuery}`;
    } 
    else if (type === "medicamento") {
      baseQuery = `
        SELECT 
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
        GROUP BY m.id, m.nome, m.principio_ativo, m.estoque_minimo, 
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
            AND MIN(em.validade) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
          `;
          break;
      }
    } 
    else if (type === "insumo") {
      baseQuery = `
        SELECT 
          i.id AS item_id,
          i.nome,
          SUM(ei.quantidade) AS quantidade,
          ei.armario_id
        FROM estoque_insumo ei
        JOIN insumo i ON i.id = ei.insumo_id
        GROUP BY i.id, i.nome, ei.armario_id
      `;
      if (filter === "noStock") {
        baseQuery += " HAVING SUM(ei.quantidade) = 0";
      }
    } 
    else if (type === "armarios") {
      baseQuery = `
        SELECT 
          a.num_armario AS armario_id,
          COALESCE(SUM(em.quantidade), 0) AS total_medicamentos,
          COALESCE(SUM(ei.quantidade), 0) AS total_insumos,
          COALESCE(SUM(em.quantidade), 0) + COALESCE(SUM(ei.quantidade), 0) AS total_geral
        FROM armario a
        LEFT JOIN estoque_medicamento em ON em.armario_id = a.num_armario
        LEFT JOIN estoque_insumo ei ON ei.armario_id = a.num_armario
        GROUP BY a.num_armario
        ORDER BY a.num_armario
      `;
    } 
    else {
      throw new Error("Tipo inválido. Use medicamento, insumo, armarios ou all.");
    }

    return await sequelize.query(baseQuery, { type: QueryTypes.SELECT });
  }

  async obterProporcao(): Promise<ProporcaoEstoque> {
    const total_medicamentos = await EstoqueMedicamentoModel.sum("quantidade");
    const total_individuais = await EstoqueMedicamentoModel.sum("quantidade", { where: { tipo: "individual" } });
    const total_gerais = await EstoqueMedicamentoModel.sum("quantidade", { where: { tipo: "geral" } });
    const total_insumos = await EstoqueInsumoModel.sum("quantidade");

    return { total_medicamentos, total_individuais, total_gerais, total_insumos };
  } 
}

