'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('estoque_insumo', 'status', {
      type: Sequelize.ENUM('active', 'suspended'),
      allowNull: false,
      defaultValue: 'active',
    });

    await queryInterface.addColumn('estoque_insumo', 'suspended_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('estoque_insumo', 'status');
    await queryInterface.removeColumn('estoque_insumo', 'suspended_at');
  },
};
