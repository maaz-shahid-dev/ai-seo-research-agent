# SEO Research Agent

A Next.js application for live keyword research. Users sign up, type a topic, and get keyword ideas with search volume, difficulty, CPC, intent, and a short AI summary. They can reopen recent searches, group work into projects, and export results as CSV.

The interface is intentionally minimal: one search bar, one results view, and a projects page. New accounts get a default project, so the first search needs no setup.

The current user-facing workflow uses DataForSEO keyword ideas for the United States (`US`) in English (`en`). It does not fabricate metrics or fall back to demo data when a provider is unavailable.

## Technology

- Next.js 16, React 19, TypeScript, and Tailwind CSS
- Auth.js credentials sessions with Argon2id password hashing
- PostgreSQL/Neon with Drizzle ORM and committed SQL migrations
- Inngest for durable background jobs
- Upstash Redis for distributed rate limiting
- DataForSEO for live keyword evidence
- Vitest, Testing Library, and PGlite for automated tests

## Local setup

Requirements:

- Node.js 22.18 or newer
- npm
- A PostgreSQL-compatible Neon database
- Upstash Redis, Inngest, DataForSEO, and OpenAI credentials

Install dependencies and create the local environment file:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Fill every required value in `.env.local`. Use a generated random value of at least 32 characters for `AUTH_SECRET`. Do not use production secrets in development or expose server values through `NEXT_PUBLIC_*` variables.

Run migrations with `MIGRATION_DATABASE_URL` available to the command process. Migrations run inside a single transaction, so a failure leaves the schema unchanged. The migration account should own the schema; the application account should have only the permissions it needs.

```powershell
$env:MIGRATION_DATABASE_URL = "postgresql://..."
npm run db:migrate
```

Start the application:

```powershell
npm run dev
```

In another terminal, run the Inngest development server against the application endpoint:

```powershell
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Open [http://localhost:3000](http://localhost:3000), create an account, and run a search. The application deliberately fails closed if a service is misconfigured: sign-up and sign-in need the database and Upstash, and searches return "Keyword research isn't available yet" until Inngest and DataForSEO are configured.

## Run locally with Docker (no cloud accounts)

`docker-compose.yml` starts PostgreSQL behind Neon's local HTTP/WebSocket proxy (so the app uses its production database driver) and the Inngest dev server. Rate limiting uses an in-process limiter, which is allowed only outside production.

```powershell
docker compose up -d
```

Create `.env.local` with:

```dotenv
DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/main
MIGRATION_DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/main
AUTH_SECRET=<output of: npx auth secret>
AUTH_TRUST_HOST=true
RATE_LIMIT_BACKEND=memory
INNGEST_DEV=1
INNGEST_SERVE_HOST=http://host.docker.internal:3000
DEMO_DATA=true
DATAFORSEO_LOGIN=<your login>
DATAFORSEO_PASSWORD=<your password>
OPENAI_API_KEY=<your key>
OPENAI_MODEL=<model name>
```

Then apply migrations and start the app:

```powershell
Get-Content .env.local | ForEach-Object { if ($_ -match '^([A-Z_]+)=(.*)$') { Set-Item "env:$($Matches[1])" $Matches[2] } }
npm run db:migrate
npm run dev
```

Open http://localhost:3000. The Inngest dashboard at http://localhost:8288 shows background jobs. `db.localtest.me` is a public DNS name for 127.0.0.1. The local proxy settings apply only when `DATABASE_URL` uses that host and never in production. Without DataForSEO credentials, everything works except searches, which show "Keyword research isn't available yet".

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Runtime PostgreSQL URL for the least-privilege application role. |
| `MIGRATION_DATABASE_URL` | PostgreSQL URL for schema migrations. Do not use it for normal queries. |
| `AUTH_SECRET` | Random Auth.js signing secret; minimum 32 characters. |
| `AUTH_TRUST_HOST` | Set only behind a trusted non-Vercel proxy. Vercel is detected automatically. |
| `UPSTASH_REDIS_REST_URL` | HTTPS endpoint used for distributed rate limits. |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash server token. |
| `INNGEST_EVENT_KEY` | Key used to publish background events. |
| `INNGEST_SIGNING_KEY` | Key used to verify Inngest requests. |
| `DATAFORSEO_LOGIN` | Server-side DataForSEO login. |
| `DATAFORSEO_PASSWORD` | Server-side DataForSEO password. |
| `OPENAI_API_KEY` | Server-side OpenAI key used by the structured analysis adapter. |
| `OPENAI_MODEL` | OpenAI model name for structured analysis. |
| `LOG_LEVEL` | Optional Pino level; defaults to `info`. |
| `RATE_LIMIT_BACKEND` | Local only: `memory` replaces Upstash with an in-process limiter. Ignored in production. |
| `INNGEST_DEV` | Local only: `1` sends jobs to the Inngest dev server and removes the need for Inngest keys. Never set it in production. |

The production readiness check requires the runtime database, authentication, Upstash, Inngest, DataForSEO, and OpenAI values in the table. `MIGRATION_DATABASE_URL` is required only by the release migration command; it is deliberately excluded from runtime readiness. `AUTH_TRUST_HOST` and `LOG_LEVEL` are optional. `.env*` files are ignored by Git except for the placeholder-only `.env.example` template.

## Architecture

```text
Browser
  -> Next.js pages and authenticated route handlers
       -> tenant-scoped Drizzle repositories -> Neon/PostgreSQL
       -> Upstash rate limits
       -> research run + outbox event (one database operation)
            -> Inngest dispatcher and recovery cron
                 -> DataForSEO keyword worker
                      -> persisted results + AI-analysis outbox event
                           -> OpenAI analysis worker -> cited insights
                      -> top-10 SERP analyses (outbox events)
                           -> SERP worker -> DataForSEO SERP + domain metrics cache
                      -> status polling / CSV export
  -> on demand: SERP for any keyword, content gap for the project website
       -> SERP worker / content-gap worker (DataForSEO domain intersection)
```

### Niche Hunter

Every finished search shows a verdict for the searched topic, like popular niche-hunting tools:

- **Verdict:** Ideal, OK, Maybe or Hard, depending on how many top-10 results have authority under 20 (3+, 2, 1, 0).
- **Niche score (0–100):** half comes from easiness (100 − keyword difficulty), half from weak top-10 results (20 points each). A weak result is a forum, Q&A or social page, or a site with low authority (≤20), a young domain (< 2 years) or low traffic (< 1,000/month).
- **Authority spread:** high (>50), mid (30–50) and low (<30) counts, dedicated niche sites (a homepage ranking), and whether Google shows an AI Overview.
- **Revenue estimate:** volume × CTR (28%/15%/11% for #1–#3) × 1.4 pageviews × $20 RPM, shown with a ±25% range.

The 10 best opportunities (volume × easiness) are analyzed automatically after each search. Any other keyword is analyzed when its row is opened. Website metrics (authority, traffic, age, backlinks, referring domains) are cached per registrable domain for 30 days in `domain_metrics`, shared across users because they describe the public web. Content gap compares the project's website with the three strongest competitors from the analyzed SERPs.

### Keyword collection, content plan, iSkills check and daily niches

- **Google Autocomplete expansion:** every search also asks Google Autocomplete (through DataForSEO) for the seed plus a–z, question words (how, what, why, can…), and modifiers (for, with, vs, best…). That's about 50 lookups at roughly $0.002 each. New suggestions that contain all seed words get volume, CPC, competition, trend, difficulty and intent from Labs keyword overview, and are tagged "Google suggest". If this enrichment fails, the search still completes.
- **Content plan:** keywords are grouped by their strongest topic word into articles (pillar, how-to, best-of, comparison, guide). The page count rates coverage as small (≤10), manageable (≤60) or large.
- **iSkills check:** the iSkills niche-selection rules, each marked pass, caution or fail:
  - not a niche to avoid; specific (3+ words); solves a problem; start micro/nano;
  - 3+ beatable sites with authority ≤ 20; no AI Overview; young, small and dedicated sites ranking;
  - manageable coverage; low backlink needs; enough volume.
  - It ends with a Go / Maybe / Avoid verdict and the weakest page-1 sites, with traffic, ranking keywords and age.
  - Niches to avoid are gambling, adult, piracy and cracks, file/movie/MP3 downloads, and YMYL health or finance (`src/features/research/restricted.ts`).
- **Daily niches:** a 05:00 UTC Inngest cron asks OpenAI for 12 specific niche ideas. It drops restricted, single-word and recently repeated ideas, and stores the rest in `niche_ideas`. Users see them under Daily niches and can check one with a click.

DataForSEO endpoints used: Labs keyword ideas, SERP organic live advanced, Backlinks bulk ranks (0–100 scale), Domain Analytics WHOIS overview (age, traffic, backlinks, referring domains) and Labs domain intersection, SERP Google Autocomplete and Labs keyword overview. Site ranking-keyword counts come from the WHOIS overview's organic count. Manual SERP lookups are limited to 60 per user per hour, and content gaps to 10.

Important directories:

- `src/app` - pages and HTTP route handlers
- `src/components/ui` - shared building blocks (`Button`, `TextField`)
- `src/components/auth` - sign-in and sign-up form
- `src/components/dashboard` - search bar, niche verdict, AI summary, keyword table, SERP panel, content gap, projects, and the data hooks
- `src/hooks` - shared hooks (`usePolling` with retry backoff, dialog focus)
- `src/lib` - browser-side API client (with retry classification) and display formatters
- `src/features` - validation schemas, safe API DTOs, client types derived from them, and the pure Niche Hunter rules (`research/niche.ts`, `research/serp.ts`, `research/domains.ts`)
- `src/server/auth` - active-user authorization checks
- `src/server/db` - schema, database client, and tenant-scoped repositories
- `src/server/jobs` - Inngest functions (research, AI analysis, SERP analysis, content gap) and durable outbox dispatch
- `src/server/research` - route helpers shared by the research APIs
- `src/server/providers` - bounded, validated DataForSEO and OpenAI adapters
- `src/server/security` - same-origin checks and response security headers
- `drizzle` - ordered SQL migrations; commit generated migrations
- `scripts` - transactional migration runner used locally and by Vercel production builds
- `tests` - unit, UI (jsdom), PGlite-backed integration, and Playwright end-to-end tests

The dashboard polls a running search every 1.5–2.5 seconds until the keyword job and the AI summary finish, then every 4 seconds while automatic SERP analyses are still running, so niche scores fill in live. Temporary failures (network errors, 408, 429, 5xx) retry with exponential backoff up to 30 seconds; other errors stop polling and show the server's message.

Research submission creates a run and its outbox event atomically. A best-effort immediate dispatch keeps the UI responsive, while the scheduled outbox function recovers failed sends. When keyword evidence is stored, the worker queues AI analysis before completing the run, preserving the invariant that a completed non-empty run has a durable analysis job. AI failure never invalidates keyword results. Workers use leases, versioned state transitions, bounded provider responses, retry classification, and idempotent event IDs to make replay safe.

## Security and data isolation

- All external input is bounded and validated with Zod before use.
- Passwords use Argon2id; unknown accounts follow a dummy verification path to reduce account enumeration signals.
- Authentication, registration, and research use distributed rate limits. Rate-limit outages fail closed.
- Sessions contain only identity and authorization state, expire after eight hours, and are revalidated against the active database user.
- Repositories scope reads and writes by owner; composite foreign keys preserve ownership across related records.
- SQL is parameterized through Drizzle. Project updates use optimistic versions and research creation uses idempotency keys.
- Mutating JSON routes require a same-origin request. HTML pages use nonce-based CSP and additional browser security headers.
- CSV output neutralizes spreadsheet formulas. Logs redact passwords, cookies, authorization headers, tokens, and API keys.
- Provider credentials and raw provider operations remain server-side. Errors returned to users omit internal details.

Do not log request bodies, loosen ownership predicates, import database tables directly into route handlers, or add a client-visible secret. New mutations should use the existing bounded JSON, same-origin, authorization, validation, and safe-error helpers.

## Tests and quality gates

Run the complete committed test suite and production checks before merging or deploying:

```powershell
npm test
npm run test:coverage
npm run test:e2e
npm run lint
npm run typecheck
npm run db:check
npm run build
```

`npm test` runs both unit tests and PGlite integration tests. Provider tests use controlled clients and do not spend live API quota. `npm run test:e2e` starts an isolated local server and checks public authentication, anonymous redirects, accessibility, mobile overflow, and nonce CSP behavior in Chromium.

Never delete or weaken a failing test to make a build pass. Fix the implementation and add a regression test.

## Deployment on Vercel

The Vercel project's Root Directory must be `seo-research-agent`. Pushing to `main` deploys production.

1. Provision production resources. Neon, Upstash, and Inngest can each be added from the Vercel Marketplace, which injects their environment variables automatically. DataForSEO and OpenAI need accounts and API keys.
2. In Vercel → Settings → Environment Variables (Production), make sure every variable in the table above is set. Generate a new `AUTH_SECRET` (for example `npx auth secret`); never reuse the development value. Set `MIGRATION_DATABASE_URL` to Neon's unpooled (direct) connection string.
3. Deploy. Production builds run `vercel-build`, which applies pending migrations before `next build`. If `MIGRATION_DATABASE_URL` is missing, the build fails and the previous deployment stays live. Preview builds never run migrations.
4. Register `https://<domain>/api/inngest` with Inngest (automatic with the Vercel integration) and confirm the research worker, AI-analysis worker, and outbox cron are listed.
5. Configure monitoring against `/api/health/live` for process liveness and `/api/health/ready` for dependency readiness.
6. Smoke-test registration, sign-in, one search, reopening it from recent searches, CSV export, and sign-out with a non-admin account.

The readiness endpoint returns only `ready` or `unavailable`; it does not disclose which secret or dependency failed. A deployment is not healthy until it returns HTTP 200 and an Inngest worker completes a real research job.

## Current scope and known release gaps

- The UI is US English only and runs keyword-ideas research. Additional markets require validated `provider_markets` records and a market selector.
- Evidence-constrained OpenAI analysis is live in the worker and dashboard. The DataForSEO organic SERP adapter is implemented and tested but intentionally not exposed in the minimal UI yet.
- Browser tests cover public/authentication boundaries and security headers. Authenticated live-provider smoke tests still require an isolated staging database and paid-provider credentials; run the deployment checklist before shifting production traffic.
