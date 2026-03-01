'use strict';

const { addColumnIfNotExists, removeColumnIfExists } = require('../migration-helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'estoque_insumo', 'destino', {
      type: Sequelize.STRING(75),
      allowNull: true,
    });

    await addColumnIfNotExists(queryInterface, 'estoque_insumo', 'observacao', {
      type: Sequelize.STRING(75),
      allowNull: true,
    });

    await addColumnIfNotExists(queryInterface, 'movimentacao', 'destino', {
      type: Sequelize.STRING(75),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'estoque_insumo', 'observacao');
    await removeColumnIfExists(queryInterface, 'estoque_insumo', 'destino');
    await removeColumnIfExists(queryInterface, 'movimentacao', 'destino');
  },
};
