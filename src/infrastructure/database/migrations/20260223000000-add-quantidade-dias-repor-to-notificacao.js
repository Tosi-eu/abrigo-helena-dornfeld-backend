'use strict';

const { addColumnIfNotExists, removeColumnIfExists } = require('../migration-helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'notificacao', 'quantidade', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await addColumnIfNotExists(queryInterface, 'notificacao', 'dias_para_repor', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'notificacao', 'quantidade');
    await removeColumnIfExists(queryInterface, 'notificacao', 'dias_para_repor');
  },
};
