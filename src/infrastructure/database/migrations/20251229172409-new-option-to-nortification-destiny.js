'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TYPE enum_notificacao_destino_new 
      AS ENUM ('sus', 'familia', 'farmacia');
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE notificacao
      ALTER COLUMN destino
      TYPE enum_notificacao_destino_new
      USING destino::text::enum_notificacao_destino_new;
    `);

    await queryInterface.sequelize.query(`
      DROP TYPE enum_notificacao_destino;
    `);

    await queryInterface.sequelize.query(`
      ALTER TYPE enum_notificacao_destino_new
      RENAME TO enum_notificacao_destino;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TYPE enum_notificacao_destino_old
      AS ENUM ('farmacia');
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE notificacao
      ALTER COLUMN destino
      TYPE enum_notificacao_destino_old
      USING destino::text::enum_notificacao_destino_old;
    `);

    await queryInterface.sequelize.query(`
      DROP TYPE enum_notificacao_destino;
    `);

    await queryInterface.sequelize.query(`
      ALTER TYPE enum_notificacao_destino_old
      RENAME TO enum_notificacao_destino;
    `);
  },
};
