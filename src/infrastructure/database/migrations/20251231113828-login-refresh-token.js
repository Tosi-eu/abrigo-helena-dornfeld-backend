'use strict';

const { addColumnIfNotExists, removeColumnIfExists } = require('../migration-helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'login', 'refreshToken', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'login', 'refreshToken');
  },
};
