import { sequelize } from '../database/sequelize';
import express from 'express';
import cookieParser from 'cookie-parser';
import routes from '../web/routes/index.routes';
import {
  setupAssociations,
} from '../database/models/index.models';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { getDatabaseConfig } from './database-config.helper';

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
  app.use('/api/v1', routes);
  app.use(errorHandler);
  return app;
}

export async function setupTestApp() {
  await setupDatabase();
  return createApp();
}

export { getDatabaseConfig };

export default async function globalTeardown() {
  await sequelize.close();
}
