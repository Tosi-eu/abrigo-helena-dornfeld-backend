require('dotenv').config();

module.exports = {
  development: {
    username: process.env.HML_DB_USER,
    password: process.env.HML_DB_PASSWORD,
    database: process.env.HML_DB_NAME,
    host: process.env.HML_DB_HOST,
    port: process.env.HML_DB_PORT,
    dialect: 'postgres',
  },

  production: {
    username: process.env.PRD_DB_USER,
    password: process.env.PRD_DB_PASSWORD,
    database: process.env.PRD_DB_NAME,
    host: process.env.PRD_DB_HOST,
    port: process.env.PRD_DB_PORT,
    dialect: 'postgres',
  },
};
