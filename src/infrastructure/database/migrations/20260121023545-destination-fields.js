'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('estoque_medicamento', 'destino', {
      type: Sequelize.STRING(75),
      allowNull: true,
    });

    await queryInterface.addColumn('estoque_insumo', 'destino', {
      type: Sequelize.STRING(75),
      allowNull: true,
    });

    await queryInterface.addColumn('movimentacao', 'destino', {
      type: Sequelize.STRING(75),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('estoque_medicamento', 'destino');
    await queryInterface.removeColumn('estoque_insumo', 'destino');
    await queryInterface.removeColumn('movimentacao', 'destino');
  },
};
