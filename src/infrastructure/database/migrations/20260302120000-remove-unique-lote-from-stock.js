'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    try {
      await queryInterface.removeIndex(
        'estoque_insumo',
        'uniq_estoque_insumo_lote',
      );
    } catch (e) {
      if (!e.message || !e.message.includes('does not exist')) throw e;
    }
    try {
      await queryInterface.removeIndex(
        'estoque_medicamento',
        'uniq_estoque_medicamento_lote',
      );
    } catch (e) {
      if (!e.message || !e.message.includes('does not exist')) throw e;
    }
  },

  async down(queryInterface, Sequelize) {
    const addIndexIfNotExists = async (table, fields, opts) => {
      try {
        await queryInterface.addIndex(table, fields, opts);
      } catch (e) {
        if (!e.message || !e.message.includes('already exists')) throw e;
      }
    };
    await addIndexIfNotExists('estoque_insumo', ['lote'], {
      unique: true,
      name: 'uniq_estoque_insumo_lote',
      where: { lote: { [Sequelize.Op.ne]: null } },
    });
    await addIndexIfNotExists('estoque_medicamento', ['lote'], {
      unique: true,
      name: 'uniq_estoque_medicamento_lote',
      where: { lote: { [Sequelize.Op.ne]: null } },
    });
  },
};
