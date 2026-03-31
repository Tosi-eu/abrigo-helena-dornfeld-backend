'use strict';

/**
 * Remove coluna legada logo_data_url (base64); logos usam apenas logo_url (R2).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    try {
      await queryInterface.removeColumn('tenant', 'logo_data_url');
    } catch {
      /* coluna já inexistente */
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('tenant', 'logo_data_url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
};
