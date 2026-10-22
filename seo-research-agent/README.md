# SEO Research Agent

A production-oriented Next.js application for organizing projects and running live keyword research. Users can create an account, manage projects, submit an idempotent research job, follow its progress, review evidence-constrained AI insights, filter paginated results, and export a formula-safe CSV.

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

Run migrations with `MIGRATION_DATABASE_URL` available to the command process. The migration account should own the schema; the application account should have only the permissions it needs.

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

Open [http://localhost:3000](http://localhost:3000), create an account, create a project, and run a search. The application deliberately fails closed if the database, rate limiter, job service, or SEO provider is misconfigured.

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
                      -> status polling / CSV export
```

Important directories:

- `src/app` - pages and HTTP route handlers
- `src/components` - reusable authentication and dashboard UI
- `src/features` - validation schemas and safe API DTOs
- `src/server/auth` - active-user authorization checks
- `src/server/db` - schema, database client, and tenant-scoped repositories
- `src/server/jobs` - Inngest functions and durable outbox dispatch
- `src/server/providers` - bounded, validated DataForSEO and OpenAI adapters
- `src/server/security` - same-origin checks and response security headers
- `drizzle` - ordered SQL migrations; commit generated migrations
- `tests` - unit tests and PGlite-backed integration tests

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

1. Provision Neon, Upstash, Inngest, DataForSEO, and OpenAI production resources with separate production credentials.
2. Add the variables from `.env.example` to the Vercel Production environment. Generate a new `AUTH_SECRET`; never copy the development value.
3. Run `npm run db:migrate` once from a trusted CI/release job using `MIGRATION_DATABASE_URL` before shifting traffic to the new build.
4. Connect the Git repository to Vercel and deploy the commit that passed every quality gate.
5. Register `https://<domain>/api/inngest` with Inngest and confirm the research worker, AI-analysis worker, and outbox cron are available.
6. Configure monitoring against `/api/health/live` for process liveness and `/api/health/ready` for dependency readiness.
7. Smoke-test registration, sign-in, project creation, one research run, pagination, CSV export, and sign-out with a non-admin account.

The readiness endpoint returns only `ready` or `unavailable`; it does not disclose which secret or dependency failed. A deployment is not healthy until it returns HTTP 200 and an Inngest worker completes a real research job.

## Current scope and known release gaps

- The UI currently creates `US/en` projects and runs keyword-ideas research only. Additional markets require validated `provider_markets` records and a market selector.
- Evidence-constrained OpenAI analysis is live in the worker and dashboard. The DataForSEO organic SERP adapter is implemented and tested but intentionally not exposed in the minimal UI yet.
- Browser tests cover public/authentication boundaries and security headers. Authenticated live-provider smoke tests still require an isolated staging database and paid-provider credentials; run the deployment checklist before shifting production traffic.
