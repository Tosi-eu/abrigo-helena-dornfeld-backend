'use strict';

/**
 * Performance indexes for heavily used filters and joins.
 * - movimentacao: data (range queries), medicamento_id, insumo_id, tipo (filters)
 * - estoque_medicamento / estoque_insumo: validade, quantidade, armario_id, gaveta_id, casela_id, setor
 * - login: ensure UNIQUE on login for lookups
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const addIndexIfNotExists = async (table, fields, opts) => {
      try {
        await queryInterface.addIndex(table, fields, opts);
      } catch (e) {
        if (!e.message || !e.message.includes('already exists')) throw e;
      }
    };
    await addIndexIfNotExists('movimentacao', ['data'], {
      name: 'idx_movimentacao_data',
    });
    await addIndexIfNotExists('movimentacao', ['medicamento_id'], {
      name: 'idx_movimentacao_medicamento_id',
    });
    await addIndexIfNotExists('movimentacao', ['insumo_id'], {
      name: 'idx_movimentacao_insumo_id',
    });
    await addIndexIfNotExists('movimentacao', ['tipo'], {
      name: 'idx_movimentacao_tipo',
    });

    await addIndexIfNotExists('estoque_medicamento', ['validade'], {
      name: 'idx_estoque_medicamento_validade',
    });
    await addIndexIfNotExists('estoque_medicamento', ['quantidade'], {
      name: 'idx_estoque_medicamento_quantidade',
    });
    await addIndexIfNotExists('estoque_medicamento', ['armario_id'], {
      name: 'idx_estoque_medicamento_armario_id',
    });
    await addIndexIfNotExists('estoque_medicamento', ['gaveta_id'], {
      name: 'idx_estoque_medicamento_gaveta_id',
    });
    await addIndexIfNotExists('estoque_medicamento', ['casela_id'], {
      name: 'idx_estoque_medicamento_casela_id',
    });
    await addIndexIfNotExists('estoque_medicamento', ['setor'], {
      name: 'idx_estoque_medicamento_setor',
    });

    await addIndexIfNotExists('estoque_insumo', ['validade'], {
      name: 'idx_estoque_insumo_validade',
    });
    await addIndexIfNotExists('estoque_insumo', ['quantidade'], {
      name: 'idx_estoque_insumo_quantidade',
    });
    await addIndexIfNotExists('estoque_insumo', ['armario_id'], {
      name: 'idx_estoque_insumo_armario_id',
    });
    await addIndexIfNotExists('estoque_insumo', ['gaveta_id'], {
      name: 'idx_estoque_insumo_gaveta_id',
    });
    await addIndexIfNotExists('estoque_insumo', ['casela_id'], {
      name: 'idx_estoque_insumo_casela_id',
    });
    await addIndexIfNotExists('estoque_insumo', ['setor'], {
      name: 'idx_estoque_insumo_setor',
    });

    const [loginIndexes] = await queryInterface.sequelize.query(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'login';",
    );
    const hasUniqueLogin =
      loginIndexes &&
      loginIndexes.some(
        r =>
          r.indexname &&
          (r.indexname.includes('login') || r.indexname.includes('unique')),
      );
    if (!hasUniqueLogin) {
      await addIndexIfNotExists('login', ['login'], {
        name: 'idx_login_login_unique',
        unique: true,
      });
    }
  },

  async down(queryInterface) {
    const removeIndexIfExists = async (table, indexName) => {
      try {
        await queryInterface.removeIndex(table, indexName);
      } catch (_) {}
    };
    await removeIndexIfExists('movimentacao', 'idx_movimentacao_data');
    await removeIndexIfExists(
      'movimentacao',
      'idx_movimentacao_medicamento_id',
    );
    await removeIndexIfExists('movimentacao', 'idx_movimentacao_insumo_id');
    await removeIndexIfExists('movimentacao', 'idx_movimentacao_tipo');

    await removeIndexIfExists(
      'estoque_medicamento',
      'idx_estoque_medicamento_validade',
    );
    await removeIndexIfExists(
      'estoque_medicamento',
      'idx_estoque_medicamento_quantidade',
    );
    await removeIndexIfExists(
      'estoque_medicamento',
      'idx_estoque_medicamento_armario_id',
    );
    await removeIndexIfExists(
      'estoque_medicamento',
      'idx_estoque_medicamento_gaveta_id',
    );
    await removeIndexIfExists(
      'estoque_medicamento',
      'idx_estoque_medicamento_casela_id',
    );
    await removeIndexIfExists(
      'estoque_medicamento',
      'idx_estoque_medicamento_setor',
    );

    await removeIndexIfExists('estoque_insumo', 'idx_estoque_insumo_validade');
    await removeIndexIfExists(
      'estoque_insumo',
      'idx_estoque_insumo_quantidade',
    );
    await removeIndexIfExists(
      'estoque_insumo',
      'idx_estoque_insumo_armario_id',
    );
    await removeIndexIfExists('estoque_insumo', 'idx_estoque_insumo_gaveta_id');
    await removeIndexIfExists('estoque_insumo', 'idx_estoque_insumo_casela_id');
    await removeIndexIfExists('estoque_insumo', 'idx_estoque_insumo_setor');

    await removeIndexIfExists('login', 'idx_login_login_unique');
  },
};
