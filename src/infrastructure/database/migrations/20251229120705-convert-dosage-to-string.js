'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('medicamento', 'dosagem', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('medicamento', 'dosagem', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};
