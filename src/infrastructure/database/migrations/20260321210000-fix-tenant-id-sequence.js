'use strict';

/**
 * O seed em 20260319090000 faz INSERT em tenant com id=1 explícito.
 * No PostgreSQL isso não atualiza a sequência SERIAL; o próximo DEFAULT
 * ainda tenta gerar id=1 → duplicate key em tenant_pkey.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      SELECT setval(
        pg_get_serial_sequence('tenant', 'id'),
        COALESCE((SELECT MAX(id) FROM "tenant"), 1)
      );
    `);
  },

  async down() {
    // irreversível
  },
};
