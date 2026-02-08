'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('estoque_medicamento', 'ultima_reposicao', {
      type: Sequelize.STRING(45),
      allowNull: true,
    });

    await queryInterface.addColumn('estoque_insumo', 'ultima_reposicao', {
      type: Sequelize.STRING(45),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('estoque_medicamento', 'ultima_reposicao');
    await queryInterface.removeColumn('estoque_insumo', 'ultima_reposicao');
  },
};