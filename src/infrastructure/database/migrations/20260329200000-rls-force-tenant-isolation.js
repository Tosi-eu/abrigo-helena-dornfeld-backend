'use strict';

const { tableExists } = require('../migration-helpers');

/**
 * 1) FORCE ROW LEVEL SECURITY — o owner da tabela deixa de ignorar RLS.
 * 2) Políticas estritas: só super-admin ou tenant_id = app.tenant_id (sem bypass por sessão vazia).
 * 3) Exceções explícitas via GUCs: público (directory), self-registration, viewer, resolução de e-mail, convite.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;

    const insertExpr = `(current_setting('app.current_user_id', true) IS NULL OR (current_setting('app.current_user_id', true))::int = 1 OR current_setting('app.user_can_create', true) = 'true')`;
    const updateExpr = `(current_setting('app.current_user_id', true) IS NULL OR (current_setting('app.current_user_id', true))::int = 1 OR current_setting('app.user_can_update', true) = 'true')`;
    const deleteExpr = `(current_setting('app.current_user_id', true) IS NULL OR (current_setting('app.current_user_id', true))::int = 1 OR current_setting('app.user_can_delete', true) = 'true')`;

    const isSuper = `(current_setting('app.is_super_admin', true) = 'true')`;
    const tenantColMatch = `(${isSuper} OR tenant_id = (NULLIF(current_setting('app.tenant_id', true), ''))::int)`;

    const loginSelectExtra = `OR (current_setting('app.allow_email_resolution', true) = 'true' AND LOWER(TRIM(BOTH FROM "login")) = LOWER(TRIM(BOTH FROM current_setting('app.resolution_login', true))))`;

    const TABLES_WITH_TENANT_ID = [
      'notificacao',
      'movimentacao',
      'login',
      'login_log',
      'medicamento',
      'insumo',
      'residente',
      'armario',
      'gaveta',
      'categoria_armario',
      'categoria_gaveta',
      'estoque_medicamento',
      'estoque_insumo',
      'audit_log',
      'system_config',
      'tenant_config',
    ];

    for (const table of TABLES_WITH_TENANT_ID) {
      if (!(await tableExists(queryInterface, table))) continue;
      for (const s of ['select', 'insert', 'update', 'delete']) {
        await sequelize.query(
          `DROP POLICY IF EXISTS "${table}_rls_${s}" ON "${table}";`,
        );
      }
      await sequelize.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`,
      );
      await sequelize.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);

      const selectUsing =
        table === 'login'
          ? `(${tenantColMatch} ${loginSelectExtra})`
          : `${tenantColMatch}`;

      await sequelize.query(`
        CREATE POLICY "${table}_rls_select" ON "${table}" FOR SELECT USING (${selectUsing});
      `);
      await sequelize.query(`
        CREATE POLICY "${table}_rls_insert" ON "${table}" FOR INSERT WITH CHECK (${insertExpr} AND (${tenantColMatch}));
      `);
      await sequelize.query(`
        CREATE POLICY "${table}_rls_update" ON "${table}" FOR UPDATE USING (${updateExpr} AND (${tenantColMatch})) WITH CHECK (${updateExpr} AND (${tenantColMatch}));
      `);
      await sequelize.query(`
        CREATE POLICY "${table}_rls_delete" ON "${table}" FOR DELETE USING (${deleteExpr} AND (${tenantColMatch}));
      `);
    }

    if (await tableExists(queryInterface, 'tenant')) {
      for (const s of ['select', 'insert', 'update', 'delete']) {
        await sequelize.query(
          `DROP POLICY IF EXISTS "tenant_rls_${s}" ON "tenant";`,
        );
      }
      await sequelize.query(`ALTER TABLE "tenant" ENABLE ROW LEVEL SECURITY;`);
      await sequelize.query(`ALTER TABLE "tenant" FORCE ROW LEVEL SECURITY;`);

      const tenantRowCore = `(${isSuper} OR id = (NULLIF(current_setting('app.tenant_id', true), ''))::int)`;
      const tenantPublicOrReg = `OR current_setting('app.allow_public_directory', true) = 'true' OR current_setting('app.allow_tenant_self_registration', true) = 'true' OR (current_setting('app.allow_viewer_only_lookup', true) = 'true' AND slug = 'viewer')`;
      const tenantEmailIn = `OR (current_setting('app.allow_email_resolution', true) = 'true' AND id IN (SELECT l.tenant_id FROM login l WHERE LOWER(TRIM(BOTH FROM l.login)) = LOWER(TRIM(BOTH FROM current_setting('app.resolution_login', true)))))`;

      await sequelize.query(`
        CREATE POLICY "tenant_rls_select" ON "tenant" FOR SELECT USING (${tenantRowCore} ${tenantPublicOrReg} ${tenantEmailIn});
      `);
      await sequelize.query(`
        CREATE POLICY "tenant_rls_insert" ON "tenant" FOR INSERT WITH CHECK (${isSuper} OR current_setting('app.allow_tenant_self_registration', true) = 'true');
      `);
      await sequelize.query(`
        CREATE POLICY "tenant_rls_update" ON "tenant" FOR UPDATE USING (${tenantRowCore}) WITH CHECK (${tenantRowCore});
      `);
      await sequelize.query(`
        CREATE POLICY "tenant_rls_delete" ON "tenant" FOR DELETE USING (${isSuper});
      `);
    }

    if (await tableExists(queryInterface, 'tenant_invite')) {
      for (const s of ['select', 'insert', 'update', 'delete']) {
        await sequelize.query(
          `DROP POLICY IF EXISTS "tenant_invite_rls_${s}" ON "tenant_invite";`,
        );
      }
      await sequelize.query(
        `ALTER TABLE "tenant_invite" ENABLE ROW LEVEL SECURITY;`,
      );
      await sequelize.query(
        `ALTER TABLE "tenant_invite" FORCE ROW LEVEL SECURITY;`,
      );

      const inviteRow = `(${isSuper} OR tenant_id = (NULLIF(current_setting('app.tenant_id', true), ''))::int OR token_digest = current_setting('app.invite_token_digest', true))`;

      await sequelize.query(`
        CREATE POLICY "tenant_invite_rls_select" ON "tenant_invite" FOR SELECT USING (${inviteRow});
      `);
      await sequelize.query(`
        CREATE POLICY "tenant_invite_rls_insert" ON "tenant_invite" FOR INSERT WITH CHECK (${insertExpr} AND (${tenantColMatch}));
      `);
      await sequelize.query(`
        CREATE POLICY "tenant_invite_rls_update" ON "tenant_invite" FOR UPDATE USING (${updateExpr} AND (${tenantColMatch})) WITH CHECK (${updateExpr} AND (${tenantColMatch}));
      `);
      await sequelize.query(`
        CREATE POLICY "tenant_invite_rls_delete" ON "tenant_invite" FOR DELETE USING (${deleteExpr} AND (${tenantColMatch}));
      `);
    }
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    const tables = [
      'notificacao',
      'movimentacao',
      'login',
      'login_log',
      'medicamento',
      'insumo',
      'residente',
      'armario',
      'gaveta',
      'categoria_armario',
      'categoria_gaveta',
      'estoque_medicamento',
      'estoque_insumo',
      'audit_log',
      'system_config',
      'tenant_config',
      'tenant',
      'tenant_invite',
    ];
    for (const table of tables) {
      if (!(await tableExists(queryInterface, table))) continue;
      try {
        await sequelize.query(
          `ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY;`,
        );
      } catch {
        /* ignore */
      }
    }
  },
};
