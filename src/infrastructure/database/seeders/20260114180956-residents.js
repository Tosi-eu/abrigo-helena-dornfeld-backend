'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const TABLE_NAME = 'residente';

    const RESIDENTS = [
      { num_casela: 1, nome: 'João Silva' },
      { num_casela: 2, nome: 'Maria Santos' },
      { num_casela: 3, nome: 'Pedro Oliveira' },
      { num_casela: 4, nome: 'Ana Costa' },
      { num_casela: 5, nome: 'Carlos Souza' },
      { num_casela: 6, nome: 'Julia Ferreira' },
      { num_casela: 7, nome: 'Roberto Lima' },
      { num_casela: 8, nome: 'Fernanda Alves' },
      { num_casela: 9, nome: 'Lucas Pereira' },
      { num_casela: 10, nome: 'Patricia Rodrigues' },
    ];

    const [existing] = await queryInterface.sequelize.query(
      `SELECT num_casela FROM ${TABLE_NAME}`,
    );

    const existingCaselas = new Set(existing.map(e => e.num_casela));

    const rowsToInsert = RESIDENTS.filter(
      resident => !existingCaselas.has(resident.num_casela),
    );

    if (rowsToInsert.length > 0) {
      await queryInterface.bulkInsert(TABLE_NAME, rowsToInsert);
    }
  },

  async down(queryInterface, Sequelize) {
    const TABLE_NAME = 'residente';

    await queryInterface.bulkDelete(TABLE_NAME, {
      num_casela: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    });
  },
};

