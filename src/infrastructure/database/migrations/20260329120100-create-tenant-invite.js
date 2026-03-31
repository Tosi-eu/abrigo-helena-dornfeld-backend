'use strict';

const { createTableIfNotExists } = require('../migration-helpers');

/** One-time entry tokens to join a tenant as role=user. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await createTableIfNotExists(queryInterface, 'tenant_invite', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { table: 'tenant', field: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      token_digest: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      created_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { table: 'login', field: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      used_at: { type: Sequelize.DATE, allowNull: true },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
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
    await queryInterface.dropTable('tenant_invite');
  },
};
