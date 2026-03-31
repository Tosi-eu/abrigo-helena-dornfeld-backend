'use strict';

/**
 * Shared tenant for “modo de visualização” (signup via register-user).
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const modulesJson = JSON.stringify({
      enabled: [
        'dashboard',
        'residents',
        'medicines',
        'inputs',
        'stock',
        'movements',
        'reports',
        'notifications',
        'cabinets',
        'drawers',
        'profile',
      ],
    });

    await queryInterface.sequelize.query(
      `
      INSERT INTO tenant (slug, name, created_at, updated_at)
      SELECT 'viewer', 'Modo de visualização', NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM tenant WHERE slug = 'viewer');
      `,
    );

    await queryInterface.sequelize.query(
      `
      INSERT INTO tenant_config (tenant_id, modules_json, created_at, updated_at)
      SELECT t.id, :modules_json::jsonb, NOW(), NOW()
      FROM tenant t
      WHERE t.slug = 'viewer'
        AND NOT EXISTS (
          SELECT 1 FROM tenant_config tc WHERE tc.tenant_id = t.id
        );
      `,
      { replacements: { modules_json: modulesJson } },
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM tenant_config
      WHERE tenant_id IN (SELECT id FROM tenant WHERE slug = 'viewer');
      DELETE FROM tenant WHERE slug = 'viewer';
    `);
  },
};
