import 'reflect-metadata';

/**
 * Pipeline de testes: variáveis e regras em jest.env.js (comandadas pelo jest.config.cjs).
 */
const { requireTestEnv, testEnvVars } = require('./jest.env.js');

requireTestEnv();

Object.assign(process.env, testEnvVars);
