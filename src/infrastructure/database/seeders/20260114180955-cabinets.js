'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const TABLE_NAME = 'armario';

    // Primeiro, busca as categorias existentes
    const [categories] = await queryInterface.sequelize.query(
      `SELECT id FROM categoria_armario ORDER BY id LIMIT 1`,
    );

    if (categories.length === 0) {
      console.warn('Nenhuma categoria de armário encontrada. Pulando inserção de armários.');
      return;
    }

    const categoriaId = categories[0].id;

    // Verifica armários existentes
    const [existing] = await queryInterface.sequelize.query(
      `SELECT num_armario FROM ${TABLE_NAME}`,
    );

    const existingNumbers = new Set(existing.map(e => e.num_armario));

    // Cria armários numerados de 1 a 5
    const cabinets = [1, 2, 3, 4, 5]
      .filter(num => !existingNumbers.has(num))
      .map(num => ({
        num_armario: num,
        categoria_id: categoriaId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

    if (cabinets.length > 0) {
      await queryInterface.bulkInsert(TABLE_NAME, cabinets);
    }
  },

  async down(queryInterface, Sequelize) {
    const TABLE_NAME = 'armario';

    await queryInterface.bulkDelete(TABLE_NAME, {
      num_armario: [1, 2, 3, 4, 5],
    });
  },
};

