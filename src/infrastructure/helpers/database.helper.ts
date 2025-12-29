import { sequelize } from '../database/sequelize';
import express from 'express';
import routes from '../web/routes/index.routes';

async function setupDatabase() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Sequelize Sync com force bloqueado em produção');
  }

  await sequelize.sync({ force: true });
}

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  return app;
}

export async function setupTestApp() {
  await setupDatabase();
  const app = createApp();
  return app;
}

export function getDatabaseConfig() {
  return {
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    pass: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
  };
}

export default async function globalTeardown() {
  await sequelize.close();
}
