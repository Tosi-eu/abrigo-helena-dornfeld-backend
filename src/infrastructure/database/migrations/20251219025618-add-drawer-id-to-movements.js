'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('movimentacao', 'gaveta_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'gaveta',
        key: 'num_gaveta',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('movimentacao', 'gaveta_id');
  },
};
