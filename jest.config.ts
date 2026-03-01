/**
 * Configuração do Jest e do ambiente de teste (raiz do backend).
 * Este arquivo comanda o pipeline de testes: só com NODE_ENV=test o banco e as variáveis de teste são usados.
 * Variáveis de teste em jest.env.js (carregado por este arquivo e por jest.setup).
 */
require('./jest.env.js');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.ts'],

  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.spec.ts'],

  testPathIgnorePatterns: ['/node_modules/'],

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/tests/**',
    '!src/infrastructure/web/main.ts',
    '!src/infrastructure/database/sequelize.ts',
  ],

  clearMocks: true,
  testTimeout: 10000,
  verbose: true,
  maxWorkers: 1,

  globalTeardown: '<rootDir>/jest.teardown.ts',

  moduleFileExtensions: ['ts', 'js', 'json'],
};
