'use strict';

const {
  addColumnIfNotExists,
  tableExists,
} = require('../migration-helpers');

/**
 * Repara bases onde a coluna login.tenant_id (e/ou is_super_admin) nunca foi criada
 * ou migrations antigas falharam no meio. Idempotente.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const hasTenantTable = await tableExists(queryInterface, 'tenant');
    if (hasTenantTable) {
      try {
        await queryInterface.sequelize.query(`
          INSERT INTO tenant (id, slug, name, created_at, updated_at)
          SELECT 1, 'default', 'Tenant padrão', NOW(), NOW()
          WHERE NOT EXISTS (SELECT 1 FROM tenant WHERE id = 1);
        `);
      } catch (e) {
        console.warn(
          '[migration] ensure-login-tenant: seed tenant id=1:',
          e?.message || e,
        );
      }
    }

    await addColumnIfNotExists(queryInterface, 'login', 'tenant_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 1,
    });

    await queryInterface.sequelize.query(`
      UPDATE "login" SET tenant_id = 1 WHERE tenant_id IS NULL;
    `);

    await queryInterface.sequelize.query(
      `ALTER TABLE "login" ALTER COLUMN tenant_id SET DEFAULT 1;`,
    );
    const [rows] = await queryInterface.sequelize.query(
      `SELECT is_nullable::text AS n FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'login' AND column_name = 'tenant_id'`,
    );
    if (rows?.[0]?.n === 'YES') {
      await queryInterface.sequelize.query(
        `ALTER TABLE "login" ALTER COLUMN tenant_id SET NOT NULL;`,
      );
    }

    await addColumnIfNotExists(queryInterface, 'login', 'is_super_admin', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.sequelize.query(`
      UPDATE "login" SET is_super_admin = true WHERE id = 1;
    `);

    try {
      await queryInterface.addIndex('login', ['tenant_id']);
    } catch (e) {
      if (!e?.message || !String(e.message).includes('already exists')) throw e;
    }

    try {
      await queryInterface.removeIndex('login', 'idx_login_login_unique');
    } catch {
      /* ignore */
    }

    try {
      await queryInterface.addIndex('login', ['tenant_id', 'login'], {
        name: 'idx_login_tenant_login_unique',
        unique: true,
      });
    } catch (e) {
      if (!e?.message || !String(e.message).includes('already exists')) throw e;
    }

    if (hasTenantTable) {
      try {
        await queryInterface.addConstraint('login', {
          fields: ['tenant_id'],
          type: 'foreign key',
          name: 'fk_login_tenant_id',
          references: { table: 'tenant', field: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        });
      } catch (e) {
        const msg = String(e?.message || '');
        if (
          !msg.includes('already exists') &&
          !msg.includes('duplicate') &&
          !msg.includes('fk_login_tenant_id')
        ) {
          throw e;
        }
      }
    }
  },

  async down() {
    // Não remove colunas: pode quebrar app em produção.
  },
};
