import { PrismaClient } from "@prisma/client";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) process.exit(1);
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const [users, customers, products, categories, orders] = await Promise.all([
      prisma.user.count(),
      prisma.customer.count(),
      prisma.product.count(),
      prisma.category.count(),
      prisma.order.count(),
    ]);
    console.log(`Users:      ${users}`);
    console.log(`Customers:  ${customers}`);
    console.log(`Products:   ${products}`);
    console.log(`Categories: ${categories}`);
    console.log(`Orders:     ${orders}`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
