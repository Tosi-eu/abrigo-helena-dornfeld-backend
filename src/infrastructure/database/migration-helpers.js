'use strict';

/**
 * Idempotent migration helpers.
 * Use these so migrations can be run multiple times without failing when
 * the change was already applied (e.g. column/table already exists).
 * (Live in database/ so sequelize-cli does not load this as a migration.)
 */

/**
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {string} tableName
 * @param {string} columnName
 * @returns {Promise<boolean>}
 */
async function columnExists(queryInterface, tableName, columnName) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ? AND column_name = ?`,
    {
      replacements: [tableName, columnName],
    },
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {string} tableName
 * @returns {Promise<boolean>}
 */
async function tableExists(queryInterface, tableName) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ?`,
    {
      replacements: [tableName],
    },
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Add column only if it does not exist (idempotent).
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {string} tableName
 * @param {string} columnName
 * @param {object} options - Same as queryInterface.addColumn options
 */
async function addColumnIfNotExists(queryInterface, tableName, columnName, options) {
  const exists = await columnExists(queryInterface, tableName, columnName);
  if (exists) return;
  try {
    await queryInterface.addColumn(tableName, columnName, options);
  } catch (e) {
    if (!e.message || !e.message.includes('already exists')) throw e;
  }
}

/**
 * Remove column only if it exists (idempotent).
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {string} tableName
 * @param {string} columnName
 */
async function removeColumnIfExists(queryInterface, tableName, columnName) {
  const exists = await columnExists(queryInterface, tableName, columnName);
  if (exists) {
    await queryInterface.removeColumn(tableName, columnName);
  }
}

/**
 * Create table only if it does not exist (idempotent).
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {string} tableName
 * @param {object} attributes
 * @param {object} [options]
 */
async function createTableIfNotExists(queryInterface, tableName, attributes, options = {}) {
  const exists = await tableExists(queryInterface, tableName);
  if (!exists) {
    await queryInterface.createTable(tableName, attributes, options);
  }
}

module.exports = {
  columnExists,
  tableExists,
  addColumnIfNotExists,
  removeColumnIfExists,
  createTableIfNotExists,
};
