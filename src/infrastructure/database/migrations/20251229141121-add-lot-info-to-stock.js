'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('estoque_insumo', 'lote', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('estoque_medicamento', 'lote', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addIndex('estoque_insumo', ['lote'], {
      unique: true,
      name: 'uniq_estoque_insumo_lote',
      where: {
        lote: { [Sequelize.Op.ne]: null },
      },
    });

    await queryInterface.addIndex('estoque_medicamento', ['lote'], {
      unique: true,
      name: 'uniq_estoque_medicamento_lote',
      where: {
        lote: { [Sequelize.Op.ne]: null },
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'estoque_insumo',
      'uniq_estoque_insumo_lote',
    );
    await queryInterface.removeIndex(
      'estoque_medicamento',
      'uniq_estoque_medicamento_lote',
    );

    await queryInterface.removeColumn('estoque_insumo', 'lote');
    await queryInterface.removeColumn('estoque_medicamento', 'lote');
  },
};
