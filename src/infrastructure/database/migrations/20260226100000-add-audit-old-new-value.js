'use strict';

/**
 * Adds old_value and new_value (TEXT) to audit_log for before/after comparison.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'audit_log',
      'old_value',
      { type: Sequelize.TEXT, allowNull: true },
    );
    await queryInterface.addColumn(
      'audit_log',
      'new_value',
      { type: Sequelize.TEXT, allowNull: true },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('audit_log', 'new_value');
    await queryInterface.removeColumn('audit_log', 'old_value');
  },
};
