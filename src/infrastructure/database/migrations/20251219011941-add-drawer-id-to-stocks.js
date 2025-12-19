'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('estoque_insumo', 'gaveta_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'gaveta',
        key: 'num_gaveta',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('estoque_medicamento', 'gaveta_id', {
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

  async down(queryInterface) {
    await queryInterface.removeColumn('estoque_insumo', 'gaveta_id');
    await queryInterface.removeColumn('estoque_medicamento', 'gaveta_id');
  },
};
