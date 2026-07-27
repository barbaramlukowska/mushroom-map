# Runo Map 🍄

*Runo — Polish for the forest floor harvest: mushrooms, berries, and everything you forage.*

> Work in progress — **Stage 3 (map UI) complete**: full-screen map with clustered, age-faded pins backed by the real API, a multi-select filter panel, a sighting form, and a Tailwind CSS v4 design-token system (WCAG AA contrast). Deploy + CI (Stage 3.5) up next. This README grows with the project.

A community map of mushroom sightings in Poland. Users anonymously report finds (species, date, approximate location) and browse what others have found nearby — a *give-to-get* model for mushroom pickers.

Portfolio project focused on learning **Node.js (Express)** and **monorepo architecture (Turborepo)**.

UI text is in Polish (the app targets mushroom pickers in Poland); code, docs and commits are in English.

## Tech stack

| Area | Choice |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | Next.js (App Router) + react-leaflet |
| Styling | Tailwind CSS v4 with a two-tier design-token system |
| Backend | Express 5 + Prisma 7 |
| Database | PostgreSQL on Supabase |
| Shared validation | Zod schemas in `packages/shared` |
| Testing | Vitest + supertest |
| AI assistant | Gemini via Vercel AI SDK *(planned)* |

## Repository structure

```
runo-map/
├── turbo.json              # Turborepo task pipeline
├── pnpm-workspace.yaml
├── apps/
│   ├── web/                # Next.js frontend (App Router)
│   └── api/                # Express API + Prisma (PostgreSQL on Supabase)
└── packages/
    ├── shared/             # shared TS types + Zod schemas
    └── config/             # shared tsconfig
```

Why a monorepo? One Zod schema in `packages/shared` validates the form on the frontend **and** the request on the backend — single definition, two consumers.

Why two-tier tokens? The frontend colors live as a two-layer system in `apps/web/src/app/globals.css`: Tier 1 primitives (raw palette) feed Tier 2 semantic tokens (`--color-surface`, `--color-content`, `--color-fill`…) that generate the Tailwind utilities. A JS mirror in `apps/web/src/lib/tokens.ts` lets a Vitest test assert WCAG AA contrast on every text/background pair — so a palette tweak that would drop below 4.5:1 fails CI instead of shipping.

## Getting started

### 1. Install and check

```bash
pnpm install
pnpm typecheck   # runs across all packages via Turborepo
pnpm build
```

### 2. Database setup

The API needs a PostgreSQL database. Any Postgres works; the project uses a free
[Supabase](https://supabase.com) project (EU region, RLS enabled — the DB is reachable
only through this API).

Create `apps/api/.env` (gitignored — never commit it):

```bash
# transaction pooler (port 6543) — used by the running app
DATABASE_URL="postgresql://...@...pooler.supabase.com:6543/postgres?pgbouncer=true"
# session pooler (port 5432) — used by prisma migrate
DIRECT_URL="postgresql://...@...pooler.supabase.com:5432/postgres"
# PORT=3002   # optional, default 3001
# WEB_ORIGIN=http://localhost:3000   # browser origin allowed by CORS (default localhost:3000)
```

Both URLs are on the Supabase dashboard under **Connect → ORMs → Prisma**.

Then, from `apps/api/`:

```bash
npx prisma migrate dev   # apply migrations
npx prisma generate      # generate the typed client into src/generated/ (gitignored)
npx prisma db seed       # demo data; idempotent, safe to rerun
```

### 3. Run

```bash
pnpm --filter @runo-map/api dev   # API on http://localhost:3001
pnpm --filter @runo-map/web dev   # frontend on http://localhost:3000
curl localhost:3001/api/sightings
```

The web app also needs `NEXT_PUBLIC_API_URL` (browser-side POST target) in `apps/web/.env.local`; see `apps/web/.env.example`.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/sightings` | list sightings; optional `species` (repeatable: `?species=KURKA&species=BOROWIK`), `from`, `to`, `bbox` filters |
| GET | `/api/sightings/:id` | single sighting |
| POST | `/api/sightings` | report a sighting (Zod-validated, rate-limited 10/h/IP) |
| GET | `/api/species-stats` | per-species report counts, most-reported first; the leading four carry a pin colour from the 4-colour budget |
| GET | `/api/health` | healthcheck |

`bbox` takes `minLng,minLat,maxLng,maxLat` — the format Leaflet's `map.getBounds().toBBoxString()` produces, so the map can request only the visible area.

Routes depend on a `Store` interface injected into the app factory: production wires in the
Prisma-backed store (PostgreSQL on Supabase), tests use an isolated in-memory implementation.
The swap in Stage 2 didn't change a single route.

## Roadmap

- [x] **Stage 0** — Turborepo + pnpm scaffold, shared package wired into both apps
- [x] **Stage 1** — Express API with in-memory data, tests from day one
- [x] **Stage 2** — PostgreSQL (Supabase) + Prisma migrations, seed, store swap
- [x] **Stage 3** — Map UI: react-leaflet, clustering, filters, freshness fading, sighting form, Tailwind design system
- [ ] **Stage 3.5** — Deploy (Vercel + Render) and CI (GitHub Actions)
- [ ] **Stage 4** — AI assistant with tool calling (sightings + weather)

## Security

Security is designed in from the start, mapped against **OWASP Top 10:2025** (web) and the **LLM/Agentic OWASP lists** for the AI stage. Already implemented:

- Coordinates rounded to ~500 m on write — location privacy by design (A06)
- Every client input (body and query) validated with Zod; invalid input → 400 with issues (A05)
- Central error handler: real errors logged server-side, clients only ever see a generic 500 — no stack traces or internals leak (A10)
- `helmet` security headers, `X-Powered-By` removed (A02)
- Rate limiting: 10 new sightings per IP per hour (A06, anti-vandalism)
- CORS restricts browser calls to the `WEB_ORIGIN` origin; requests from other sites are refused (A05)
- Secrets only in env vars; `.env` gitignored from the first commit (A02)
- DB reachable only through the API: Supabase Row Level Security enabled with no policies,
  so the auto-generated public REST API is deny-by-default (A01)
- Comment length capped in two layers: Zod schema at the edge and `VARCHAR(280)` in the DB —
  defense in depth (A06)
- SQL injection surface removed by Prisma's parameterized queries (A05)
- pnpm blocks package postinstall scripts; trusted packages allowlisted explicitly (A03)

Planned: structured logging with `pino` (A09), supply-chain checks in CI (A03).
