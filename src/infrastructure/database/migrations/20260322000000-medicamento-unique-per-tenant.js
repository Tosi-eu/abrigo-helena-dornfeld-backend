'use strict';

/**
 * Permite que cada tenant cadastre o mesmo medicamento (ex: dipirona 500mg).
 * Troca o índice UNIQUE global por um por tenant.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;

    await sequelize.query(`
      DROP INDEX IF EXISTS "uniq_medicamento_nome_principio_dosagem";
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX "uniq_medicamento_tenant_nome_principio_dosagem"
      ON "medicamento" (tenant_id, nome, principio_ativo, dosagem, unidade_medida);
    `);
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;

    await sequelize.query(`
      DROP INDEX IF EXISTS "uniq_medicamento_tenant_nome_principio_dosagem";
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX "uniq_medicamento_nome_principio_dosagem"
      ON "medicamento" (nome, principio_ativo, dosagem, unidade_medida);
    `);
  },
};
