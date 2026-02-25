'use strict';

/**
 * RLS with two access levels:
 * - Admin (user id = 1): full read and write (SELECT, INSERT, UPDATE, DELETE).
 * - User (other users): read-only — can SELECT everything, cannot INSERT, UPDATE, or DELETE.
 *
 * Session variable: app.current_user_id (set by rls.context.ts / rlsContextMiddleware).
 * When not set (request not using withRlsContext): allow all (backward compatible).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    const adminOnly =
      "(current_setting('app.current_user_id', true) IS NULL OR (current_setting('app.current_user_id', true))::int = 1)";

    const allTables = [
      'notificacao',
      'movimentacao',
      'login',
      'medicamento',
      'insumo',
      'residente',
      'armario',
      'gaveta',
      'categoria_armario',
      'categoria_gaveta',
      'estoque_medicamento',
      'estoque_insumo',
    ];

    for (const table of allTables) {
      await sequelize.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`,
      );
      // Read: everyone can SELECT
      await sequelize.query(`
        CREATE POLICY "${table}_rls_select" ON "${table}"
        FOR SELECT
        USING (true);
      `);
      // Write: only admin (or unset for backward compat)
      await sequelize.query(`
        CREATE POLICY "${table}_rls_insert" ON "${table}"
        FOR INSERT
        WITH CHECK (${adminOnly});
      `);
      await sequelize.query(`
        CREATE POLICY "${table}_rls_update" ON "${table}"
        FOR UPDATE
        USING (${adminOnly})
        WITH CHECK (${adminOnly});
      `);
      await sequelize.query(`
        CREATE POLICY "${table}_rls_delete" ON "${table}"
        FOR DELETE
        USING (${adminOnly});
      `);
    }
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    const allTables = [
      'notificacao',
      'movimentacao',
      'login',
      'medicamento',
      'insumo',
      'residente',
      'armario',
      'gaveta',
      'categoria_armario',
      'categoria_gaveta',
      'estoque_medicamento',
      'estoque_insumo',
    ];

    const policySuffixes = ['select', 'insert', 'update', 'delete'];
    for (const table of allTables) {
      for (const suffix of policySuffixes) {
        await sequelize.query(
          `DROP POLICY IF EXISTS "${table}_rls_${suffix}" ON "${table}";`,
        );
      }
      await sequelize.query(
        `ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY;`,
      );
    }
  },
};
