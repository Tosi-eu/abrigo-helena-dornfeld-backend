/* eslint-disable @typescript-eslint/no-require-imports -- Jest config is CommonJS */
const { requireTestEnv } = require('./jest.env.js');

requireTestEnv();

/** Aligns with tsconfig (decorators + emitDecoratorMetadata) for NestJS DI in tests */
const swcJestOptions = {
  jsc: {
    parser: {
      syntax: 'typescript',
      tsx: true,
      decorators: true,
      dynamicImport: true,
    },
    transform: {
      legacyDecorator: true,
      decoratorMetadata: true,
    },
    target: 'es2020',
    keepClassNames: true,
  },
  module: {
    type: 'commonjs',
  },
  sourceMaps: 'inline',
};

module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.ts'],

  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.spec.ts'],

  testPathIgnorePatterns: ['/node_modules/'],

  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', swcJestOptions],
  },

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/tests/**',
    '!src/main.ts',
  ],

  clearMocks: true,
  testTimeout: 10000,
  verbose: true,
  maxWorkers: 1,

  globalTeardown: '<rootDir>/jest.teardown.ts',

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  moduleNameMapper: {
    '^@temporal/(.*)$': '<rootDir>/src/temporal/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@repositories/(.*)$': '<rootDir>/src/repositories/$1',
    '^@helpers/(.*)$': '<rootDir>/src/helpers/$1',
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@decorators/(.*)$': '<rootDir>/src/decorators/$1',
    '^@guards/(.*)$': '<rootDir>/src/guards/$1',
    '^@filters/(.*)$': '<rootDir>/src/filters/$1',
    '^@validation/(.*)$': '<rootDir>/src/validation/$1',
    '^@tests/(.*)$': '<rootDir>/src/tests/$1',
  },
};
