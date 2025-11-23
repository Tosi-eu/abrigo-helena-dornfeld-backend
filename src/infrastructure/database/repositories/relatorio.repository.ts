import { sequelize } from "../sequelize";
import { QueryTypes } from "sequelize";
import { 
  RelatorioCombo, 
  RelatorioInsumo, 
  RelatorioMedicamento, 
  RelatorioResidente 
} from "../models/relatorio.model";

export class RelatorioRepository {

  async getMedicamentos(): Promise<RelatorioMedicamento[]> {
    const query = `
      SELECT 
        m.nome as medicamento, m.principio_ativo, 
        SUM(em.quantidade) AS quantidade,
        MIN(em.validade) AS validade, 
        p.nome AS residente
      FROM ESTOQUE_MEDICAMENTO em
      JOIN MEDICAMENTO m ON m.id = em.medicamento_id
      LEFT JOIN RESIDENTE p ON p.num_casela = em.casela_id
      GROUP BY m.nome, m.principio_ativo, p.nome
    `;

    const rows = await sequelize.query<RelatorioMedicamento>(query, {
      type: QueryTypes.SELECT,
    });

    return rows;
  }

  async getInsumos(): Promise<RelatorioInsumo[]> {
    const query = `
      SELECT 
        i.nome as insumo, 
        SUM(ei.quantidade) AS quantidade, 
        ei.armario_id as armario
      FROM ESTOQUE_INSUMO ei
      JOIN INSUMO i ON i.id = ei.insumo_id
      GROUP BY i.nome, ei.armario_id
    `;

    const rows = await sequelize.query<RelatorioInsumo>(query, {
      type: QueryTypes.SELECT,
    });

    return rows;
  }

  async getResidentes(): Promise<RelatorioResidente[]> {
    const query = `
      SELECT 
        p.nome AS residente, 
        p.num_casela as casela, 
        m.nome AS medicamento, 
        m.principio_ativo, 
        SUM(em.quantidade) AS quantidade,
        MIN(em.validade) AS validade
      FROM ESTOQUE_MEDICAMENTO em
      JOIN MEDICAMENTO m ON m.id = em.medicamento_id
      JOIN RESIDENTE p ON p.num_casela = em.casela_id
      GROUP BY p.nome, p.num_casela, m.nome, m.principio_ativo
      ORDER BY p.nome, m.nome
    `;

    const rows = await sequelize.query<RelatorioResidente>(query, {
      type: QueryTypes.SELECT,
    });

    return rows;
  }

  async getCombo(): Promise<RelatorioCombo> {
    const medQuery = `
      SELECT 
        m.nome AS medicamento, 
        m.principio_ativo, 
        SUM(em.quantidade) AS quantidade,
        MIN(em.validade) AS validade, 
        p.nome AS residente
      FROM ESTOQUE_MEDICAMENTO em
      JOIN MEDICAMENTO m ON m.id = em.medicamento_id
      LEFT JOIN RESIDENTE p ON p.num_casela = em.casela_id
      GROUP BY m.nome, m.principio_ativo, p.nome
    `;

    const insQuery = `
      SELECT 
        i.nome AS insumo, 
        SUM(ei.quantidade) AS quantidade, 
        ei.armario_id as armario
      FROM ESTOQUE_INSUMO ei
      JOIN INSUMO i ON i.id = ei.insumo_id
      GROUP BY i.nome, ei.armario_id
    `;

    const medicamentos = await sequelize.query<RelatorioMedicamento>(medQuery, {
      type: QueryTypes.SELECT,
    });

    const insumos = await sequelize.query<RelatorioInsumo>(insQuery, {
      type: QueryTypes.SELECT,
    });

    return { medicamentos, insumos };
  }
}
