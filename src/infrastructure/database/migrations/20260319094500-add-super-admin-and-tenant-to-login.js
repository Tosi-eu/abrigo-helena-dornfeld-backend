'use strict';

const { addColumnIfNotExists } = require('../migration-helpers');

/**
 * Adds multi-tenant governance fields to login:
 * - tenant_id: tenant ownership for the user
 * - is_super_admin: can manage all tenants / switch tenant context
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'login', 'tenant_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 1,
    });
    await queryInterface.sequelize.query(
      `UPDATE "login" SET tenant_id = 1 WHERE tenant_id IS NULL;`,
    );
    await queryInterface.changeColumn('login', 'tenant_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await addColumnIfNotExists(queryInterface, 'login', 'is_super_admin', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Bootstrap: keep compatibility with old "admin id=1" convention.
    await queryInterface.sequelize.query(
      `UPDATE "login" SET is_super_admin = true WHERE id = 1;`,
    );

    try {
      await queryInterface.addIndex('login', ['tenant_id']);
    } catch (e) {
      if (!e.message || !String(e.message).includes('already exists')) throw e;
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeColumn('login', 'is_super_admin');
    } catch {
      /* ignore */
    }
    try {
      await queryInterface.removeColumn('login', 'tenant_id');
    } catch {
      /* ignore */
    }
  },
};
