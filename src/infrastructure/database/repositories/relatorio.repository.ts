import { sequelize } from '../sequelize';
import { QueryTypes } from 'sequelize';
import {
  AllItemsReport,
  InputReport,
  MedicineReport,
  PsicotropicoData,
  PsicotropicosReport,
  ResidentReport,
} from '../models/relatorio.model';
import { ResidentMonthlyUsage } from '../../../core/utils/utils';
import { formatDateToPtBr } from '../../helpers/date.helper';

export class ReportRepository {
  async getMedicinesData(): Promise<MedicineReport[]> {
    const query = `
      SELECT 
        m.nome AS medicamento,
        m.principio_ativo,
        em.validade,
        SUM(em.quantidade) AS quantidade,
        p.nome AS residente
      FROM ESTOQUE_MEDICAMENTO em
      JOIN MEDICAMENTO m 
        ON m.id = em.medicamento_id
      LEFT JOIN RESIDENTE p 
        ON p.num_casela = em.casela_id
      GROUP BY 
        m.nome,
        m.principio_ativo,
        em.validade,
        p.nome
      ORDER BY 
        m.nome,
        em.validade;
    `;

    const rows = await sequelize.query<MedicineReport>(query, {
      type: QueryTypes.SELECT,
    });

    return rows;
  }

  async getInputsData(): Promise<InputReport[]> {
    const query = `
      SELECT 
        i.nome AS insumo,
        ei.validade,
        SUM(ei.quantidade) AS quantidade,
        ei.armario_id AS armario
      FROM ESTOQUE_INSUMO ei
      JOIN INSUMO i 
        ON i.id = ei.insumo_id
      GROUP BY 
        i.nome,
        ei.validade,
        ei.armario_id
      ORDER BY 
        i.nome,
        ei.validade;
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

  async getResidentsMonthlyUsage(): Promise<ResidentMonthlyUsage[]> {
    const query = `
      SELECT 
      r.nome AS residente,
      r.num_casela AS casela,
      m.nome AS medicamento,
      m.principio_ativo,
      DATE_TRUNC('month', mov.data) AS data,
      SUM(mov.quantidade) AS consumo_mensal
    FROM movimentacao mov
    JOIN medicamento m ON m.id = mov.medicamento_id
    JOIN residente r ON r.num_casela = mov.casela_id
    WHERE 
      mov.tipo = 'saida' 
      AND DATE_TRUNC('month', mov.data) = DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY 
      r.num_casela,
      r.nome,
      m.id,
      m.nome,
      m.principio_ativo,
      DATE_TRUNC('month', mov.data)
    ORDER BY 
      r.nome,
      m.nome;
    `;

    return sequelize.query<ResidentMonthlyUsage>(query, {
      type: QueryTypes.SELECT,
    });
  }

  async getPsicotropicosData(): Promise<PsicotropicosReport> {
    const query = `
      SELECT
          mov.tipo AS tipo,
          m.nome AS medicamento,
          r.nome AS residente,
          mov.data AS data_movimentacao,
          mov.quantidade AS quantidade
      FROM MOVIMENTACAO mov
      JOIN MEDICAMENTO m
          ON m.id = mov.medicamento_id
      LEFT JOIN RESIDENTE r
          ON r.num_casela = mov.casela_id
      JOIN ARMARIO a
          ON a.num_armario = mov.armario_id
      JOIN CATEGORIA_ARMARIO ca
          ON ca.id = a.categoria_id
      WHERE mov.medicamento_id IS NOT NULL
        AND ca.id = 2     
      ORDER BY mov.data ASC;
    `;

    const psicotropicosRes = await sequelize.query<PsicotropicoData>(query, {
      type: QueryTypes.SELECT,
    });

    const formatted = psicotropicosRes.map(p => ({
      ...p,
      data_movimentacao: formatDateToPtBr(p.data_movimentacao),
    }));

    return { psicotropico: formatted };
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
