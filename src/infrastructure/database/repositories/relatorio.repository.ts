import { sequelize } from "../sequelize";
import { QueryTypes } from "sequelize";
import { 
  AllItemsReport, 
  InputReport, 
  MedicineReport, 
  ResidentReport 
} from "../models/relatorio.model";

export class ReportRepository {

  async getMedicinesData(): Promise<MedicineReport[]> {
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

    const rows = await sequelize.query<MedicineReport>(query, {
      type: QueryTypes.SELECT,
    });

    return rows;
  }

  async getInputsData(): Promise<InputReport[]> {
    const query = `
      SELECT 
        i.nome as insumo, 
        SUM(ei.quantidade) AS quantidade, 
        ei.armario_id as armario
      FROM ESTOQUE_INSUMO ei
      JOIN INSUMO i ON i.id = ei.insumo_id
      GROUP BY i.nome, ei.armario_id
    `;

    const rows = await sequelize.query<InputReport>(query, {
      type: QueryTypes.SELECT,
    });

    return rows;
  }

  async getResidentsData(): Promise<ResidentReport[]> {
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

    const rows = await sequelize.query<ResidentReport>(query, {
      type: QueryTypes.SELECT,
    });

    return rows;
  }

  async getAllItemsData(): Promise<AllItemsReport> {
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

    const medicines = await sequelize.query<MedicineReport>(medQuery, {
      type: QueryTypes.SELECT,
    });

    const inputs = await sequelize.query<InputReport>(insQuery, {
      type: QueryTypes.SELECT,
    });

    return { medicamentos: medicines, insumos: inputs };
  }
}
