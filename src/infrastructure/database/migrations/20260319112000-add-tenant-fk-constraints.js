'use strict';

/**
 * Adds FK constraints for tenant_id columns referencing tenant(id).
 * Also adds FK for tenant_config.tenant_id -> tenant.id.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const addFk = async (table, constraintName) => {
      try {
        await queryInterface.addConstraint(table, {
          fields: ['tenant_id'],
          type: 'foreign key',
          name: constraintName,
          references: { table: 'tenant', field: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        });
      } catch (e) {
        // Be idempotent-ish: ignore if already exists
        if (!e?.message || !String(e.message).includes('already exists')) throw e;
      }
    };

    await addFk('tenant_config', 'fk_tenant_config_tenant_id');

    const tables = [
      'notificacao',
      'movimentacao',
      'login',
      'login_log',
      'medicamento',
      'insumo',
      'residente',
      'armario',
      'gaveta',
      'categoria_armario',
      'categoria_gaveta',
      'estoque_medicamento',
      'estoque_insumo',
      'audit_log',
      'system_config',
    ];

    for (const t of tables) {
      await addFk(t, `fk_${t}_tenant_id`);
    }
  },

  async down(queryInterface) {
    const dropFk = async (table, name) => {
      try {
        await queryInterface.removeConstraint(table, name);
      } catch {
        /* ignore */
      }
    };

    await dropFk('tenant_config', 'fk_tenant_config_tenant_id');

    const tables = [
      'notificacao',
      'movimentacao',
      'login',
      'login_log',
      'medicamento',
      'insumo',
      'residente',
      'armario',
      'gaveta',
      'categoria_armario',
      'categoria_gaveta',
      'estoque_medicamento',
      'estoque_insumo',
      'audit_log',
      'system_config',
    ];

    for (const t of tables) {
      await dropFk(t, `fk_${t}_tenant_id`);
    }
  },
};

