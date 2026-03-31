'use strict';

const { addColumnIfNotExists, tableExists } = require('../migration-helpers');

/**
 * Mesma lista que 20260319093000-add-tenant-id-all-tables (tabelas com coluna tenant_id).
 * Precisa existir *antes* das políticas RLS que referenciam tenant_id — esta migration
 * roda em 20260223 e a antiga 20260319 ainda não tinha sido executada.
 */
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
];

async function ensureTenantIdColumns(queryInterface, Sequelize) {
  for (const table of TABLES_WITH_TENANT_ID) {
    if (!(await tableExists(queryInterface, table))) continue;
    await addColumnIfNotExists(queryInterface, table, 'tenant_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 1,
    });
    await queryInterface.sequelize.query(
      `UPDATE "${table}" SET tenant_id = 1 WHERE tenant_id IS NULL;`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE "${table}" ALTER COLUMN tenant_id SET DEFAULT 1;`,
    );
    const [nullRows] = await queryInterface.sequelize.query(
      `SELECT is_nullable::text AS n FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = :t AND column_name = 'tenant_id'`,
      { replacements: { t: table } },
    );
    if (nullRows?.[0]?.n === 'YES') {
      await queryInterface.sequelize.query(
        `ALTER TABLE "${table}" ALTER COLUMN tenant_id SET NOT NULL;`,
      );
    }
    try {
      await queryInterface.addIndex(table, ['tenant_id']);
    } catch (e) {
      if (!e?.message || !String(e.message).includes('already exists')) throw e;
    }
  }
}

/** A tabela `tenant` não tem coluna tenant_id; o escopo é por `id`. */
function tenantClauseForTable(table) {
  if (table === 'tenant') {
    return "(current_setting('app.tenant_id', true) IS NULL OR id = (current_setting('app.tenant_id', true))::int)";
  }
  return "(current_setting('app.tenant_id', true) IS NULL OR tenant_id = (current_setting('app.tenant_id', true))::int)";
}

/**
 * RLS com dois níveis (admin id=1 vs demais).
 * Pré-condição: colunas tenant_id nas tabelas de dados (garantido acima).
 * Tabelas tenant / tenant_config podem ainda não existir — ignoradas até existirem.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await ensureTenantIdColumns(queryInterface, Sequelize);

    const { sequelize } = queryInterface;
    const adminOnly =
      "(current_setting('app.current_user_id', true) IS NULL OR (current_setting('app.current_user_id', true))::int = 1)";

    const allTables = [
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
      'tenant',
      'tenant_config',
    ];

    for (const table of allTables) {
      if (!(await tableExists(queryInterface, table))) continue;

      const tenantMatch = tenantClauseForTable(table);

      await sequelize.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`,
      );
      await sequelize.query(`
        CREATE POLICY "${table}_rls_select" ON "${table}"
        FOR SELECT
        USING (${tenantMatch});
      `);
      await sequelize.query(`
        CREATE POLICY "${table}_rls_insert" ON "${table}"
        FOR INSERT
        WITH CHECK (${adminOnly} AND ${tenantMatch});
      `);
      await sequelize.query(`
        CREATE POLICY "${table}_rls_update" ON "${table}"
        FOR UPDATE
        USING (${adminOnly} AND ${tenantMatch})
        WITH CHECK (${adminOnly} AND ${tenantMatch});
      `);
      await sequelize.query(`
        CREATE POLICY "${table}_rls_delete" ON "${table}"
        FOR DELETE
        USING (${adminOnly} AND ${tenantMatch});
      `);
    }
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    const allTables = [
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
      'tenant',
      'tenant_config',
    ];

    const policySuffixes = ['select', 'insert', 'update', 'delete'];
    for (const table of allTables) {
      if (!(await tableExists(queryInterface, table))) continue;
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
