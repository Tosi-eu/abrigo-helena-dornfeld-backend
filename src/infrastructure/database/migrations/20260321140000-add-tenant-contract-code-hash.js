'use strict';

const { addColumnIfNotExists } = require('../migration-helpers');

/**
 * Código de contrato (hash): obrigatório no cadastro público quando preenchido pelo admin.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'tenant', 'contract_code_hash', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeColumn('tenant', 'contract_code_hash');
    } catch {
      /* ignore */
    }
  },
};
