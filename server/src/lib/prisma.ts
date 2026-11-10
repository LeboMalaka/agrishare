import { PrismaClient } from '@prisma/client';

function databaseUrlWithConnectionTimeout(databaseUrl: string) {
  const url = new URL(databaseUrl);
  if (!url.searchParams.has('connect_timeout')) {
    url.searchParams.set('connect_timeout', '15');
  }
  return url.toString();
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(process.env.DATABASE_URL
      ? { datasourceUrl: databaseUrlWithConnectionTimeout(process.env.DATABASE_URL) }
      : {}),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
