'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('notificacao', 'quantidade', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('notificacao', 'dias_para_repor', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('notificacao', 'quantidade');
    await queryInterface.removeColumn('notificacao', 'dias_para_repor');
  },
};
