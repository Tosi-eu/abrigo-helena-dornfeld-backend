export default async function globalTeardown() {
  try {
    const { closeTestApp } = await import('./src/tests/helpers/database.helper');
    await closeTestApp();
  } catch {
    // no-op
  }

  try {
    const { closeRedisClient } = await import('./src/config/redis.client');
    await closeRedisClient();
  } catch {
      // no-op
  }

  try {
    const { prisma } = await import('./src/repositories/prisma');
    await prisma.$disconnect();
  } catch {
    // no-op
  }
}
