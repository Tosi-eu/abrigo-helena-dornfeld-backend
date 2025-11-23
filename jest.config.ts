/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",

  setupFiles: ["./jest.setup.ts"],

  testMatch: [
    "**/tests/**/*.test.ts",
    "**/tests/**/*.spec.ts"
  ],

  testPathIgnorePatterns: ["/node_modules/"],

  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/tests/**",
    "!src/infrastructure/web/main.ts",
    "!src/infrastructure/database/sequelize.ts"
  ],

  clearMocks: true,
  testTimeout: 10000,
  verbose: true,

  moduleFileExtensions: ["ts", "js", "json"]
};