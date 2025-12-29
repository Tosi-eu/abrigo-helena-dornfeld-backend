'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'enum_notificacao_destino'
        ) THEN
          CREATE TYPE "enum_notificacao_destino" AS ENUM (
            'sus', 'familia', 'farmacia'
          );
        END IF;
      END$$;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "notificacao"
      ALTER COLUMN "destino"
      TYPE "enum_notificacao_destino"
      USING destino::text::"enum_notificacao_destino";
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "notificacao"
      ALTER COLUMN "destino"
      TYPE VARCHAR(255);
    `);

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_notificacao_destino";
    `);
  },
};
