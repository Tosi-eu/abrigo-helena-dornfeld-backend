'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('login', 'first_name', {
      type: Sequelize.STRING(45),
      allowNull: true,
    });

    await queryInterface.addColumn('login', 'last_name', {
      type: Sequelize.STRING(45),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('login', 'first_name');
    await queryInterface.removeColumn('login', 'last_name');
  },
};
