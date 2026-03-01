'use strict';

const { addColumnIfNotExists, removeColumnIfExists } = require('../migration-helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'notificacao', 'tipo_evento', {
      type: Sequelize.ENUM('medicamento', 'reposicao_estoque'),
      allowNull: false,
      defaultValue: 'medicamento',
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'notificacao', 'tipo_evento');
  },
};
