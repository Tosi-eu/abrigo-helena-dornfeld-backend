'use strict';

const { addColumnIfNotExists } = require('../migration-helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'tenant', 'logo_url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeColumn('tenant', 'logo_url');
    } catch {
      /* ignore */
    }
  },
};
