require('dotenv').config();

/**
 * Config do Sequelize CLI (migrations/seed). Regra alinhada ao jest.config.ts (raiz do backend).
 * NODE_ENV comanda: só com NODE_ENV=test usamos banco de teste (estoque_test).
 */
const defaultPort = Number(process.env.DB_PORT) || 5432;
const isTestEnv = process.env.NODE_ENV === 'test';

const base = {
  dialect: 'postgres',
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || (isTestEnv ? 'localhost' : undefined),
  port: defaultPort,
};

module.exports = {
  development: { ...base, database: process.env.DB_NAME },
  test: { ...base, database: process.env.TEST_DB_NAME || 'estoque_test' },
  production: { ...base, database: process.env.DB_NAME },
};
