export default async function globalTeardown() {
  try {
    const { closeRedisClient } = await import(
      './src/infrastructure/database/redis/client.redis'
    );
    await closeRedisClient();
  } catch {
    /* Redis pode não estar carregado */
  }

  try {
    const { sequelize } = await import('./src/infrastructure/database/sequelize');
    await sequelize.close();
  } catch {
    /* Unit tests may not load Sequelize */
  }
}
