'use strict';

const { addColumnIfNotExists, removeColumnIfExists } = require('../migration-helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'estoque_insumo', 'gaveta_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'gaveta',
        key: 'num_gaveta',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await addColumnIfNotExists(queryInterface, 'estoque_medicamento', 'gaveta_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'gaveta',
        key: 'num_gaveta',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'estoque_insumo', 'gaveta_id');
    await removeColumnIfExists(queryInterface, 'estoque_medicamento', 'gaveta_id');
  },
};
