'use strict';

const { addColumnIfNotExists } = require('../migration-helpers');

/**
 * Adds tenant_id to all core tables and backfills to default tenant (1).
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
      await queryInterface.changeColumn(table, 'tenant_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      });
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
