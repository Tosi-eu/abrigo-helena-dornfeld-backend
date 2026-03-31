import { Sequelize } from 'sequelize';
import { createNamespace } from 'cls-hooked';
import dotenv from 'dotenv';
import { getDatabaseConfig } from '../helpers/database-config.helper';

dotenv.config();

export const sequelizeClsNamespace = createNamespace('abrigo-sequelize');
Sequelize.useCLS(sequelizeClsNamespace);

const db = getDatabaseConfig();

export const sequelize = new Sequelize(
  db.name as string,
  db.user as string,
  db.pass as string,
  {
    host: db.host,
    dialect: 'postgres',
    port: db.port,
    logging: false,
    pool: {
      max: Number(process.env.SEQUELIZE_POOL_MAX) || 20,
      min: Number(process.env.SEQUELIZE_POOL_MIN) || 0,
      acquire: Number(process.env.SEQUELIZE_POOL_ACQUIRE_MS) || 30000,
      idle: Number(process.env.SEQUELIZE_POOL_IDLE_MS) || 10000,
    },
  },
);
