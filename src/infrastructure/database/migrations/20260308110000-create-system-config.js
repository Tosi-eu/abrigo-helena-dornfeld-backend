'use strict';

const { createTableIfNotExists } = require('../migration-helpers');

/**
 * Creates system_config table for admin-editable settings (e.g. expiring days, defaults).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await createTableIfNotExists(queryInterface, 'system_config', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      value: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
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

    const addIndexIfNotExists = async (table, fields) => {
      try {
        await queryInterface.addIndex(table, fields);
      } catch (e) {
        if (!e.message || !e.message.includes('already exists')) throw e;
      }
    };
    await addIndexIfNotExists('system_config', ['key']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('system_config');
  },
};
