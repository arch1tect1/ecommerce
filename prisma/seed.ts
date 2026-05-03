import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ── DB Extras (pg_trgm, tsvector trigger, GIN indexes) ────────────────────

async function setupDbExtras() {
  console.log("⚙️  Setting up DB extras (pg_trgm, tsvector trigger)…");
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Product_searchVector_idx"
        ON "Product" USING GIN ("searchVector");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Product_sku_trgm_idx"
        ON "Product" USING GIN ("sku" gin_trgm_ops);
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx"
        ON "Product" USING GIN ("name" gin_trgm_ops);
    `);

    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION product_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW."searchVector" :=
          setweight(to_tsvector('simple', coalesce(NEW."name", '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(NEW."sku", '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(NEW."brand", '')), 'B');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Split into two separate statements — Neon rejects multi-command prepared statements
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS product_search_vector_trigger ON "Product";`
    );
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER product_search_vector_trigger
        BEFORE INSERT OR UPDATE ON "Product"
        FOR EACH ROW EXECUTE FUNCTION product_search_vector_update();
    `);

    console.log("✅ DB extras ready.");
  } catch (e) {
    console.warn("⚠️  DB extras setup warning (may already exist):", (e as Error).message);
  }
}

// ── Admin User ─────────────────────────────────────────────────────────────

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_NAME ?? "Administrator";

  if (!email || !password) {
    console.warn("⚠️  SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`ℹ️  Admin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({
    data: { email, passwordHash, fullName, role: Role.ADMIN },
  });
  console.log(`✅ Admin created: ${admin.email}`);
}

// ── Categories ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { externalId: "CAT-ENG", name: "Engine Parts",  slug: "engine-parts" },
  { externalId: "CAT-FLT", name: "Filters",       slug: "filters"      },
  { externalId: "CAT-BRK", name: "Brakes",        slug: "brakes"       },
  { externalId: "CAT-SUS", name: "Suspension",    slug: "suspension"   },
  { externalId: "CAT-ELC", name: "Electrical",    slug: "electrical"   },
];

async function seedCategories() {
  console.log("📂 Seeding categories…");
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { externalId: cat.externalId },
      update: { name: cat.name, slug: cat.slug },
      create: cat,
    });
  }
  console.log(`✅ ${CATEGORIES.length} categories ready.`);
}

// ── Products ───────────────────────────────────────────────────────────────

const PRODUCTS = [
  // Engine Parts
  {
    externalId: "1C-ENG-001", sku: "OFC-001",
    name: "Oil Filler Cap",          brand: "GENUINE PARTS", catSlug: "engine-parts",
    price: "4.50",  stock: 42,
    description: "OEM oil filler cap for VAZ, GAZ, and ZAZ engines. Rubber-sealed, heat-resistant.",
  },
  {
    externalId: "1C-ENG-002", sku: "TBK-101",
    name: "Timing Belt Kit",         brand: "GATES",         catSlug: "engine-parts",
    price: "185.00", stock: 6,
    description: "Complete timing belt replacement kit including belt, tensioner, and idler pulley.",
  },
  {
    externalId: "1C-ENG-003", sku: "VCG-203",
    name: "Valve Cover Gasket",      brand: "INNA",          catSlug: "engine-parts",
    price: "28.00",  stock: 19,
    description: "High-temperature silicone valve cover gasket. Eliminates oil leaks at the cylinder head.",
  },
  {
    externalId: "1C-ENG-004", sku: "ENM-044",
    name: "Engine Mount (Front)",    brand: "GENUINE PARTS", catSlug: "engine-parts",
    price: "95.00",  stock: 7,
    description: "Hydraulic front engine mount. Reduces vibration and noise transmission to the cabin.",
  },
  {
    externalId: "1C-ENG-005", sku: "HGS-007",
    name: "Head Gasket Set",         brand: "INNA",          catSlug: "engine-parts",
    price: "210.00", stock: 3,
    description: "Full head gasket set including head gasket, valve stem seals, and all cover gaskets.",
  },

  // Filters
  {
    externalId: "1C-FLT-001", sku: "OFL-001",
    name: "Oil Filter",              brand: "MANN",          catSlug: "filters",
    price: "12.00",  stock: 58,
    description: "Premium engine oil filter. High dirt-holding capacity, 7000 km service interval.",
  },
  {
    externalId: "1C-FLT-002", sku: "AFL-002",
    name: "Air Filter",              brand: "BOSCH",         catSlug: "filters",
    price: "18.50",  stock: 34,
    description: "High-flow air filter. Improves engine breathing and fuel efficiency.",
  },
  {
    externalId: "1C-FLT-003", sku: "FFL-003",
    name: "Fuel Filter",             brand: "DENSO",         catSlug: "filters",
    price: "22.00",  stock: 15,
    description: "Inline fuel filter removes contaminants before they reach injectors.",
  },
  {
    externalId: "1C-FLT-004", sku: "CAF-004",
    name: "Cabin Air Filter",        brand: "MANN",          catSlug: "filters",
    price: "35.00",  stock: 26,
    description: "Activated carbon cabin filter removes pollen, dust, and odours.",
  },

  // Brakes
  {
    externalId: "1C-BRK-001", sku: "BRK-F01",
    name: "Front Brake Pads Set",    brand: "GENUINE PARTS", catSlug: "brakes",
    price: "85.00",  stock: 18,
    description: "OEM-spec front brake pads. Low dust, low noise, high performance at operating temperature.",
  },
  {
    externalId: "1C-BRK-002", sku: "BRK-R01",
    name: "Rear Brake Pads Set",     brand: "INNA",          catSlug: "brakes",
    price: "65.00",  stock: 11,
    description: "Rear brake pads with integrated wear indicator. Compatible with most VAZ models.",
  },
  {
    externalId: "1C-BRK-003", sku: "BDK-F01",
    name: "Front Brake Disc",        brand: "BOSCH",         catSlug: "brakes",
    price: "120.00", stock: 10,
    description: "Solid ventilated front brake disc. Precision-balanced to eliminate vibration.",
  },
  {
    externalId: "1C-BRK-004", sku: "BDK-R01",
    name: "Rear Brake Disc",         brand: "BOSCH",         catSlug: "brakes",
    price: "95.00",  stock: 8,
    description: "Rear brake disc with anti-corrosion coating. Sold individually.",
  },
  {
    externalId: "1C-BRK-005", sku: "BCL-001",
    name: "Front Brake Caliper",     brand: "GENUINE PARTS", catSlug: "brakes",
    price: "280.00", stock: 0,
    description: "Remanufactured front brake caliper. Pressure-tested. Core exchange required.",
  },

  // Suspension
  {
    externalId: "1C-SUS-001", sku: "SHA-F01",
    name: "Front Shock Absorber",    brand: "KYB",           catSlug: "suspension",
    price: "220.00", stock: 6,
    description: "Gas-charged front shock absorber. Restores original ride quality and handling.",
  },
  {
    externalId: "1C-SUS-002", sku: "SHA-R01",
    name: "Rear Shock Absorber",     brand: "KYB",           catSlug: "suspension",
    price: "195.00", stock: 6,
    description: "Twin-tube rear shock absorber. Easy bolt-on replacement.",
  },
  {
    externalId: "1C-SUS-003", sku: "CTR-ARM-L",
    name: "Control Arm Left",        brand: "GENUINE PARTS", catSlug: "suspension",
    price: "175.00", stock: 4,
    description: "Front lower control arm assembly (left side). Includes ball joint and bushing.",
  },
  {
    externalId: "1C-SUS-004", sku: "WHL-BRG-F",
    name: "Front Wheel Bearing Kit", brand: "SKF",           catSlug: "suspension",
    price: "145.00", stock: 9,
    description: "Front wheel bearing hub kit. Pre-greased sealed unit. ABS tone ring included.",
  },

  // Electrical
  {
    externalId: "1C-ELC-001", sku: "ALT-001",
    name: "Alternator 90A",          brand: "BOSCH",         catSlug: "electrical",
    price: "450.00", stock: 3,
    description: "Remanufactured 90A alternator. Voltage regulator and rectifier replaced.",
  },
  {
    externalId: "1C-ELC-002", sku: "STR-001",
    name: "Starter Motor",           brand: "DENSO",         catSlug: "electrical",
    price: "380.00", stock: 4,
    description: "Direct replacement starter motor. 1.4 kW. Includes solenoid.",
  },
];

async function seedProducts() {
  console.log("📦 Seeding products…");

  const catMap = new Map<string, string>();
  const cats = await prisma.category.findMany({ select: { id: true, slug: true } });
  for (const c of cats) catMap.set(c.slug, c.id);

  let created = 0;
  for (const p of PRODUCTS) {
    const categoryId = catMap.get(p.catSlug);
    await prisma.product.upsert({
      where: { externalId: p.externalId },
      update: {
        sku: p.sku, name: p.name, brand: p.brand,
        price: p.price, stock: p.stock,
        description: p.description, categoryId,
        isActive: true, lastSyncedAt: new Date(),
      },
      create: {
        externalId: p.externalId, sku: p.sku, name: p.name,
        brand: p.brand, price: p.price, stock: p.stock,
        description: p.description, categoryId,
        isActive: true, lastSyncedAt: new Date(),
      },
    });
    created++;
  }
  console.log(`✅ ${created} products ready.`);

  // Manually refresh searchVector now that trigger is set up
  console.log("🔄 Refreshing searchVector on all products…");
  await prisma.$executeRawUnsafe(`
    UPDATE "Product" SET "updatedAt" = NOW() WHERE "isActive" = true;
  `);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  await setupDbExtras();
  await seedAdmin();
  await seedCategories();
  await seedProducts();
  console.log("\n🎉 Seed complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
