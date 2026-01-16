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
      {
        nome: 'Atenolol',
        dosagem: '50',
        unidade_medida: 'mg',
        principio_ativo: 'Atenolol',
        estoque_minimo: 15,
        preco: 8.20,
      },
      {
        nome: 'Hidroclorotiazida',
        dosagem: '25',
        unidade_medida: 'mg',
        principio_ativo: 'Hidroclorotiazida',
        estoque_minimo: 20,
        preco: 6.80,
      },
      {
        nome: 'Sinvastatina',
        dosagem: '20',
        unidade_medida: 'mg',
        principio_ativo: 'Sinvastatina',
        estoque_minimo: 30,
        preco: 11.50,
      },
      {
        nome: 'AAS',
        dosagem: '100',
        unidade_medida: 'mg',
        principio_ativo: 'Ácido Acetilsalicílico',
        estoque_minimo: 50,
        preco: 3.20,
      },
      {
        nome: 'Dorflex',
        dosagem: '35',
        unidade_medida: 'mg',
        principio_ativo: 'Orfenadrina + Dipirona + Cafeína',
        estoque_minimo: 25,
        preco: 7.40,
      },
      {
        nome: 'Cloridrato de Metformina',
        dosagem: '500',
        unidade_medida: 'mg',
        principio_ativo: 'Metformina',
        estoque_minimo: 35,
        preco: 6.90,
      },
      {
        nome: 'Glibenclamida',
        dosagem: '5',
        unidade_medida: 'mg',
        principio_ativo: 'Glibenclamida',
        estoque_minimo: 20,
        preco: 9.80,
      },
      {
        nome: 'Bromoprida',
        dosagem: '10',
        unidade_medida: 'mg',
        principio_ativo: 'Bromoprida',
        estoque_minimo: 15,
        preco: 8.60,
      },
      {
        nome: 'Hidroxicloroquina',
        dosagem: '200',
        unidade_medida: 'mg',
        principio_ativo: 'Hidroxicloroquina',
        estoque_minimo: 10,
        preco: 18.50,
      },
      {
        nome: 'Prednisona',
        dosagem: '20',
        unidade_medida: 'mg',
        principio_ativo: 'Prednisona',
        estoque_minimo: 15,
        preco: 14.20,
      },
      {
        nome: 'Ciprofloxacino',
        dosagem: '500',
        unidade_medida: 'mg',
        principio_ativo: 'Ciprofloxacino',
        estoque_minimo: 12,
        preco: 16.80,
      },
      {
        nome: 'Azitromicina',
        dosagem: '500',
        unidade_medida: 'mg',
        principio_ativo: 'Azitromicina',
        estoque_minimo: 8,
        preco: 22.40,
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
        'Atenolol',
        'Hidroclorotiazida',
        'Sinvastatina',
        'AAS',
        'Dorflex',
        'Cloridrato de Metformina',
        'Glibenclamida',
        'Bromoprida',
        'Hidroxicloroquina',
        'Prednisona',
        'Ciprofloxacino',
        'Azitromicina',
      ],
    });
  },
};

