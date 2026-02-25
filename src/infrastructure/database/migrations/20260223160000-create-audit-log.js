'use strict';

/**
 * Creates audit_log table for storing API operation events (create, update, delete).
 * Used by the admin panel insights.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_log', {
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
      method: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      path: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      operation_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'create | update | delete',
      },
      resource: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'e.g. estoque, medicamentos, login',
      },
      status_code: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      duration_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('audit_log', ['created_at']);
    await queryInterface.addIndex('audit_log', ['operation_type']);
    await queryInterface.addIndex('audit_log', ['user_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_log');
  },
};
