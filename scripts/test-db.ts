import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    await prisma.$queryRaw`SELECT 1 as ok`;
    console.log("✅ Database connection successful!");
  } catch (e) {
    console.error("❌ Database connection failed:", (e as Error).message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
