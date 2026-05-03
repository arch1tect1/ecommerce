# AutoParts B2B — Launch Checklist

Walk through this list **after every production deploy** to confirm every flow
works end to end. Use a real browser (Chrome incognito recommended) against
the production URL.

> Estimated time: 15–20 minutes for the full pass.

---

## 0. Pre-flight (Vercel dashboard)

- [ ] Latest deploy is green; build log shows
      `prisma migrate deploy` reported all migrations as applied.
- [ ] All env vars from `.env.example` are present in **Production** scope:
      `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`,
      `BLOB_READ_WRITE_TOKEN`, `ONEC_SYNC_TOKEN`, `CRON_SECRET`,
      `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`,
      `NEXT_PUBLIC_CURRENCY`, `NEXT_PUBLIC_SITE_NAME`.
- [ ] `ENABLE_DEBUG_PAGES` is **NOT** set (or is `false`) in production.
- [ ] `vercel.json` `regions` matches your Neon DB region (default: `iad1`).
- [ ] Vercel **Cron Jobs** dashboard shows the
      `/api/cron/sync-1c` schedule = `*/30 * * * *`.

## 1. Initial seed (one time only)

After the first deploy, seed the production DB:

```bash
DATABASE_URL="<prod>" DIRECT_URL="<prod-direct>" \
SEED_ADMIN_EMAIL="..." SEED_ADMIN_PASSWORD="..." \
npm run db:seed
```

- [ ] Seed prints `✅ Admin created: <email>` (or "already exists" on re-runs).

---

## 2. Storefront — anonymous browse

- [ ] Open the production URL — landing page renders, no console errors.
- [ ] `/products` loads, products visible, images served from
      `*.public.blob.vercel-storage.com`.
- [ ] Search works: type a SKU prefix → relevant products surface (full-text + trigram).
- [ ] Apply category filter from sidebar → URL updates with `?category=...`,
      results filtered.
- [ ] Click a product → detail page renders, primary image shown, "Add to cart"
      button is disabled (we are anonymous).

## 3. Customer registration

- [ ] Click **Register** → fill form → submit.
- [ ] Auto-logged-in, redirected to `/`.
- [ ] Banner says "Your account is not yet approved" or similar — confirms
      the user has no `customerId` linked yet.

## 4. Admin links the customer

Open a second browser tab/profile, log in as the seed admin.

- [ ] `/admin/users` lists the new user with no Customer link.
- [ ] Click **Link to customer** → either pick an existing customer or
      create one inline (give them a `creditLimit > 0`).
- [ ] After linking, the user row shows the customer name.

Back in the customer's browser:

- [ ] Hard-refresh `/` — banner is gone, "Your account is approved".
- [ ] `/orders` shows an empty state ("No orders yet") instead of the
      "not approved" banner.

## 5. Place an order (customer)

- [ ] Add 2–3 products to the cart from `/products`.
- [ ] Open `/cart` — line items, qty stepper, totals all correct.
      Currency suffix matches `NEXT_PUBLIC_CURRENCY`.
- [ ] Click **Place order**:
  - If total > available credit, the form rejects with a clear message.
  - Otherwise success: order number assigned, redirected to `/orders/<id>`.
- [ ] Order detail page shows items, totals, status `PENDING`,
      `PaymentStatus` `UNPAID`.
- [ ] Customer's `balance` (visible in admin) increased by the order total.

## 6. Admin manages the order

- [ ] `/admin/orders` lists the new order at the top.
- [ ] Click into it → status / paid / notes controls work:
  - [ ] Change status `PENDING → COMPLETED`.
  - [ ] Update paid amount equal to total → `paymentStatus` auto-flips to `PAID`.
  - [ ] Add an internal note → saves and appears.

## 7. Catalog management

- [ ] `/admin/products` paginates correctly. Search/filter chips work.
- [ ] Edit any product → SKU and External ID are **locked** (lock icon, disabled inputs).
- [ ] Upload a new image (drag and drop):
  - [ ] Image appears in the gallery.
  - [ ] Set as primary → product card on `/products` shows the new image.
  - [ ] Delete the image → it's removed from Vercel Blob (no broken thumbnail).
- [ ] Add a new (manual) product → SKU and External ID are **editable**;
      External ID auto-generates as `local-<id>` if blank.

## 8. Categories

- [ ] `/admin/categories` shows the tree.
- [ ] Add a child, rename, reparent — all work.
- [ ] Try to delete a category with products — UI prompts to reassign. Works.

## 9. Customers & users

- [ ] `/admin/customers` paginates. Click into a customer:
  - [ ] KPIs (balance, credit, total orders, debt) match what you'd expect.
  - [ ] Activity timeline shows recent searches + views from this user.
- [ ] `/admin/users` actions:
  - [ ] Change a user's role.
  - [ ] Toggle a user `inactive` → that user is logged out and can no longer log in.
  - [ ] Reset a user's password → you receive a one-time temp password.
        Verify you cannot deactivate yourself.

## 10. Analytics

- [ ] `/admin` overview — KPIs populated for "Today", 30-day revenue chart
      renders. Top searches / top viewed / zero-result tables show data
      generated from your test traffic.
- [ ] `/admin/analytics` — three tabs render:
  - [ ] Search analytics: sorting works, CSV export downloads.
  - [ ] Product views: conversion-to-cart percentages display.
  - [ ] Customer activity: clicking a row drills into customer detail.
- [ ] Date-range filter (7d / 30d / 90d) updates results.

## 11. 1C sync (manual + cron)

- [ ] `/admin/sync` page renders.
- [ ] Cron status shows `*/30 * * * *` and the configured/not-configured badge
      reflects `ONEC_PULL_URL`.
- [ ] Click **Sync Now** for any type:
  - If `ONEC_PULL_URL` unset: a `SKIPPED` row appears in history with the
    message "1C pull URL not configured".
  - If configured: status `SUCCESS`/`PARTIAL` with rows processed.
- [ ] Click any history row → modal opens with full error JSON.
- [ ] (Optional) From your laptop, run `npm run test:1c-sync` against
      `https://your-domain.vercel.app`:
  ```
  SYNC_TEST_BASE_URL="https://your-domain.vercel.app" npm run test:1c-sync
  ```
  → all 5 push endpoints respond 200, history table picks up new rows.
- [ ] Wait for the next half-hour cron tick → a fresh `1C_PULL` SyncLog row
      appears (look for `source = "1C_PULL"`).

## 12. Production safety

- [ ] `https://<domain>/admin/debug/analytics` returns **404** (debug pages off).
- [ ] Hitting `/api/sync/1c/products` without `X-Sync-Token` returns **401**.
- [ ] Hitting `/api/cron/sync-1c` without `Authorization: Bearer` returns **401**.
- [ ] Visiting an unknown path renders the friendly **404** page (not the
      Next.js dev error overlay).
- [ ] Force a 500 (e.g. visit a known-bad route during a transient DB outage):
      the **Try again / Go to home** error boundary renders instead of a stack trace.

## 13. Performance smoke

- [ ] First request to `/admin` after a quiet period: warm load < 1.5s.
      (Cold Neon connections add 1–2s; subsequent requests should be < 500ms.)
- [ ] Vercel **Functions** dashboard shows no error rate spikes for any route.
- [ ] Vercel **Cron** dashboard shows the last `/api/cron/sync-1c` invocation
      succeeded.

---

## If something fails

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 on every sync push | Wrong `ONEC_SYNC_TOKEN` | Verify Vercel env matches what 1C sends |
| 401 on cron | Wrong `CRON_SECRET` | Re-deploy after setting Vercel env var |
| Login fails with "Something went wrong" | DB unreachable | Check Neon project + `DATABASE_URL` |
| Images broken on `/products` | Wrong Blob token / CORS | Verify `BLOB_READ_WRITE_TOKEN`; redeploy |
| Build fails with "shadow database" error | Migration drift | Check `DIRECT_URL` is the **direct** Neon connection, not pooled |
| Cart says "Your account is not yet approved" after admin linking | Stale JWT | Hard-refresh; cart fetches `customerId` fresh from DB on each render |
| Hydration error with currency | NEXT_PUBLIC_CURRENCY mismatch | Set the env var before build; redeploy |

---

## Post-launch follow-ups (not blocking)

- Add Sentry or Logflare for centralized error logging
- Move the in-memory rate limiter to Upstash Redis for global coordination
- Add Posthog or Plausible for product analytics
- Enable Vercel Web Analytics & Speed Insights
- Set up daily Neon DB snapshots
- Configure a custom domain (`autoparts.example.com`) and update `AUTH_URL`
