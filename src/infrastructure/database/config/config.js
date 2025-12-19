require('dotenv').config();

const common = {
  dialect: 'postgres',
};

module.exports = {
  development: {
    ...common,
    database: process.env.HML_DB_NAME,
    username: process.env.HML_DB_USER,
    password: process.env.HML_DB_PASSWORD,
    host: process.env.HML_DB_HOST,
    port: process.env.HML_DB_PORT,
  },

  production: {
    ...common,
    database: process.env.PRD_DB_NAME,
    username: process.env.PRD_DB_USER,
    password: process.env.PRD_DB_PASSWORD,
    host: process.env.PRD_DB_HOST,
    port: process.env.PRD_DB_PORT,
  },
};
