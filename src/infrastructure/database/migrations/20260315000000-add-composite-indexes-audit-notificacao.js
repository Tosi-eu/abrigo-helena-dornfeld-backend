'use strict';

/**
 * Composite indexes for audit_log and notificacao to optimize common filter patterns.
 * audit_log: (created_at, operation_type), (created_at, user_id) for audit insights
 * notificacao: data_prevista, composite (data_prevista, status), (data_prevista, tipo_evento)
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const addIndexIfNotExists = async (table, fields, opts = {}) => {
      try {
        await queryInterface.addIndex(table, fields, opts);
      } catch (e) {
        if (!e.message || !e.message.includes('already exists')) throw e;
      }
    };

    await addIndexIfNotExists('audit_log', ['created_at', 'operation_type'], {
      name: 'idx_audit_log_created_at_operation_type',
    });
    await addIndexIfNotExists('audit_log', ['created_at', 'user_id'], {
      name: 'idx_audit_log_created_at_user_id',
    });

    await addIndexIfNotExists('notificacao', ['data_prevista'], {
      name: 'idx_notificacao_data_prevista',
    });
    await addIndexIfNotExists('notificacao', ['data_prevista', 'status'], {
      name: 'idx_notificacao_data_prevista_status',
    });
    await addIndexIfNotExists('notificacao', ['data_prevista', 'tipo_evento'], {
      name: 'idx_notificacao_data_prevista_tipo_evento',
    });
  },

  async down(queryInterface) {
    const removeIndexIfExists = async (table, indexName) => {
      try {
        await queryInterface.removeIndex(table, indexName);
      } catch (_) {}
    };

    await removeIndexIfExists(
      'audit_log',
      'idx_audit_log_created_at_operation_type',
    );
    await removeIndexIfExists('audit_log', 'idx_audit_log_created_at_user_id');
    await removeIndexIfExists('notificacao', 'idx_notificacao_data_prevista');
    await removeIndexIfExists(
      'notificacao',
      'idx_notificacao_data_prevista_status',
    );
    await removeIndexIfExists(
      'notificacao',
      'idx_notificacao_data_prevista_tipo_evento',
    );
  },
};
