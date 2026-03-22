'use strict';

/**
 * Fixes tenant table RLS policies: tenant has no tenant_id column.
 * We scope by tenant.id = app.tenant_id, and allow super-admin via app.is_super_admin.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;

    await sequelize.query(`ALTER TABLE "tenant" ENABLE ROW LEVEL SECURITY;`);

    await sequelize.query(
      `DROP POLICY IF EXISTS "tenant_rls_select" ON "tenant";`,
    );
    await sequelize.query(
      `DROP POLICY IF EXISTS "tenant_rls_insert" ON "tenant";`,
    );
    await sequelize.query(
      `DROP POLICY IF EXISTS "tenant_rls_update" ON "tenant";`,
    );
    await sequelize.query(
      `DROP POLICY IF EXISTS "tenant_rls_delete" ON "tenant";`,
    );

    const tenantMatch =
      "(current_setting('app.tenant_id', true) IS NULL OR id = (current_setting('app.tenant_id', true))::int)";
    const superAdmin =
      "(current_setting('app.is_super_admin', true) = 'true' OR (current_setting('app.current_user_id', true))::int = 1)";

    await sequelize.query(`
      CREATE POLICY "tenant_rls_select" ON "tenant"
      FOR SELECT
      USING (${superAdmin} OR ${tenantMatch});
    `);
    await sequelize.query(`
      CREATE POLICY "tenant_rls_insert" ON "tenant"
      FOR INSERT
      WITH CHECK (${superAdmin});
    `);
    await sequelize.query(`
      CREATE POLICY "tenant_rls_update" ON "tenant"
      FOR UPDATE
      USING (${superAdmin} OR ${tenantMatch})
      WITH CHECK (${superAdmin} OR ${tenantMatch});
    `);
    await sequelize.query(`
      CREATE POLICY "tenant_rls_delete" ON "tenant"
      FOR DELETE
      USING (${superAdmin});
    `);
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.query(
      `DROP POLICY IF EXISTS "tenant_rls_select" ON "tenant";`,
    );
    await sequelize.query(
      `DROP POLICY IF EXISTS "tenant_rls_insert" ON "tenant";`,
    );
    await sequelize.query(
      `DROP POLICY IF EXISTS "tenant_rls_update" ON "tenant";`,
    );
    await sequelize.query(
      `DROP POLICY IF EXISTS "tenant_rls_delete" ON "tenant";`,
    );
  },
};
