'use strict';

/**
 * Changes audit_log.old_value and new_value from TEXT to JSONB for structured querying and API.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE audit_log
      ALTER COLUMN old_value TYPE jsonb
      USING (CASE WHEN old_value IS NULL OR trim(old_value) = '' THEN NULL ELSE old_value::jsonb END);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE audit_log
      ALTER COLUMN new_value TYPE jsonb
      USING (CASE WHEN new_value IS NULL OR trim(new_value) = '' THEN NULL ELSE new_value::jsonb END);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE audit_log
      ALTER COLUMN old_value TYPE text USING (old_value::text);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE audit_log
      ALTER COLUMN new_value TYPE text USING (new_value::text);
    `);
  },
};
