export default async function globalTeardown() {
  try {
    const { sequelize } = await import('./src/infrastructure/database/sequelize');
    await sequelize.close();
  } catch {
    // Unit tests may not load Sequelize; ignore.
  }
}
