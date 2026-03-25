'use strict';

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;

    await sequelize.query(`
      DROP INDEX IF EXISTS "uniq_insumo_nome";
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uniq_insumo_tenant_nome"
      ON "insumo" (tenant_id, nome);
    `);
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;

    await sequelize.query(`
      DROP INDEX IF EXISTS "uniq_insumo_tenant_nome";
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uniq_insumo_nome"
      ON "insumo" (nome);
    `);
  },
};
