'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('movimentacao', 'setor', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'farmacia',
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE movimentacao
      ADD CONSTRAINT movimentacao_setor_check
      CHECK (setor IN ('farmacia', 'enfermagem'))
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE movimentacao
      DROP CONSTRAINT IF EXISTS movimentacao_setor_check
    `);

    await queryInterface.removeColumn('movimentacao', 'setor');
  },
};
