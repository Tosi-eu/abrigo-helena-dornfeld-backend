'use strict';

const { addColumnIfNotExists } = require('../migration-helpers');

/**
 * Adds branding fields to tenant.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'tenant', 'logo_data_url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfNotExists(queryInterface, 'tenant', 'brand_name', {
      type: Sequelize.STRING(160),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeColumn('tenant', 'logo_data_url');
    } catch {
      /* ignore */
    }
    try {
      await queryInterface.removeColumn('tenant', 'brand_name');
    } catch {
      /* ignore */
    }
  },
};
