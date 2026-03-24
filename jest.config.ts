/* eslint-disable @typescript-eslint/no-require-imports -- jest.config carrega jest.env.js em CJS */
const { requireTestEnv } = require('./jest.env.js') as {
  requireTestEnv: () => void;
};

requireTestEnv();

export default {
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
