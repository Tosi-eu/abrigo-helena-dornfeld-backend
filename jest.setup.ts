import 'reflect-metadata';

const { requireTestEnv, testEnvVars } = require('./jest.env.js');

requireTestEnv();

Object.assign(process.env, testEnvVars);
