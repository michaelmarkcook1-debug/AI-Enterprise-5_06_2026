import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

type GlobalWithPrisma = typeof globalThis & {
  __rankingEnginePrisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required before using the ranking-engine database.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, ssl: true }),
  });
}

export function getPrisma(): PrismaClient {
  const globalForPrisma = globalThis as GlobalWithPrisma;

  if (!globalForPrisma.__rankingEnginePrisma) {
    globalForPrisma.__rankingEnginePrisma = createPrismaClient();
  }

  return globalForPrisma.__rankingEnginePrisma;
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
