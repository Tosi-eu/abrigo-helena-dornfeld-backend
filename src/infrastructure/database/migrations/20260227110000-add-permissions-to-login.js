'use strict';

const { removeColumnIfExists } = require('../migration-helpers');

/**
 * Adds granular permissions to login.
 * Structure: { read: true, create: boolean, update: boolean, delete: boolean }
 * Read is always true (mandatory). Default for new users: create/update/delete false.
 * Existing admin users get all true.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.query(`
      ALTER TABLE "login"
      ADD COLUMN IF NOT EXISTS "permissions" JSONB
      DEFAULT '{"read": true, "create": false, "update": false, "delete": false}';
    `);
    await sequelize.query(`
      UPDATE "login"
      SET "permissions" = '{"read": true, "create": true, "update": true, "delete": true}'
      WHERE "role" = 'admin';
    `);
    await sequelize.query(`
      UPDATE "login"
      SET "permissions" = '{"read": true, "create": false, "update": false, "delete": false}'
      WHERE "permissions" IS NULL OR ("permissions"->>'read') IS NULL;
    `);
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'login', 'permissions');
  },
};
