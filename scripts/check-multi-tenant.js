/* eslint-disable no-console */
const { Sequelize } = require('sequelize');

async function main() {
  const url =
    process.env.DATABASE_URL ||
    `postgres://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'postgres'}`;

  const sequelize = new Sequelize(url, { logging: false });
  try {
    await sequelize.authenticate();

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
      'system_config',
      'audit_log',
      'login',
      'login_log',
    ];

    for (const t of requiredTables) {
      const [rows] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = :t AND column_name = 'tenant_id'`,
        { replacements: { t } },
      );
      if (t === 'tenant' || t === 'tenant_config') continue;
      if (!rows || rows.length === 0) {
        throw new Error(`missing tenant_id column on ${t}`);
      }
    }

    const [tenants] = await sequelize.query(`SELECT id, slug, name FROM tenant ORDER BY id ASC LIMIT 10`);
    console.log('Tenants:', tenants);

    // RLS vars sanity (does not validate policies fully; just ensures settings work)
    await sequelize.query(`SELECT set_config('app.tenant_id', '1', true)`);
    await sequelize.query(`SELECT set_config('app.current_user_id', '1', true)`);

    console.log('OK: multi-tenant baseline looks present.');
  } finally {
    await sequelize.close();
  }
}

main().catch((e) => {
  console.error('FAILED:', e.message || e);
  process.exit(1);
});

