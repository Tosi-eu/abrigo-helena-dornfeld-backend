'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const TABLE_NAME = 'gaveta';

    const [categories] = await queryInterface.sequelize.query(
      `SELECT id FROM categoria_gaveta ORDER BY id`,
    );

    if (categories.length === 0) {
      console.warn(
        'Nenhuma categoria de gaveta encontrada. Pulando inserção de gavetas.',
      );
      return;
    }

    const [existing] = await queryInterface.sequelize.query(
      `SELECT num_gaveta FROM ${TABLE_NAME}`,
    );

    const existingNumbers = new Set(existing.map(e => e.num_gaveta));

    const drawers = [];
    let gavetaNum = 1;

    for (let i = 0; i < 20; i++) {
      if (!existingNumbers.has(gavetaNum)) {
        const categoriaIndex = i % categories.length;
        drawers.push({
          num_gaveta: gavetaNum,
          categoria_id: categories[categoriaIndex].id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      gavetaNum++;
    }

    if (drawers.length > 0) {
      await queryInterface.bulkInsert(TABLE_NAME, drawers);
    }
  },

  async down(queryInterface, Sequelize) {
    const TABLE_NAME = 'gaveta';

    await queryInterface.bulkDelete(TABLE_NAME, {
      num_gaveta: Array.from({ length: 20 }, (_, i) => i + 1),
    });
  },
};
