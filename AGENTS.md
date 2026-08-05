# AGENTS.md

## Cursor Cloud specific instructions

This repo is a **Vite + React 19 + TypeScript PWA** ("Igreja Carvalho", pt-BR
church-management app) whose only backend is **Supabase** (Postgres + Auth +
PostgREST + Storage + Deno edge functions). The frontend is the single
required runtime service; everything else is Supabase-side. Standard commands
live in `package.json` and `README.md` — the notes below only cover the
non-obvious things.

### Running the frontend (the required service)
- `npm run dev` → Vite dev server. The port is **fixed to `8080`** with
  `host: true` (see `vite.config.ts`), not Vite's default 5173.
- `npm run build` → `vite build` + `scripts/prerender.mjs` (static meta/OG
  injection for 6 public routes) + PWA service worker. This **does not need a
  backend** — the Supabase client only fails at runtime, not at build time.
- `npm run lint` → ESLint. Note: lint currently reports **many pre-existing
  errors** (hundreds, largely `@typescript-eslint/no-explicit-any` in
  `supabase/functions/**` and root `test-*.{ts,cjs,js}` scripts). These are the
  repo's baseline — do not treat them as regressions you introduced.

### Backend config the frontend needs (non-obvious gotcha)
- `src/integrations/supabase/client.ts` calls `createClient` at module load
  using `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. If either is
  missing, `createClient` **throws at import time and the app renders a blank
  page** (no error UI). You must provide both before the app is usable.
- These are **public frontend keys** (they ship in the production bundle), not
  server secrets. Provide them via the Secrets panel (Vite exposes real env
  vars prefixed with `VITE_`, or use a local `.env` — `.env` is git-ignored).
  See `.env.example` for the full list.
- The Supabase project ref is `ugnrumtngcskbfpwynsr`, i.e.
  `VITE_SUPABASE_URL=https://ugnrumtngcskbfpwynsr.supabase.co`. This is the
  **hosted (shared/prod) project** migrations are deployed to via CI
  (`.github/workflows/supabase-deploy.yml`). Treat writes as hitting real data
  — prefer a dedicated dev/staging Supabase project if one is available.

### Testing authenticated flows
- Auth is email/password (Google/phone providers are disabled) and the project
  has **email confirmation on** (`mailer_autoconfirm=false`). Self-signup from
  the UI therefore does **not** return a session — the account stays unconfirmed
  and there is no local mail catcher against the hosted project. To exercise the
  authenticated app (dashboard, financeiro, pessoas, etc.) you need a
  **pre-existing confirmed account** (ask the user for a test login) or the
  service-role key to provision/confirm one. Unauthenticated round-trips (login
  request, password recovery, public `app_config` read) are enough to verify the
  frontend↔Supabase wiring end to end.
- Unrelated observation from setup (not an env issue): `parseAuthError` in
  `src/hooks/useAuthErrors.tsx` compares the raw (non-lowercased) `Error.message`
  against lowercase patterns, so real backend errors like
  `Invalid login credentials` fall through to the generic "Erro inesperado"
  toast. The backend round-trip still works; only the toast label is wrong.

### Local Supabase is NOT reproducible from committed migrations
- `supabase start` / `supabase db reset` **fails partway** on a fresh DB
  (~166 of 421 migrations) because the committed migration set has drift:
  - `public.itens_reembolso` is referenced (trigger/policy/ALTERs) but is
    **never created by any migration** (it exists only in prod and in the
    outdated `docs/database-schema.sql` dump).
  - `public.times_culto` is created early, then dropped/renamed by the
    cultos→eventos refactor, yet a later `ALTER TABLE ... times_culto` still
    references it (out-of-order migration history).
- Do not rely on a fully-local Supabase for end-to-end work; use the hosted
  project. For isolated backend/SQL/RPC testing, `CLAUDE.md` /
  `docs/guardrails-financeiro.md` require a **real Postgres harness (Docker)** —
  `deno check`/`tsc` alone are not sufficient, and concurrency needs two real
  `psql` sessions. Docker is not part of the startup script (system dep); a
  fresh VM may need it installed and `dockerd` started manually.
