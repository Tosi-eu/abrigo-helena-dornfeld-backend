'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const TABLE_NAME = 'residente';

    const RESIDENTS = Array.from({ length: 50 }, (_, i) => ({
      num_casela: i + 1,
      nome: `Residente ${i + 1}`,
    }));

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
      num_casela: Array.from({ length: 50 }, (_, i) => i + 1),
    });
  },
};
