'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const TABLE_NAME = 'insumo';

    const INPUTS = [
      {
        nome: 'Gaze Estéril',
        descricao: 'Gaze estéril para curativos',
        estoque_minimo: 50,
        preco: 8.90,
      },
      {
        nome: 'Algodão',
        descricao: 'Algodão hidrófilo',
        estoque_minimo: 30,
        preco: 5.50,
      },
      {
        nome: 'Seringa Descartável 5ml',
        descricao: 'Seringa descartável de 5ml',
        estoque_minimo: 100,
        preco: 0.45,
      },
      {
        nome: 'Seringa Descartável 10ml',
        descricao: 'Seringa descartável de 10ml',
        estoque_minimo: 80,
        preco: 0.55,
      },
      {
        nome: 'Agulha 25x7',
        descricao: 'Agulha descartável 25x7',
        estoque_minimo: 150,
        preco: 0.35,
      },
      {
        nome: 'Agulha 30x8',
        descricao: 'Agulha descartável 30x8',
        estoque_minimo: 120,
        preco: 0.40,
      },
      {
        nome: 'Luvas de Procedimento',
        descricao: 'Luvas de procedimento descartáveis',
        estoque_minimo: 200,
        preco: 0.25,
      },
      {
        nome: 'Máscara Cirúrgica',
        descricao: 'Máscara cirúrgica descartável',
        estoque_minimo: 300,
        preco: 0.30,
      },
      {
        nome: 'Soro Fisiológico 0,9%',
        descricao: 'Soro fisiológico 0,9% 500ml',
        estoque_minimo: 40,
        preco: 4.50,
      },
      {
        nome: 'Álcool 70%',
        descricao: 'Álcool etílico 70% para antissepsia',
        estoque_minimo: 20,
        preco: 12.80,
      },
    ];

    const [existing] = await queryInterface.sequelize.query(
      `SELECT nome FROM ${TABLE_NAME}`,
    );

    const existingNames = new Set(existing.map(e => e.nome));

    const rowsToInsert = INPUTS.filter(
      input => !existingNames.has(input.nome),
    ).map(input => ({
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    if (rowsToInsert.length > 0) {
      await queryInterface.bulkInsert(TABLE_NAME, rowsToInsert);
    }
  },

  async down(queryInterface, Sequelize) {
    const TABLE_NAME = 'insumo';

    await queryInterface.bulkDelete(TABLE_NAME, {
      nome: [
        'Gaze Estéril',
        'Algodão',
        'Seringa Descartável 5ml',
        'Seringa Descartável 10ml',
        'Agulha 25x7',
        'Agulha 30x8',
        'Luvas de Procedimento',
        'Máscara Cirúrgica',
        'Soro Fisiológico 0,9%',
        'Álcool 70%',
      ],
    });
  },
};

