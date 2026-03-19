'use strict';

/**
 * Makes login unique per tenant: UNIQUE (tenant_id, login).
 * Drops legacy unique index on login(login) when present.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    // Drop legacy unique index if exists (created by add-performance-indexes)
    try {
      await queryInterface.removeIndex('login', 'idx_login_login_unique');
    } catch {
      /* ignore */
    }

    // Create composite unique index
    try {
      await queryInterface.addIndex('login', ['tenant_id', 'login'], {
        name: 'idx_login_tenant_login_unique',
        unique: true,
      });
    } catch (e) {
      if (!e?.message || !String(e.message).includes('already exists')) throw e;
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('login', 'idx_login_tenant_login_unique');
    } catch {
      /* ignore */
    }
    try {
      await queryInterface.addIndex('login', ['login'], {
        name: 'idx_login_login_unique',
        unique: true,
      });
    } catch {
      /* ignore */
    }
  },
};

