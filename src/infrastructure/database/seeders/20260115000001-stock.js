'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const MEDICINE_STOCK_TABLE = 'estoque_medicamento';
    const INPUT_STOCK_TABLE = 'estoque_insumo';

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

    if (medicines.length === 0 || inputs.length === 0) {
      console.warn('Medicamentos ou insumos não encontrados. Pulando inserção de estoque.');
      return;
    }

    if (cabinets.length === 0 || drawers.length === 0) {
      console.warn('Armários ou gavetas não encontrados. Pulando inserção de estoque.');
      return;
    }

    const now = new Date();
    const getRandomDate = (daysFromNow) => {
      const date = new Date(now);
      date.setDate(date.getDate() + daysFromNow);
      return date;
    };

    const types = ['individual', 'geral', 'carrinho_emergencia', 'carrinho_psicotropicos'];
    const sectors = ['farmacia', 'enfermagem'];
    const origins = ['Compra', 'Doação', 'Farmácia Municipal', 'Farmácia Popular'];

    const medicineStocks = [];
    for (let i = 0; i < 200; i++) {
      const medicine = medicines[i % medicines.length];
      const cabinet = cabinets[i % cabinets.length];
      const drawer = drawers[i % drawers.length];
      const type = types[i % types.length];
      const sector = sectors[i % 2];
      const origin = origins[i % origins.length];
      const quantity = Math.floor(Math.random() * 100) + 10;
      const daysFromNow = Math.floor(Math.random() * 365) - 180;
      const validade = getRandomDate(daysFromNow);
      const lote = `LOTE-${String(i + 1).padStart(4, '0')}-${new Date().getFullYear()}`;
      
      const caselaId = type === 'individual' && residents.length > 0 
        ? residents[i % residents.length].num_casela 
        : null;

      medicineStocks.push({
        medicamento_id: medicine.id,
        armario_id: cabinet.num_armario,
        gaveta_id: drawer.num_gaveta,
        casela_id: caselaId,
        quantidade: quantity,
        validade: validade,
        origem: origin,
        tipo: type,
        setor: sector,
        lote: lote,
        status: 'active',
        suspended_at: null,
        observacao: i % 10 === 0 ? 'Item de teste' : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const inputStocks = [];
    for (let i = 0; i < 150; i++) {
      const input = inputs[i % inputs.length];
      const cabinet = cabinets[i % cabinets.length];
      const drawer = drawers[i % drawers.length];
      const type = types[i % types.length];
      const sector = sectors[i % 2];
      const quantity = Math.floor(Math.random() * 200) + 20;
      const daysFromNow = Math.floor(Math.random() * 365) - 180;
      const validade = getRandomDate(daysFromNow);
      const lote = `INS-${String(i + 1).padStart(4, '0')}-${new Date().getFullYear()}`;

      const caselaId = type === 'individual' && residents.length > 0 
        ? residents[i % residents.length].num_casela 
        : null;

      inputStocks.push({
        insumo_id: input.id,
        armario_id: cabinet.num_armario,
        gaveta_id: drawer.num_gaveta,
        casela_id: caselaId,
        quantidade: quantity,
        validade: validade,
        tipo: type,
        setor: sector,
        lote: lote,
        status: 'active',
        suspended_at: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (medicineStocks.length > 0) {
      await queryInterface.bulkInsert(MEDICINE_STOCK_TABLE, medicineStocks);
      console.log(`Inseridos ${medicineStocks.length} itens de estoque de medicamentos.`);
    }

    if (inputStocks.length > 0) {
      await queryInterface.bulkInsert(INPUT_STOCK_TABLE, inputStocks);
      console.log(`Inseridos ${inputStocks.length} itens de estoque de insumos.`);
    }
  },

  async down(queryInterface, Sequelize) {
    const MEDICINE_STOCK_TABLE = 'estoque_medicamento';
    const INPUT_STOCK_TABLE = 'estoque_insumo';

    await queryInterface.sequelize.query(
      `DELETE FROM ${MEDICINE_STOCK_TABLE} WHERE lote LIKE 'LOTE-%'`
    );
    
    await queryInterface.sequelize.query(
      `DELETE FROM ${INPUT_STOCK_TABLE} WHERE lote LIKE 'INS-%'`
    );
  },
};

