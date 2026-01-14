'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const TABLE_NAME = 'medicamento';

    const MEDICINES = [
      {
        nome: 'Dipirona Sódica',
        dosagem: '500',
        unidade_medida: 'mg',
        principio_ativo: 'Dipirona Sódica',
        estoque_minimo: 20,
        preco: 5.50,
      },
      {
        nome: 'Paracetamol',
        dosagem: '750',
        unidade_medida: 'mg',
        principio_ativo: 'Paracetamol',
        estoque_minimo: 30,
        preco: 4.80,
      },
      {
        nome: 'Ibuprofeno',
        dosagem: '600',
        unidade_medida: 'mg',
        principio_ativo: 'Ibuprofeno',
        estoque_minimo: 25,
        preco: 6.20,
      },
      {
        nome: 'Omeprazol',
        dosagem: '20',
        unidade_medida: 'mg',
        principio_ativo: 'Omeprazol',
        estoque_minimo: 15,
        preco: 8.90,
      },
      {
        nome: 'Amoxicilina',
        dosagem: '500',
        unidade_medida: 'mg',
        principio_ativo: 'Amoxicilina',
        estoque_minimo: 10,
        preco: 12.50,
      },
      {
        nome: 'Losartana',
        dosagem: '50',
        unidade_medida: 'mg',
        principio_ativo: 'Losartana Potássica',
        estoque_minimo: 20,
        preco: 15.30,
      },
      {
        nome: 'Metformina',
        dosagem: '850',
        unidade_medida: 'mg',
        principio_ativo: 'Metformina',
        estoque_minimo: 30,
        preco: 7.80,
      },
      {
        nome: 'Captopril',
        dosagem: '25',
        unidade_medida: 'mg',
        principio_ativo: 'Captopril',
        estoque_minimo: 20,
        preco: 9.40,
      },
    ];

    const [existing] = await queryInterface.sequelize.query(
      `SELECT nome FROM ${TABLE_NAME}`,
    );

    const existingNames = new Set(existing.map(e => e.nome));

    const rowsToInsert = MEDICINES.filter(
      medicine => !existingNames.has(medicine.nome),
    ).map(medicine => ({
      ...medicine,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    if (rowsToInsert.length > 0) {
      await queryInterface.bulkInsert(TABLE_NAME, rowsToInsert);
    }
  },

  async down(queryInterface, Sequelize) {
    const TABLE_NAME = 'medicamento';

    await queryInterface.bulkDelete(TABLE_NAME, {
      nome: [
        'Dipirona Sódica',
        'Paracetamol',
        'Ibuprofeno',
        'Omeprazol',
        'Amoxicilina',
        'Losartana',
        'Metformina',
        'Captopril',
      ],
    });
  },
};

