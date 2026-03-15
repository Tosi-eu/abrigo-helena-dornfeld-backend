'use strict';

const {
  addColumnIfNotExists,
  removeColumnIfExists,
} = require('../migration-helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'estoque_insumo', 'status', {
      type: Sequelize.ENUM('active', 'suspended'),
      allowNull: false,
      defaultValue: 'active',
    });

    await addColumnIfNotExists(
      queryInterface,
      'estoque_insumo',
      'suspended_at',
      {
        type: Sequelize.DATE,
        allowNull: true,
      },
    );
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'estoque_insumo', 'status');
    await removeColumnIfExists(
      queryInterface,
      'estoque_insumo',
      'suspended_at',
    );
  },
};
