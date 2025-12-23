'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('estoque_insumo', 'setor', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'farmacia',
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE estoque_insumo
      ADD CONSTRAINT estoque_insumo_setor_check
      CHECK (setor IN ('farmacia', 'enfermagem'))
    `);

    await queryInterface.addColumn('estoque_medicamento', 'setor', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'farmacia',
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE estoque_medicamento
      ADD CONSTRAINT estoque_medicamento_setor_check
      CHECK (setor IN ('farmacia', 'enfermagem'))
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE estoque_insumo
      DROP CONSTRAINT IF EXISTS estoque_insumo_setor_check
    `);

    await queryInterface.removeColumn('estoque_insumo', 'setor');

    await queryInterface.sequelize.query(`
      ALTER TABLE estoque_medicamento
      DROP CONSTRAINT IF EXISTS estoque_medicamento_setor_check
    `);

    await queryInterface.removeColumn('estoque_medicamento', 'setor');
  },
};
