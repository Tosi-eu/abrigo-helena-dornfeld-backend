'use strict';

const { addColumnIfNotExists } = require('../migration-helpers');

/**
 * Adds tenant_id to all core tables and backfills to default tenant (1).
 *
 * Não usar queryInterface.changeColumn em tenant_id quando já existem políticas RLS
 * que referenciam essa coluna — o Sequelize reescreve a coluna e o Postgres retorna:
 * "cannot alter type of a column used in a policy definition".
 * Usamos apenas ALTER COLUMN ... SET DEFAULT / SET NOT NULL.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const allTables = [
      'notificacao',
      'movimentacao',
      'login',
      'login_log',
      'medicamento',
      'insumo',
      'residente',
      'armario',
      'gaveta',
      'categoria_armario',
      'categoria_gaveta',
      'estoque_medicamento',
      'estoque_insumo',
      'audit_log',
      'system_config',
    ];

    for (const table of allTables) {
      await addColumnIfNotExists(queryInterface, table, 'tenant_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
      });

      await queryInterface.sequelize.query(
        `UPDATE "${table}" SET tenant_id = 1 WHERE tenant_id IS NULL;`,
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE "${table}" ALTER COLUMN tenant_id SET DEFAULT 1;`,
      );

      const [rows] = await queryInterface.sequelize.query(
        `SELECT is_nullable::text AS n FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = :t AND column_name = 'tenant_id'`,
        { replacements: { t: table } },
      );
      if (rows?.[0]?.n === 'YES') {
        await queryInterface.sequelize.query(
          `ALTER TABLE "${table}" ALTER COLUMN tenant_id SET NOT NULL;`,
        );
      }

      try {
        await queryInterface.addIndex(table, ['tenant_id']);
      } catch (e) {
        if (!e.message || !String(e.message).includes('already exists'))
          throw e;
      }
    }
  },

  async down(queryInterface) {
    const allTables = [
      'notificacao',
      'movimentacao',
      'login',
      'login_log',
      'medicamento',
      'insumo',
      'residente',
      'armario',
      'gaveta',
      'categoria_armario',
      'categoria_gaveta',
      'estoque_medicamento',
      'estoque_insumo',
      'audit_log',
      'system_config',
    ];
    for (const table of allTables) {
      try {
        await queryInterface.removeColumn(table, 'tenant_id');
      } catch {
        /* ignore */
      }
    }
  },
};
