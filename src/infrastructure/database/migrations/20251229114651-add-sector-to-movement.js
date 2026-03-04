'use strict';

const { addColumnIfNotExists, removeColumnIfExists } = require('../migration-helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'movimentacao', 'setor', {
      type: Sequelize.ENUM('farmacia', 'enfermagem'),
      allowNull: false,
      defaultValue: 'farmacia',
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'movimentacao', 'setor');
  },
};
