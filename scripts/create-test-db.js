#!/usr/bin/env node
/**
 * Cria o banco de dados de testes (estoque_test) no Postgres.
 * Uso: node scripts/create-test-db.js
 * Requer .env com DB_HOST, DB_USER, DB_PASSWORD (ou variáveis de ambiente).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Client } = require('pg');

const dbName = process.env.TEST_DB_NAME || 'estoque_test';
const host = process.env.DB_HOST || 'localhost';
const port = Number(process.env.DB_PORT) || 5432;
const user = process.env.DB_USER || 'postgres';
const password = process.env.DB_PASSWORD || 'postgres';

async function main() {
  const client = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
  });
  try {
    await client.connect();
    const res = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (res.rows.length > 0) {
      console.log(`Banco "${dbName}" já existe.`);
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
      throw new Error('Nome do banco inválido');
    }
    await client.query(`CREATE DATABASE ${dbName}`);
    console.log(`Banco "${dbName}" criado com sucesso.`);
  } catch (err) {
    console.error('Erro ao criar banco de testes:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
