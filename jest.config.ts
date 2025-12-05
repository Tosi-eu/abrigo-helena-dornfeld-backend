module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",

  testMatch: [
    "**/tests/**/*.test.ts",
    "**/tests/**/*.spec.ts"
  ],

  testPathIgnorePatterns: ["/node_modules/"],

  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/tests/**",
    "!src/infrastructure/web/main.ts",
    "!src/infrastructure/database/sequelize.ts",
  ],

  clearMocks: true,
  testTimeout: 10000,
  verbose: true,
  maxWorkers: 1,

  globalTeardown: "<rootDir>/jest.teardown.ts",

  moduleFileExtensions: ["ts", "js", "json"]
};
