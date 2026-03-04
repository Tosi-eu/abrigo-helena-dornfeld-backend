const TEST_DB_NAME_DEFAULT = 'estoque_test';

export function getDatabaseConfig() {
  const name =
    process.env.NODE_ENV === 'test'
      ? process.env.DB_NAME ||
        process.env.TEST_DB_NAME ||
        TEST_DB_NAME_DEFAULT
      : process.env.DB_NAME;
  return {
    name: name,
    user: process.env.DB_USER,
    pass: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
  };
}
