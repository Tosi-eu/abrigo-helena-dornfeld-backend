'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE movimentacao m
      SET observacao = (
        SELECT em.observacao 
        FROM estoque_medicamento em
        WHERE em.medicamento_id = m.medicamento_id
          AND em.armario_id = m.armario_id
          AND (em.casela_id = m.casela_id OR (em.casela_id IS NULL AND m.casela_id IS NULL))
          AND (em.lote = m.lote OR (em.lote IS NULL AND m.lote IS NULL))
          AND em.observacao IS NOT NULL
          AND em.observacao != ''
          AND em.setor = 'enfermagem'
          AND em."createdAt"::date >= m.data::date
          AND em."createdAt"::date <= (m.data::date + INTERVAL '1 day')
        ORDER BY ABS(EXTRACT(EPOCH FROM (em."createdAt" - m.data)))
        LIMIT 1
      )
      WHERE m.tipo = 'transferencia'
        AND m.setor = 'enfermagem'
        AND m.medicamento_id IS NOT NULL
        AND (m.observacao IS NULL OR m.observacao = '')
        AND EXISTS (
          SELECT 1 
          FROM estoque_medicamento em
          WHERE em.medicamento_id = m.medicamento_id
            AND em.armario_id = m.armario_id
            AND (em.casela_id = m.casela_id OR (em.casela_id IS NULL AND m.casela_id IS NULL))
            AND (em.lote = m.lote OR (em.lote IS NULL AND m.lote IS NULL))
            AND em.observacao IS NOT NULL
            AND em.observacao != ''
            AND em.setor = 'enfermagem'
            AND em."createdAt"::date >= m.data::date
            AND em."createdAt"::date <= (m.data::date + INTERVAL '1 day')
        );
    `);

    await queryInterface.sequelize.query(`
      UPDATE movimentacao m
      SET observacao = (
        SELECT ei.observacao 
        FROM estoque_insumo ei
        WHERE ei.insumo_id = m.insumo_id
          AND ei.armario_id = m.armario_id
          AND (ei.casela_id = m.casela_id OR (ei.casela_id IS NULL AND m.casela_id IS NULL))
          AND (ei.lote = m.lote OR (ei.lote IS NULL AND m.lote IS NULL))
          AND ei.observacao IS NOT NULL
          AND ei.observacao != ''
          AND ei.setor = 'enfermagem'
          AND ei."createdAt"::date >= m.data::date
          AND ei."createdAt"::date <= (m.data::date + INTERVAL '1 day')
        ORDER BY ABS(EXTRACT(EPOCH FROM (ei."createdAt" - m.data)))
        LIMIT 1
      )
      WHERE m.tipo = 'transferencia'
        AND m.setor = 'enfermagem'
        AND m.insumo_id IS NOT NULL
        AND (m.observacao IS NULL OR m.observacao = '')
        AND EXISTS (
          SELECT 1 
          FROM estoque_insumo ei
          WHERE ei.insumo_id = m.insumo_id
            AND ei.armario_id = m.armario_id
            AND (ei.casela_id = m.casela_id OR (ei.casela_id IS NULL AND m.casela_id IS NULL))
            AND (ei.lote = m.lote OR (ei.lote IS NULL AND m.lote IS NULL))
            AND ei.observacao IS NOT NULL
            AND ei.observacao != ''
            AND ei.setor = 'enfermagem'
            AND ei."createdAt"::date >= m.data::date
            AND ei."createdAt"::date <= (m.data::date + INTERVAL '1 day')
        );
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE movimentacao
      SET observacao = NULL
      WHERE tipo = 'TRANSFERENCIA';
    `);
  },
};