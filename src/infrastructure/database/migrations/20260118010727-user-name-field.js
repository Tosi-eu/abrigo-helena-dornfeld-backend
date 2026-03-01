'use strict';

const { addColumnIfNotExists, removeColumnIfExists } = require('../migration-helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'login', 'first_name', {
      type: Sequelize.STRING(45),
      allowNull: true,
    });

    await addColumnIfNotExists(queryInterface, 'login', 'last_name', {
      type: Sequelize.STRING(45),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'login', 'first_name');
    await removeColumnIfExists(queryInterface, 'login', 'last_name');
  },
};
