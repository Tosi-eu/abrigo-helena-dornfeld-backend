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
  const env = process.env.NODE_ENV || 'development';

  if (env === 'production') {
    return {
      name: process.env.PRD_DB_NAME,
      user: process.env.PRD_DB_USER,
      pass: process.env.PRD_DB_PASSWORD,
      host: process.env.PRD_DB_HOST,
      port: Number(process.env.PRD_DB_PORT) || 5432,
    };
  }

  return {
    name: process.env.HML_DB_NAME,
    user: process.env.HML_DB_USER,
    pass: process.env.HML_DB_PASSWORD,
    host: process.env.HML_DB_HOST,
    port: Number(process.env.HML_DB_PORT) || 5432,
  };
}

export default async function globalTeardown() {
  await sequelize.close();
}
