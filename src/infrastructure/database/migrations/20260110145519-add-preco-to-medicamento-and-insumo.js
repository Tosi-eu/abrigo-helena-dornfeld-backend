'use strict';

const { addColumnIfNotExists, removeColumnIfExists } = require('../migration-helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'medicamento', 'preco', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });

    await addColumnIfNotExists(queryInterface, 'insumo', 'preco', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'medicamento', 'preco');
    await removeColumnIfExists(queryInterface, 'insumo', 'preco');
  },
};
