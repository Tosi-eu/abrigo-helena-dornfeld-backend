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
    await queryInterface.addIndex('movimentacao', ['data'], {
      name: 'idx_movimentacao_data',
    });
    await queryInterface.addIndex('movimentacao', ['medicamento_id'], {
      name: 'idx_movimentacao_medicamento_id',
    });
    await queryInterface.addIndex('movimentacao', ['insumo_id'], {
      name: 'idx_movimentacao_insumo_id',
    });
    await queryInterface.addIndex('movimentacao', ['tipo'], {
      name: 'idx_movimentacao_tipo',
    });

    await queryInterface.addIndex('estoque_medicamento', ['validade'], {
      name: 'idx_estoque_medicamento_validade',
    });
    await queryInterface.addIndex('estoque_medicamento', ['quantidade'], {
      name: 'idx_estoque_medicamento_quantidade',
    });
    await queryInterface.addIndex('estoque_medicamento', ['armario_id'], {
      name: 'idx_estoque_medicamento_armario_id',
    });
    await queryInterface.addIndex('estoque_medicamento', ['gaveta_id'], {
      name: 'idx_estoque_medicamento_gaveta_id',
    });
    await queryInterface.addIndex('estoque_medicamento', ['casela_id'], {
      name: 'idx_estoque_medicamento_casela_id',
    });
    await queryInterface.addIndex('estoque_medicamento', ['setor'], {
      name: 'idx_estoque_medicamento_setor',
    });

    await queryInterface.addIndex('estoque_insumo', ['validade'], {
      name: 'idx_estoque_insumo_validade',
    });
    await queryInterface.addIndex('estoque_insumo', ['quantidade'], {
      name: 'idx_estoque_insumo_quantidade',
    });
    await queryInterface.addIndex('estoque_insumo', ['armario_id'], {
      name: 'idx_estoque_insumo_armario_id',
    });
    await queryInterface.addIndex('estoque_insumo', ['gaveta_id'], {
      name: 'idx_estoque_insumo_gaveta_id',
    });
    await queryInterface.addIndex('estoque_insumo', ['casela_id'], {
      name: 'idx_estoque_insumo_casela_id',
    });
    await queryInterface.addIndex('estoque_insumo', ['setor'], {
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
      try {
        await queryInterface.addIndex('login', ['login'], {
          name: 'idx_login_login_unique',
          unique: true,
        });
      } catch (e) {
        if (!e.message || !e.message.includes('already exists')) throw e;
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('movimentacao', 'idx_movimentacao_data');
    await queryInterface.removeIndex(
      'movimentacao',
      'idx_movimentacao_medicamento_id',
    );
    await queryInterface.removeIndex(
      'movimentacao',
      'idx_movimentacao_insumo_id',
    );
    await queryInterface.removeIndex('movimentacao', 'idx_movimentacao_tipo');

    await queryInterface.removeIndex(
      'estoque_medicamento',
      'idx_estoque_medicamento_validade',
    );
    await queryInterface.removeIndex(
      'estoque_medicamento',
      'idx_estoque_medicamento_quantidade',
    );
    await queryInterface.removeIndex(
      'estoque_medicamento',
      'idx_estoque_medicamento_armario_id',
    );
    await queryInterface.removeIndex(
      'estoque_medicamento',
      'idx_estoque_medicamento_gaveta_id',
    );
    await queryInterface.removeIndex(
      'estoque_medicamento',
      'idx_estoque_medicamento_casela_id',
    );
    await queryInterface.removeIndex(
      'estoque_medicamento',
      'idx_estoque_medicamento_setor',
    );

    await queryInterface.removeIndex(
      'estoque_insumo',
      'idx_estoque_insumo_validade',
    );
    await queryInterface.removeIndex(
      'estoque_insumo',
      'idx_estoque_insumo_quantidade',
    );
    await queryInterface.removeIndex(
      'estoque_insumo',
      'idx_estoque_insumo_armario_id',
    );
    await queryInterface.removeIndex(
      'estoque_insumo',
      'idx_estoque_insumo_gaveta_id',
    );
    await queryInterface.removeIndex(
      'estoque_insumo',
      'idx_estoque_insumo_casela_id',
    );
    await queryInterface.removeIndex(
      'estoque_insumo',
      'idx_estoque_insumo_setor',
    );

    try {
      await queryInterface.removeIndex('login', 'idx_login_login_unique');
    } catch (e) {
      // Index might not exist if it was already there
    }
  },
};
