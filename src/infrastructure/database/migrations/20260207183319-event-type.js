'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('notificacao', 'tipo_evento', {
      type: Sequelize.ENUM('medicamento', 'reposicao_estoque'),
      allowNull: false,
      defaultValue: 'medicamento',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('notificacao', 'tipo_evento');
  },
};
