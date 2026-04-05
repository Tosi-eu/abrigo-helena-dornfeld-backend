export default async function globalTeardown() {
  try {
    const { closeRedisClient } = await import('./src/config/redis.client');
    await closeRedisClient();
  } catch {
    /* Redis pode não estar carregado */
  }

  try {
    const { prisma } = await import('./src/repositories/prisma');
    await prisma.$disconnect();
  } catch {
    /* Prisma may not be loaded in some unit tests */
  }
}
