/**
 * Variáveis e regras do ambiente de teste.
 * Carregado por jest.config.cjs e jest.setup.ts.
 */

const TEST_DB_NAME_DEFAULT = 'estoque_test';

const testEnvVars = {
  NODE_ENV: 'test',
  DB_NAME: process.env.TEST_DB_NAME || TEST_DB_NAME_DEFAULT,
  JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost',
  /** Usado por e2e de `/admin/tenants` e testes que chamam `requireSuperAdminOrApiKey`. */
  X_API_KEY: process.env.X_API_KEY || 'jest-test-x-api-key',
};

function requireTestEnv() {
  if (process.env.NODE_ENV !== undefined && process.env.NODE_ENV !== 'test') {
    throw new Error(
      `Ambiente não é teste (NODE_ENV=${process.env.NODE_ENV}). Defina NODE_ENV=test para rodar o pipeline de testes.`,
    );
  }
}

module.exports = { testEnvVars, requireTestEnv };
