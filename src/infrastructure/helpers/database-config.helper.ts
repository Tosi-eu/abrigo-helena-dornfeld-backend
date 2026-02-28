export function getDatabaseConfig() {
  const name =
    process.env.NODE_ENV === 'test'
      ? process.env.TEST_DB_NAME
      : process.env.DB_NAME;
  return {
    name,
    user: process.env.DB_USER,
    pass: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
  };
}
