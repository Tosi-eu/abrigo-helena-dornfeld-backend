'use strict';

/**
 * Updates RLS write policies to use granular permissions.
 * Session vars: app.current_user_id, app.user_can_create, app.user_can_update, app.user_can_delete.
 * - Admin (user id = 1): full access (unchanged).
 * - Others: INSERT/UPDATE/DELETE allowed only when corresponding permission is 'true'.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
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

    const insertExpr =
      "(current_setting('app.current_user_id', true) IS NULL OR (current_setting('app.current_user_id', true))::int = 1 OR current_setting('app.user_can_create', true) = 'true')";
    const updateExpr =
      "(current_setting('app.current_user_id', true) IS NULL OR (current_setting('app.current_user_id', true))::int = 1 OR current_setting('app.user_can_update', true) = 'true')";
    const deleteExpr =
      "(current_setting('app.current_user_id', true) IS NULL OR (current_setting('app.current_user_id', true))::int = 1 OR current_setting('app.user_can_delete', true) = 'true')";

    for (const table of allTables) {
      await sequelize.query(
        `DROP POLICY IF EXISTS "${table}_rls_insert" ON "${table}";`,
      );
      await sequelize.query(
        `DROP POLICY IF EXISTS "${table}_rls_update" ON "${table}";`,
      );
      await sequelize.query(
        `DROP POLICY IF EXISTS "${table}_rls_delete" ON "${table}";`,
      );

      await sequelize.query(`
        CREATE POLICY "${table}_rls_insert" ON "${table}"
        FOR INSERT WITH CHECK (${insertExpr});
      `);
      await sequelize.query(`
        CREATE POLICY "${table}_rls_update" ON "${table}"
        FOR UPDATE USING (${updateExpr}) WITH CHECK (${updateExpr});
      `);
      await sequelize.query(`
        CREATE POLICY "${table}_rls_delete" ON "${table}"
        FOR DELETE USING (${deleteExpr});
      `);
    }
  },

  async down(queryInterface) {
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
        `DROP POLICY IF EXISTS "${table}_rls_insert" ON "${table}";`,
      );
      await sequelize.query(
        `DROP POLICY IF EXISTS "${table}_rls_update" ON "${table}";`,
      );
      await sequelize.query(
        `DROP POLICY IF EXISTS "${table}_rls_delete" ON "${table}";`,
      );

      await sequelize.query(`
        CREATE POLICY "${table}_rls_insert" ON "${table}"
        FOR INSERT WITH CHECK (${adminOnly});
      `);
      await sequelize.query(`
        CREATE POLICY "${table}_rls_update" ON "${table}"
        FOR UPDATE USING (${adminOnly}) WITH CHECK (${adminOnly});
      `);
      await sequelize.query(`
        CREATE POLICY "${table}_rls_delete" ON "${table}"
        FOR DELETE USING (${adminOnly});
      `);
    }
  },
};
