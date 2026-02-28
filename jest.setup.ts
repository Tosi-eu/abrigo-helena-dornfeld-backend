/**
 * Pipeline de testes: variáveis e regras em jest.env.js (comandadas pelo jest.config.ts).
 */
const { requireTestEnv, testEnvVars } = require('./jest.env.js');

requireTestEnv();

Object.assign(process.env, testEnvVars);
