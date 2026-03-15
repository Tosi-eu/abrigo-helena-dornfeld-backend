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
      'observacao',
      {
        type: Sequelize.TEXT,
        allowNull: true,
      },
    );
  },

  async down(queryInterface) {
    await removeColumnIfExists(
      queryInterface,
      'estoque_medicamento',
      'observacao',
    );
  },
};
