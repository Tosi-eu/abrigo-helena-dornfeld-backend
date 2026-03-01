'use strict';

const { addColumnIfNotExists, removeColumnIfExists } = require('../migration-helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'estoque_medicamento', 'status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'active',
    });

    await addColumnIfNotExists(queryInterface, 'estoque_medicamento', 'suspended_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'estoque_medicamento', 'status');
    await removeColumnIfExists(queryInterface, 'estoque_medicamento', 'suspended_at');
  },
};
