'use strict';

const {
  addColumnIfNotExists,
  removeColumnIfExists,
} = require('../migration-helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(
      queryInterface,
      'estoque_medicamento',
      'ultima_reposicao',
      {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
    );

    await addColumnIfNotExists(
      queryInterface,
      'estoque_insumo',
      'ultima_reposicao',
      {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
    );
  },

  async down(queryInterface) {
    await removeColumnIfExists(
      queryInterface,
      'estoque_medicamento',
      'ultima_reposicao',
    );
    await removeColumnIfExists(
      queryInterface,
      'estoque_insumo',
      'ultima_reposicao',
    );
  },
};
