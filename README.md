# AutoParts B2B

A wholesale B2B e-commerce platform for auto parts. Customers browse a catalog
synced from a 1C ERP, place orders against their account credit limit, and
admins manage the catalog, customers, orders, analytics, and 1C integration
from a unified back office.

## Tech stack

- **Framework**: Next.js 15 (App Router, Server Actions, Turbopack)
- **Language**: TypeScript (strict)
- **Database**: PostgreSQL via Prisma ORM (Neon in production)
- **Auth**: Auth.js v5 — credentials provider with JWT sessions, role-based middleware
- **UI**: Tailwind CSS 3 + shadcn/ui (Radix primitives)
- **Forms**: react-hook-form + Zod
- **Tables**: TanStack Table
- **Charts**: Recharts
- **Search**: PostgreSQL `tsvector` + `pg_trgm` trigram (fuzzy SKU/name matching)
- **Image storage**: Vercel Blob
- **Drag-and-drop**: dnd-kit (admin product image reorder)
- **Hosting**: Vercel (with Cron for scheduled 1C pulls)

## Local setup

### 1. Clone and install

```bash
git clone <repo-url> autoparts-b2b
cd autoparts-b2b
npm install
```

`npm install` triggers `postinstall` which runs `prisma generate`.

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in the values. Every variable is documented inline in
`.env.example`. The minimum required for local dev:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Pooled Postgres connection (Neon `-pooler` host) |
| `DIRECT_URL` | yes | Direct Postgres connection (migrations) |
| `AUTH_SECRET` | yes | NextAuth JWT secret — `openssl rand -base64 32` |
| `BLOB_READ_WRITE_TOKEN` | image upload | Vercel Blob token |
| `ONEC_SYNC_TOKEN` | 1C only | Push endpoint shared secret — `openssl rand -hex 32` |
| `CRON_SECRET` | prod only | Vercel cron auth secret |
| `SEED_ADMIN_EMAIL` | seed | Initial admin email |
| `SEED_ADMIN_PASSWORD` | seed | Initial admin password |

### 3. Initialize the database

```bash
# Apply tracked migrations (creates schema + search extras)
npx prisma migrate deploy

# Seed the initial admin user + sample products/customers
npm run db:seed
```

### 4. Start the dev server

```bash
npm run dev
# → http://localhost:3000
```

Log in at `/login` with the seed admin credentials.

## Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next dev server with Turbopack |
| `npm run build` | Runs `prisma migrate deploy` then `next build` (production build) |
| `npm run build:no-migrate` | Same but skips the migration step |
| `npm run db:migrate` | `prisma migrate dev` — creates a new migration from schema changes |
| `npm run db:migrate:deploy` | `prisma migrate deploy` — applies pending migrations |
| `npm run db:studio` | Opens Prisma Studio at localhost:5555 |
| `npm run db:seed` | Seeds admin + sample data (never runs on production builds) |
| `npm run test:1c-sync` | Smoke-tests every 1C push endpoint against localhost |

## Deploy to Vercel

### 1. Create the Neon production database

1. Sign in to [console.neon.tech](https://console.neon.tech)
2. Create a new project. **Pick the region closest to your Vercel deployment**:
   - For Vercel `iad1` (US East) → Neon `us-east-1`
   - For Vercel `fra1` (Europe) → Neon `eu-central-1` (default in `vercel.json`)
3. From the project's **Connection Details** panel, copy:
   - The **pooled** connection string → `DATABASE_URL` (hostname contains `-pooler`)
   - The **direct** connection string → `DIRECT_URL`

### 2. Create the Vercel Blob store

1. In the Vercel dashboard → **Storage** tab → **Create Database** → **Blob**
2. Copy the auto-generated `BLOB_READ_WRITE_TOKEN`

### 3. Create the Vercel project

1. Import this repo into Vercel.
2. Framework preset: **Next.js** (auto-detected). Build command stays as `npm run build` — that runs `prisma migrate deploy && next build`.
3. Set every variable from `.env.example` in the **Environment Variables** UI:

   | Variable | Notes |
   |---|---|
   | `DATABASE_URL` | from Neon (pooled) |
   | `DIRECT_URL` | from Neon (direct) |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `AUTH_URL` | `https://your-domain.vercel.app` |
   | `BLOB_READ_WRITE_TOKEN` | from step 2 |
   | `ONEC_SYNC_TOKEN` | `openssl rand -hex 32` (give to 1C dev) |
   | `CRON_SECRET` | `openssl rand -hex 32` (Vercel-only) |
   | `ONEC_PULL_URL`, `ONEC_PULL_AUTH` | optional — wire up later |
   | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | for the first seed run |
   | `NEXT_PUBLIC_CURRENCY` | e.g. `AZN` |
   | `NEXT_PUBLIC_SITE_NAME` | display name |

4. Adjust `vercel.json` `regions` if your Neon DB is **not** in `eu-central-1` —
   match the Vercel region to your Neon region for minimum latency.

5. Click **Deploy**. The build runs `prisma migrate deploy` automatically.

### 4. Seed production data (one time)

After the first successful deploy, run the seed against the production DB:

```bash
DATABASE_URL="<prod URL>" DIRECT_URL="<prod direct URL>" \
SEED_ADMIN_EMAIL="..." SEED_ADMIN_PASSWORD="..." \
npm run db:seed
```

The seed is **never** run automatically — only via this explicit command.

### 5. Verify

Run the launch checklist at [`docs/launch-checklist.md`](docs/launch-checklist.md).

## 1C integration

See [`docs/1c-integration.md`](docs/1c-integration.md) for the complete
reference the 1C developer needs: auth header format, every endpoint's JSON
shape, working curl examples, recommended sync frequencies, retry guidance.

The five push endpoints are:

```
POST /api/sync/1c/products
POST /api/sync/1c/stock
POST /api/sync/1c/prices
POST /api/sync/1c/categories
POST /api/sync/1c/customers
```

All authenticated via `X-Sync-Token` (constant-time compare), rate-limited
to 60 req/min per token, and logged to the `SyncLog` table visible at
`/admin/sync`.

A Vercel cron at `/api/cron/sync-1c` pulls every 30 minutes when
`ONEC_PULL_URL` is configured; otherwise it's a no-op (records SKIPPED rows).

## What's built — phase summary

| Phase | Scope |
|---|---|
| 1 — Foundation | Next.js scaffold, Prisma schema (Users, Customers, Products, Categories, Orders, Cart, SyncLog, SearchEvent, ProductView), shadcn UI, Tailwind, layout shell |
| 2 — Auth | Auth.js v5 credentials provider, register/login pages, middleware role gating, session JWT with role + customerId |
| 3 — Catalog | Product list with server-side pagination, full-text + trigram search, brand/category/stock filters, product detail page |
| 4 — Cart & Orders | Add-to-cart, qty edits, "place order" with credit-limit + stock validation in transaction, customer order list and detail pages |
| 5 — Analytics tracking | `SearchEvent` (raw + normalized query), `ProductView` (60s dedup per user), search-click attribution |
| 6 — Admin panel core | CRUD for Products (with Vercel Blob image upload + drag-reorder), Categories (tree editor), Orders (status/paid/notes), Customers (with activity timeline), Users (role/active/reset) |
| 7 — Analytics dashboards | `/admin` overview (KPIs, 30d revenue chart, top searches/views, zero-result table, sync status), `/admin/analytics` tabs (search, views with conversion-to-cart, customer activity) + CSV export |
| 8 — 1C integration | 5 push endpoints + cron pull fallback, SyncLog with full/partial/failed tracking, manual "Sync Now" buttons, full developer reference doc |
| 9 — Polish & deploy | Production migrations, regions config, error boundaries, 404 page, debug-page gating, rate limiting, deployment docs, launch checklist |

## Hidden routes

`/admin/debug/analytics` is a raw-event feed kept for debugging. In production
it returns 404 unless `ENABLE_DEBUG_PAGES=true` is set.

## License

Proprietary — internal use only.
