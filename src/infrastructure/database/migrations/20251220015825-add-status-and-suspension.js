'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('estoque_medicamento', 'status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'active',
    });

    await queryInterface.addColumn('estoque_medicamento', 'suspended_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('estoque_medicamento', 'status');
    await queryInterface.removeColumn('estoque_medicamento', 'suspended_at');
  },
};
