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
      {
        nome: 'Seringa Descartável 3ml',
        descricao: 'Seringa descartável de 3ml',
        estoque_minimo: 100,
        preco: 0.40,
      },
      {
        nome: 'Seringa Descartável 20ml',
        descricao: 'Seringa descartável de 20ml',
        estoque_minimo: 60,
        preco: 0.75,
      },
      {
        nome: 'Agulha 20x6',
        descricao: 'Agulha descartável 20x6',
        estoque_minimo: 150,
        preco: 0.32,
      },
      {
        nome: 'Agulha 40x12',
        descricao: 'Agulha descartável 40x12',
        estoque_minimo: 100,
        preco: 0.50,
      },
      {
        nome: 'Luvas Estéreis',
        descricao: 'Luvas estéreis descartáveis',
        estoque_minimo: 150,
        preco: 0.45,
      },
      {
        nome: 'Soro Glicosado 5%',
        descricao: 'Soro glicosado 5% 500ml',
        estoque_minimo: 35,
        preco: 5.20,
      },
      {
        nome: 'Ringer Lactato',
        descricao: 'Solução Ringer Lactato 500ml',
        estoque_minimo: 30,
        preco: 6.80,
      },
      {
        nome: 'Clorexidina 2%',
        descricao: 'Solução de clorexidina 2% para antissepsia',
        estoque_minimo: 25,
        preco: 15.50,
      },
      {
        nome: 'Povidona Iodada',
        descricao: 'Solução de povidona iodada 10%',
        estoque_minimo: 20,
        preco: 18.20,
      },
      {
        nome: 'Esparadrapo',
        descricao: 'Esparadrapo microporoso',
        estoque_minimo: 80,
        preco: 3.50,
      },
      {
        nome: 'Ataduras',
        descricao: 'Ataduras de crepe 10cm',
        estoque_minimo: 40,
        preco: 4.80,
      },
      {
        nome: 'Tecido Adesivo',
        descricao: 'Tecido adesivo para curativos',
        estoque_minimo: 60,
        preco: 2.90,
      },
      {
        nome: 'Água Oxigenada',
        descricao: 'Água oxigenada 10 volumes',
        estoque_minimo: 30,
        preco: 7.40,
      },
      {
        nome: 'Suporte para Soro',
        descricao: 'Suporte para soro com regulador',
        estoque_minimo: 25,
        preco: 12.00,
      },
      {
        nome: 'Cateter Abocath 18G',
        descricao: 'Cateter intravenoso 18G',
        estoque_minimo: 50,
        preco: 8.50,
      },
      {
        nome: 'Cateter Abocath 20G',
        descricao: 'Cateter intravenoso 20G',
        estoque_minimo: 50,
        preco: 7.80,
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
        'Seringa Descartável 3ml',
        'Seringa Descartável 20ml',
        'Agulha 20x6',
        'Agulha 40x12',
        'Luvas Estéreis',
        'Soro Glicosado 5%',
        'Ringer Lactato',
        'Clorexidina 2%',
        'Povidona Iodada',
        'Esparadrapo',
        'Ataduras',
        'Tecido Adesivo',
        'Água Oxigenada',
        'Suporte para Soro',
        'Cateter Abocath 18G',
        'Cateter Abocath 20G',
      ],
    });
  },
};

