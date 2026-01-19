'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const TABLE_NAME = 'movimentacao';

    const [medicines] = await queryInterface.sequelize.query(
      `SELECT id FROM medicamento ORDER BY id`,
    );
    const [inputs] = await queryInterface.sequelize.query(
      `SELECT id FROM insumo ORDER BY id`,
    );
    const [cabinets] = await queryInterface.sequelize.query(
      `SELECT num_armario FROM armario ORDER BY num_armario`,
    );
    const [drawers] = await queryInterface.sequelize.query(
      `SELECT num_gaveta FROM gaveta ORDER BY num_gaveta`,
    );
    const [residents] = await queryInterface.sequelize.query(
      `SELECT num_casela FROM residente ORDER BY num_casela`,
    );
    const [logins] = await queryInterface.sequelize.query(
      `SELECT id FROM login ORDER BY id LIMIT 1`,
    );

    if (medicines.length === 0 && inputs.length === 0) {
      console.warn(
        'Medicamentos ou insumos não encontrados. Pulando inserção de movimentações.',
      );
      return;
    }

    if (logins.length === 0) {
      console.warn(
        'Nenhum login encontrado. Criando movimentações com login_id = 1 (caso exista).',
      );
    }

    const loginId = logins.length > 0 ? logins[0].id : 1;
    const movementTypes = ['entrada', 'saida', 'transferencia'];
    const sectors = ['farmacia', 'enfermagem'];

    const now = new Date();
    const getRandomDate = daysAgo => {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      date.setHours(
        Math.floor(Math.random() * 12) + 8,
        Math.floor(Math.random() * 60),
        0,
        0,
      );
      return date;
    };

    const movements = [];
    for (let i = 0; i < 400; i++) {
      const isMedicine = i % 2 === 0 && medicines.length > 0;
      const item = isMedicine
        ? medicines[Math.floor(i / 2) % medicines.length]
        : inputs[Math.floor(i / 2) % inputs.length];

      const cabinet = cabinets[i % cabinets.length];
      const drawer = drawers[i % drawers.length];
      const sector = sectors[i % 2];
      const daysAgo = Math.floor(Math.random() * 180);
      const data = getRandomDate(daysAgo);
      const quantity = Math.floor(Math.random() * 50) + 5;
      const lote = isMedicine
        ? `LOTE-MOV-${String(i + 1).padStart(4, '0')}-${data.getFullYear()}`
        : `INS-MOV-${String(i + 1).padStart(4, '0')}-${data.getFullYear()}`;

      movements.push({
        tipo: 'entrada',
        data: data,
        login_id: loginId,
        medicamento_id: isMedicine ? item.id : null,
        insumo_id: isMedicine ? null : item.id,
        armario_id: cabinet.num_armario,
        gaveta_id: drawer.num_gaveta,
        quantidade: quantity,
        casela_id: null,
        setor: sector,
        lote: lote,
        createdAt: data,
        updatedAt: data,
      });
    }

    for (let i = 0; i < 350; i++) {
      const isMedicine = i % 2 === 0 && medicines.length > 0;
      const item = isMedicine
        ? medicines[Math.floor(i / 2) % medicines.length]
        : inputs[Math.floor(i / 2) % inputs.length];

      const cabinet = cabinets[i % cabinets.length];
      const drawer = drawers[i % drawers.length];
      const sector = sectors[i % 2];
      const daysAgo = Math.floor(Math.random() * 120);
      const data = getRandomDate(daysAgo);
      const quantity = Math.floor(Math.random() * 30) + 1;
      const caselaId =
        i % 5 === 0 && residents.length > 0
          ? residents[i % residents.length].num_casela
          : null;

      movements.push({
        tipo: 'saida',
        data: data,
        login_id: loginId,
        medicamento_id: isMedicine ? item.id : null,
        insumo_id: isMedicine ? null : item.id,
        armario_id: cabinet.num_armario,
        gaveta_id: drawer.num_gaveta,
        quantidade: quantity,
        casela_id: caselaId,
        setor: sector,
        lote: null,
        createdAt: data,
        updatedAt: data,
      });
    }

    for (let i = 0; i < 200; i++) {
      const isMedicine = i % 2 === 0 && medicines.length > 0;
      const item = isMedicine
        ? medicines[Math.floor(i / 2) % medicines.length]
        : inputs[Math.floor(i / 2) % inputs.length];

      const cabinet = cabinets[i % cabinets.length];
      const drawer = drawers[i % drawers.length];
      const fromSector = sectors[i % 2];
      const toSector = fromSector === 'farmacia' ? 'enfermagem' : 'farmacia';
      const daysAgo = Math.floor(Math.random() * 90);
      const data = getRandomDate(daysAgo);
      const quantity = Math.floor(Math.random() * 20) + 1;
      const caselaId =
        i % 3 === 0 && residents.length > 0
          ? residents[i % residents.length].num_casela
          : null;

      movements.push({
        tipo: 'transferencia',
        data: data,
        login_id: loginId,
        medicamento_id: isMedicine ? item.id : null,
        insumo_id: isMedicine ? null : item.id,
        armario_id: cabinet.num_armario,
        gaveta_id: drawer.num_gaveta,
        quantidade: quantity,
        casela_id: caselaId,
        setor: toSector,
        lote: null,
        createdAt: data,
        updatedAt: data,
      });
    }

    if (movements.length > 0) {
      await queryInterface.bulkInsert(TABLE_NAME, movements);
      console.log(`Inseridas ${movements.length} movimentações.`);
      console.log(`  - Entradas: 400`);
      console.log(`  - Saídas: 350`);
      console.log(`  - Transferências: 200`);
    }
  },

  async down(queryInterface, Sequelize) {
    const TABLE_NAME = 'movimentacao';

    await queryInterface.sequelize.query(
      `DELETE FROM ${TABLE_NAME} WHERE lote LIKE 'LOTE-MOV-%' OR lote LIKE 'INS-MOV-%'`,
    );

    await queryInterface.sequelize.query(
      `DELETE FROM ${TABLE_NAME} WHERE lote IS NULL AND tipo IN ('saida', 'transferencia')`,
    );
  },
};
