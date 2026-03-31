'use strict';

const { addColumnIfNotExists } = require('../migration-helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contract_portfolio', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      contract_code_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await addColumnIfNotExists(
      queryInterface,
      'tenant',
      'contract_portfolio_id',
      {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'contract_portfolio', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
    );

    const [rows] = await queryInterface.sequelize.query(
      `SELECT id, contract_code_hash FROM tenant WHERE contract_code_hash IS NOT NULL`,
    );
    const list = Array.isArray(rows) ? rows : [];
    for (const row of list) {
      const tid = row.id;
      const hash = row.contract_code_hash;
      if (!tid || !hash) continue;
      const [inserted] = await queryInterface.sequelize.query(
        `INSERT INTO contract_portfolio (contract_code_hash, created_at, updated_at)
         VALUES ($1, NOW(), NOW())
         RETURNING id`,
        { bind: [String(hash)] },
      );
      const pid =
        Array.isArray(inserted) && inserted[0] && inserted[0].id != null
          ? inserted[0].id
          : null;
      if (pid != null) {
        await queryInterface.sequelize.query(
          `UPDATE tenant SET contract_portfolio_id = $1 WHERE id = $2`,
          { bind: [pid, tid] },
        );
      }
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeColumn('tenant', 'contract_portfolio_id');
    } catch {
      /* ignore */
    }
    try {
      await queryInterface.dropTable('contract_portfolio');
    } catch {
      /* ignore */
    }
  },
};
