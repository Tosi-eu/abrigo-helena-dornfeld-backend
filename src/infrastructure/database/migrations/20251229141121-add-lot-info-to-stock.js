'use strict';

const {
  addColumnIfNotExists,
  removeColumnIfExists,
} = require('../migration-helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'estoque_insumo', 'lote', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await addColumnIfNotExists(queryInterface, 'estoque_medicamento', 'lote', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    const addIndexIfNotExists = async (table, fields, opts) => {
      try {
        await queryInterface.addIndex(table, fields, opts);
      } catch (e) {}
    };
    await addIndexIfNotExists('estoque_insumo', ['lote'], {
      unique: true,
      name: 'uniq_estoque_insumo_lote',
      where: {
        lote: { [Sequelize.Op.ne]: null },
      },
    });
    await addIndexIfNotExists('estoque_medicamento', ['lote'], {
      unique: true,
      name: 'uniq_estoque_medicamento_lote',
      where: {
        lote: { [Sequelize.Op.ne]: null },
      },
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex(
        'estoque_insumo',
        'uniq_estoque_insumo_lote',
      );
    } catch (_) {}
    try {
      await queryInterface.removeIndex(
        'estoque_medicamento',
        'uniq_estoque_medicamento_lote',
      );
    } catch (_) {}

    await removeColumnIfExists(queryInterface, 'estoque_insumo', 'lote');
    await removeColumnIfExists(queryInterface, 'estoque_medicamento', 'lote');
  },
};
