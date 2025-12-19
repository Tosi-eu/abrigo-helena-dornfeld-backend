'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const TABLE_NAME = 'categoria_gaveta';

    const CATEGORIES = [
      'Medicamentos',
      'Punção e Exame Físico',
      'Soluções Cristalóides',
      'Oxigênio, Terapia e Bolsa Coletora',
      'Sondagem',
      'Ambu',
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
    const TABLE_NAME = 'categorias_gaveta';

    await queryInterface.bulkDelete(TABLE_NAME, {
      nome: [
        'Medicamentos, função e exame físico',
        'Soluções cristalóides',
        'Oxigênio, terapia e bússola coletora',
        'Sondagem',
        'Ambu',
      ],
    });
  },
};
