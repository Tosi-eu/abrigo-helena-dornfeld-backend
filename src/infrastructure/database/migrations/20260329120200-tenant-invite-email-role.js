'use strict';

const { addColumnIfNotExists } = require('../migration-helpers');

/**
 * Adds email + role + permissions payload to tenant invites.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'tenant_invite', 'email', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await addColumnIfNotExists(queryInterface, 'tenant_invite', 'role', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
    await addColumnIfNotExists(
      queryInterface,
      'tenant_invite',
      'permissions_json',
      {
        type: Sequelize.JSONB,
        allowNull: true,
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('tenant_invite', 'permissions_json');
    await queryInterface.removeColumn('tenant_invite', 'role');
    await queryInterface.removeColumn('tenant_invite', 'email');
  },
};
