'use strict';

const { createTableIfNotExists } = require('../migration-helpers');

/**
 * Creates login_log table for storing login/session events (who, when, IP).
 * Used by admin panel for security and investigation.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await createTableIfNotExists(queryInterface, 'login_log', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'login', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      login: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Login attempted (identifier used at login)',
      },
      success: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      ip: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
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
    await addIndexIfNotExists('login_log', ['created_at']);
    await addIndexIfNotExists('login_log', ['user_id']);
    await addIndexIfNotExists('login_log', ['login']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('login_log');
  },
};
