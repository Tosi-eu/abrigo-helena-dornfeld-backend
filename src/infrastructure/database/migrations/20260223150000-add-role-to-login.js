'use strict';

/**
 * Adds a `role` column to the login table.
 * - Default for new rows: 'user'.
 * - Existing row with id = 1 (first user) is set to 'admin'.
 * Values: 'admin' | 'user'.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('login', 'role', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'user',
    });

    await queryInterface.sequelize.query(
      "UPDATE login SET role = 'admin' WHERE id = 1",
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('login', 'role');
  },
};
