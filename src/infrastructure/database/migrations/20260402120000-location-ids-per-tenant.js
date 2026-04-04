'use strict';

/**
 * Converts location-like tables that used global numeric PKs into:
 * - surrogate PK `id`
 * - per-tenant uniqueness on (tenant_id, number)
 *
 * This enables tenants to reuse the same numbers (casela/armario/gaveta).
 *
 * NOTE: Existing foreign keys were not relying on these PKs (stocks/movements store numbers),
 * so this migration only changes PK/uniqueness.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;

    const steps = [
      {
        table: 'residente',
        numCol: 'num_casela',
        uniqName: 'uq_residente_tenant_num_casela',
        pkName: 'residente_pkey',
      },
      {
        table: 'armario',
        numCol: 'num_armario',
        uniqName: 'uq_armario_tenant_num_armario',
        pkName: 'armario_pkey',
      },
      {
        table: 'gaveta',
        numCol: 'num_gaveta',
        uniqName: 'uq_gaveta_tenant_num_gaveta',
        pkName: 'gaveta_pkey',
      },
    ];

    for (const s of steps) {
      await sequelize.query(
        `ALTER TABLE "${s.table}" ADD COLUMN IF NOT EXISTS "id" BIGSERIAL;`,
      );
      await sequelize.query(
        `UPDATE "${s.table}" SET id = DEFAULT WHERE id IS NULL;`,
      );
      await sequelize.query(
        `ALTER TABLE "${s.table}" ALTER COLUMN "id" SET NOT NULL;`,
      );

      // Drop old PK on the numeric column (global uniqueness).
      await sequelize.query(
        `ALTER TABLE "${s.table}" DROP CONSTRAINT IF EXISTS "${s.pkName}";`,
      );
      await sequelize.query(
        `ALTER TABLE "${s.table}" ADD CONSTRAINT "${s.pkName}" PRIMARY KEY ("id");`,
      );

      // Enforce per-tenant uniqueness.
      await sequelize.query(
        `ALTER TABLE "${s.table}" ADD CONSTRAINT "${s.uniqName}" UNIQUE ("tenant_id", "${s.numCol}");`,
      );
    }
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;

    const steps = [
      {
        table: 'residente',
        numCol: 'num_casela',
        uniqName: 'uq_residente_tenant_num_casela',
        pkName: 'residente_pkey',
      },
      {
        table: 'armario',
        numCol: 'num_armario',
        uniqName: 'uq_armario_tenant_num_armario',
        pkName: 'armario_pkey',
      },
      {
        table: 'gaveta',
        numCol: 'num_gaveta',
        uniqName: 'uq_gaveta_tenant_num_gaveta',
        pkName: 'gaveta_pkey',
      },
    ];

    for (const s of steps) {
      await sequelize.query(
        `ALTER TABLE "${s.table}" DROP CONSTRAINT IF EXISTS "${s.uniqName}";`,
      );
      await sequelize.query(
        `ALTER TABLE "${s.table}" DROP CONSTRAINT IF EXISTS "${s.pkName}";`,
      );
      await sequelize.query(
        `ALTER TABLE "${s.table}" ADD CONSTRAINT "${s.pkName}" PRIMARY KEY ("${s.numCol}");`,
      );
      await sequelize.query(`ALTER TABLE "${s.table}" DROP COLUMN IF EXISTS "id";`);
    }
  },
};

