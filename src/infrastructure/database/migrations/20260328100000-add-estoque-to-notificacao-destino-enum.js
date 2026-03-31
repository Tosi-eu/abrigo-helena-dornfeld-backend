'use strict';

/**
 * O app já usa destino "estoque" (reposição de estoque); o enum no PG ficou
 * apenas com sus/familia/farmacia na migration 20251229172409.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'enum_notificacao_destino'
            AND e.enumlabel = 'estoque'
        ) THEN
          ALTER TYPE enum_notificacao_destino ADD VALUE 'estoque';
        END IF;
      END $$;
    `);
  },

  async down() {
    // Remover valor de enum no PostgreSQL exige recriar o tipo; não aplicamos.
  },
};
