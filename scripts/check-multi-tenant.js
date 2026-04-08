/* eslint-disable no-console */
const { Client } = require('pg');

async function main() {
  const url =
    process.env.DATABASE_URL ||
    `postgres://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'postgres'}`;

  const client = new Client({ connectionString: url });
  try {
    await client.connect();

    const requiredTables = [
      'tenant',
      'tenant_config',
      'medicamento',
      'insumo',
      'residente',
      'estoque_medicamento',
      'estoque_insumo',
      'movimentacao',
      'notificacao',
      'audit_log',
      'login',
      'login_log',
    ];

    for (const t of requiredTables) {
      const { rows } = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = 'tenant_id'`,
        [t],
      );
      // Tabelas "globais" (sem scoping por tenant) não exigem tenant_id.
      if (t === 'tenant' || t === 'tenant_config') continue;
      if (!rows || rows.length === 0) {
        throw new Error(`missing tenant_id column on ${t}`);
      }
    }

    const { rows: tenants } = await client.query(
      `SELECT id, slug, name FROM tenant ORDER BY id ASC LIMIT 10`,
    );
    console.log('Tenants:', tenants);

    await client.query(`SELECT set_config('app.tenant_id', '1', true)`);
    await client.query(`SELECT set_config('app.current_user_id', '1', true)`);

    console.log('OK: multi-tenant baseline looks present.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('FAILED:', e.message || e);
  process.exit(1);
});
