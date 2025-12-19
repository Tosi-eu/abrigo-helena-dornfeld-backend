'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const TABLE_NAME = 'categoria_armario';

    const CATEGORIES = [
      'Medicação geral',
      'Psicotrópicos e injeções',
      'Medicamentos doados / Fitas / Dersane / Clorexidina',
      'Lactulose / Hipratrópio / Pomadas / Domperidona / Materiais de glicemia',
    ];

    const [existing] = await queryInterface.sequelize.query(
      `SELECT nome FROM ${TABLE_NAME}`,
    );

    const existingNames = new Set(existing.map(e => e.nome));

    const rowsToInsert = CATEGORIES.filter(
      nome => !existingNames.has(nome),
    ).map(nome => ({
      nome,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    if (rowsToInsert.length > 0) {
      await queryInterface.bulkInsert(TABLE_NAME, rowsToInsert);
    }
  },

  async down(queryInterface, Sequelize) {
    const TABLE_NAME = 'categoria_armario';

    await queryInterface.bulkDelete(TABLE_NAME, {
      nome: [
        'Medicação geral',
        'Psicotrópicos e injeções',
        'Medicamentos doados / Fitas / Dersane / Clorexidina',
        'Lactulose / Hipratrópio / Pomadas / Domperidona / Materiais de glicemia',
      ],
    });
  },
};
