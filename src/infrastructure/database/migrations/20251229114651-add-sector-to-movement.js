'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('movimentacao', 'setor', {
      type: Sequelize.ENUM('farmacia', 'enfermagem'),
      allowNull: false,
      defaultValue: 'farmacia',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('movimentacao', 'setor');
  },
};
