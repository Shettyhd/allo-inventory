# Allo Inventory — Take-Home Exercise

A multi-warehouse inventory and order-reservation platform built with Next.js 14 (App Router), Prisma, Postgres, and Redis.

---

## Live Demo

> Deploy to Vercel + Supabase (Postgres) + Upstash (Redis) — see **Deployment** below.

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 App Router | Required |
| Language | TypeScript (end-to-end) | Required |
| ORM | Prisma | Clean schema, safe migrations |
| Database | Postgres (Supabase / Neon) | Required — hosted Postgres |
| Cache / Lock | Redis (Upstash) | Distributed locking for race-condition safety |
| Validation | Zod | Shared schemas between API and forms |
| UI | Tailwind CSS + hand-rolled components | Lightweight, no extra deps |
| Idempotency | Postgres (`idempotency_keys` table) | Bonus feature |

---

## Running Locally

### 1. Prerequisites

- Node.js 18+
- A hosted Postgres instance (Supabase, Neon, or Railway — all have free tiers)
- A Redis instance (Upstash free tier works well)

### 2. Clone & install

```bash
git clone <your-repo>
cd allo-inventory
npm install
```

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
DATABASE_URL="postgresql://..."   # Supabase / Neon connection string
REDIS_URL="redis://..."           # Upstash Redis URL
CRON_SECRET="<random 32-char hex>" # openssl rand -hex 32
```

### 4. Set up the database

```bash
# Push schema to your hosted Postgres instance
npm run db:push

# Seed with 6 products, 3 warehouses, and 14 stock levels
npm run db:seed
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/products` | Products with available stock per warehouse |
| `GET` | `/api/warehouses` | All warehouses |
| `POST` | `/api/reservations` | Reserve units — 409 if insufficient stock |
| `GET` | `/api/reservations/:id` | Fetch a single reservation |
| `POST` | `/api/reservations/:id/confirm` | Confirm purchase — 410 if expired |
| `POST` | `/api/reservations/:id/release` | Cancel reservation early |
| `GET` | `/api/cron/expire` | Cron endpoint (requires `Authorization: Bearer <CRON_SECRET>`) |

---

## How the Race Condition is Solved

This is the core of the exercise. The problem: two simultaneous requests for the last unit of a SKU must result in exactly one success and one 409.

### Strategy: Distributed Lock (Redis) + Atomic DB Update

**Step 1 — Acquire a Redis lock** scoped to the specific `productId:warehouseId` pair before reading stock:

```
SET lock:stock:{productId}:{warehouseId} 1 PX 8000 NX
```

- `NX` means "only set if key does not exist" — exactly one caller wins.
- `PX 8000` is an 8-second TTL so the lock self-releases if the server crashes.
- The competing request gets `null` back from Redis and returns a `503 Service Busy` rather than a false 409 — it can be retried safely.

**Step 2 — Inside the lock**, read `totalUnits - reserved`. If `available < quantity`, return 409. Otherwise:

**Step 3 — Atomic Prisma transaction** increments `reserved` and creates the `Reservation` row in one commit.

**Step 4 — Release the lock** in a `finally` block so it's always freed even on error.

```
Why not just a DB transaction?
A Postgres `SELECT … FOR UPDATE` row lock works too, and is simpler if
you only have one DB replica. Redis is better when:
  - You have read replicas (SELECT on a replica won't lock the primary)
  - You want the lock TTL to outlive the DB connection
I chose Redis here because it's the industry standard for this pattern
and the exercise mentioned it as a suggestion.
```

---

## How Reservation Expiry Works

Reservations have a 10-minute `expiresAt` timestamp. When one expires the `reserved` count must be decremented so the units reappear as available.

### Three mechanisms (defence-in-depth)

**1. Lazy cleanup on `GET /api/products`**

Every time the product listing is fetched, `releaseExpiredReservations()` runs. This means the catalogue always shows accurate available stock without any background process, which is important for correctness on the free tier and in local dev.

**2. Vercel Cron (production)**

`vercel.json` schedules `GET /api/cron/expire` every minute. This ensures expiry happens even if nobody is browsing the catalogue. The cron route requires `Authorization: Bearer <CRON_SECRET>` to prevent abuse.

**3. Expiry check on `POST /api/reservations/:id/confirm`**

Even if the cron hasn't run yet, confirming an expired reservation returns a `410 Gone` and releases the units at that point.

The three mechanisms together mean:
- No unit stays "ghost-reserved" for more than ~1 minute in production.
- In development / preview with no cron running, the next product page load cleans up.

---

## Idempotency (Bonus)

`POST /api/reservations` and `POST /api/reservations/:id/confirm` support the `Idempotency-Key` header.

**How it works:**

1. Client generates a UUID per logical request (e.g. `uuidv4()` on button click, stored in component state so retries reuse it).
2. Server checks the `idempotency_keys` table for that key + endpoint pair.
3. If found, return the stored response immediately — no side effects.
4. If not found, execute the operation, then persist the key + response.

This means a network retry after a timeout can never double-charge or double-reserve. The frontend already sends `Idempotency-Key` headers via `uuid` on every reserve and confirm action.

---

## Deployment

### Vercel + Supabase + Upstash

1. **Postgres**: Create a project on [supabase.com](https://supabase.com) → Project Settings → Database → copy the connection string (use the "Session mode" URL, port 5432).

2. **Redis**: Create a database on [upstash.com](https://upstash.com) → copy the `redis://` connection string.

3. **Vercel**: Import repo → add environment variables (`DATABASE_URL`, `REDIS_URL`, `CRON_SECRET`) → deploy.

4. **Run migrations**:
```bash
DATABASE_URL="<supabase-url>" npx prisma db push
DATABASE_URL="<supabase-url>" npm run db:seed
```

The Vercel Cron in `vercel.json` activates automatically on the Hobby plan.

---

## Trade-offs & What I'd Do Differently

### What I simplified

- **No authentication** — a real system would have user sessions so reservations are tied to an account. The checkout URL is currently guessable by ID.
- **Single quantity reservation** — the UI lets you pick 1–N, but a real cart might hold multiple SKUs in one reservation.
- **No payment integration** — "Confirm purchase" mocks the payment step. In production you'd call Stripe/Razorpay and confirm only on webhook receipt.
- **Lock contention returns 503** — a production system might retry the lock acquisition 2–3 times with exponential backoff rather than immediately 503-ing.

### What I'd add with more time

- **WebSocket / SSE** for live stock updates so other tabs see the number change when someone reserves.
- **Reservation batching** — one checkout locking multiple SKUs across multiple warehouses, with all-or-nothing semantics.
- **Optimistic UI with stale revalidation** — SWR or React Query so the product list refreshes in the background.
- **Proper Prisma migrations** — I used `db push` for speed; production should have versioned migration files checked into git.
- **Structured logging** — Pino + log drains (Axiom / Datadog) rather than console.log.
- **Integration tests** — a Vitest suite that fires two concurrent reserve requests against a test DB and asserts exactly one 201 and one 409.

### Why Redis over `SELECT FOR UPDATE`

A Postgres `SELECT … FOR UPDATE` advisory lock also solves the race condition and is simpler (no extra service). I chose Redis because:
- The exercise explicitly mentioned it
- It's service-agnostic (works across read replicas)
- Lock visibility is explicit and TTL-based, making deadlocks self-healing

For a small single-instance project, `SELECT FOR UPDATE` in a Prisma transaction would be equally correct and one fewer dependency.
