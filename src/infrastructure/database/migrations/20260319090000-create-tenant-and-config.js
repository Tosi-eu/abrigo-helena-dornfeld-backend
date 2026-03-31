'use strict';

const { createTableIfNotExists } = require('../migration-helpers');

/**
 * Creates tenant + tenant_config tables and seeds a default tenant (id=1).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await createTableIfNotExists(queryInterface, 'tenant', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      slug: { type: Sequelize.STRING(60), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(120), allowNull: false },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await createTableIfNotExists(queryInterface, 'tenant_config', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false, unique: true },
      modules_json: { type: Sequelize.JSONB, allowNull: false },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tenant_config');
    await queryInterface.dropTable('tenant');
  },
};
