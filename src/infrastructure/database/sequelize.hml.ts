import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import { getDatabaseConfig } from "../helpers/database.helper";

dotenv.config();

const db = getDatabaseConfig();

export const sequelize = new Sequelize(
  db.name as string,
  db.user as string,
  db.pass as string,
  {
    host: db.host,
    dialect: "postgres",
    port: db.port,
    logging: false,
    pool: {
      max: 1,
      min: 0,
      acquire: 5000,
      idle: 5000,
    },
  }
);
