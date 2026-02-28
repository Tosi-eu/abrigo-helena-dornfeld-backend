import { sequelize } from '../database/sequelize';
import express from 'express';
import cookieParser from 'cookie-parser';
import routes from '../web/routes/index.routes';
import {
  setupAssociations,
} from '../database/models/index.models';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { sanitizeInput } from '../../middleware/sanitize.middleware';

function isTestEnv(): boolean {
  return process.env.NODE_ENV === 'test';
}

async function setupDatabase() {
  if (!isTestEnv() && process.env.NODE_ENV === 'production') {
    throw new Error('Sequelize Sync com force bloqueado em produção');
  }

  setupAssociations();
  await sequelize.sync({ force: isTestEnv() });
}

export function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(sanitizeInput);
  app.use('/api/v1', routes);
  app.use(errorHandler);
  return app;
}

export async function setupTestApp() {
  await setupDatabase();
  return createApp();
}

export function getDatabaseConfig() {
  const name =
    process.env.NODE_ENV === 'test'
      ? process.env.TEST_DB_NAME || process.env.DB_NAME || 'estoque_test'
      : process.env.DB_NAME;
  return {
    name,
    user: process.env.DB_USER,
    pass: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
  };
}

export default async function globalTeardown() {
  await sequelize.close();
}
