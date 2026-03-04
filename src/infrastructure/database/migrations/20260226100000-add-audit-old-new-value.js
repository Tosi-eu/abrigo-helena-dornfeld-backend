'use strict';

const { addColumnIfNotExists, removeColumnIfExists } = require('../migration-helpers');

/**
 * Adds old_value and new_value (TEXT) to audit_log for before/after comparison.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'audit_log', 'old_value', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfNotExists(queryInterface, 'audit_log', 'new_value', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'audit_log', 'new_value');
    await removeColumnIfExists(queryInterface, 'audit_log', 'old_value');
  },
};
