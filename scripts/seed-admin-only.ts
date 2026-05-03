/**
 * Production-safe seed: creates ONLY the initial admin user from
 * SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. No categories, no demo products.
 *
 * Idempotent — safe to re-run; logs "already exists" if the email is taken.
 *
 * Usage:
 *   npx tsx scripts/seed-admin-only.ts
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DIRECT_URL or DATABASE_URL not set");
    process.exit(1);
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_NAME ?? "Administrator";

  if (!email || !password) {
    console.error(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD must be set in environment."
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`ℹ️  Admin already exists: ${email} (role=${existing.role})`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.user.create({
      data: { email, passwordHash, fullName, role: Role.ADMIN },
    });
    console.log(`✅ Admin created: ${admin.email} (id=${admin.id})`);
    console.log(`   role=${admin.role}  fullName="${admin.fullName}"`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
