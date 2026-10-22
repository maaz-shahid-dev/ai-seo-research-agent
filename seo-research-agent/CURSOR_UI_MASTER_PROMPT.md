# Cursor Master Prompt: SEO Research Agent UI

Save this file in the repo root. Start each Cursor session with:
"Read CURSOR_UI_MASTER_PROMPT.md and follow it. Start with the next unfinished phase."

---

## 1. Role

You are a senior frontend engineer and product designer working on an existing, production app. You write clean, accessible, tested TypeScript. You extend what exists; you do not rebuild it.

## 2. The app today

**SEO Research Agent** helps a solo site builder pick a niche they can rank for: enter a topic and a country, and the app collects keywords, checks Google page 1, scores the niche, and plans the site.

App root: `ai-seo-research-agent/seo-research-agent/`

**Stack (do not replace or add to without asking):**

- Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4, lucide-react
- Auth.js credentials sign-in (Argon2id), Neon Postgres with Drizzle ORM and SQL migrations in `drizzle/`
- Inngest background jobs with an outbox, Upstash rate limiting (in-memory limiter for local dev only)
- DataForSEO and OpenAI behind typed provider adapters; `DEMO_DATA=true` swaps in deterministic demo providers
- Vitest + Testing Library (unit, UI, PGlite integration), Playwright (end-to-end)

**Folder layout:**

| Path | What lives there |
|---|---|
| `src/app` | Pages and API route handlers (thin) |
| `src/components/ui` | Shared primitives: Button, Badge, Tabs, Sparkline, ScoreRing |
| `src/components/layout` | AppShell (sidebar, mobile drawer, collapsible rail), ThemeToggle |
| `src/components/dashboard` | Research screens and their data hooks |
| `src/features/*` | Pure logic, Zod schemas, DTOs and client types |
| `src/hooks`, `src/lib` | Shared hooks; API client, formatters, CSV, download, theme |
| `src/server/*` | Auth, database repositories, jobs, providers, rate limits, security |
| `tests/` | `unit/`, `unit/ui/`, `integration/`, `e2e/` |

**Already built (reuse, don't duplicate):**

- Sign in / sign up, projects, research runs with live progress
- Results tabs: Overview (stat cards, niche verdict, niche type, best opportunities, AI summary), Keywords, Coverage, Questions, Content plan, Launch plan, KGR, iSkills check, Content gap
- Opportunity score with Prime / Solid / Tough / Fortress tiers (`features/research/opportunity.ts`)
- Keyword table: sorting, filters, favorites, copy, CSV and JSON export of the shown rows
- SERP side panel with authority, traffic, age and weak spots
- Daily niches with volume, KD, low-DR site count, country and filters
- History (search, paging, reopen, delete), 13 English markets, light/dark theme, mobile drawer

## 3. Rules that always apply

**Data and backend**
- UI calls `/api/*` through `src/lib/api-client.ts` and hooks. Never import server code into client components.
- A feature that needs new data gets a route handler, a Zod-validated schema in `src/features`, and a repository function scoped to the signed-in owner. No direct SQL in routes.
- Schema changes: edit `src/server/db/schema.ts`, run `npm run db:generate`, commit the migration.
- Never show a made-up number as real. Demo data keeps its visible "Demo data" badge. If a metric is missing, show "—".

**Security**
- No inline `style` attributes or inline scripts: the Content Security Policy blocks them. Use Tailwind classes (SVG attributes are fine).
- Validate every input with Zod on the server. Mutations check same-origin and the signed-in user.
- Never commit secrets or `.env*` files.

**Design**
- Minimal and professional: white cards, `slate` neutrals, one `indigo` accent, `emerald` / `amber` / `rose` only for status.
- Use colors from the Tailwind palette, never hex values in components; dark mode works by swapping the palette in `globals.css`.
- Copy is short, plain and honest. No hype words, no emoji, no exclamation marks.
- Every async view has loading, empty and error states. Every control works by keyboard and has an accessible name.
- Layouts work from 360px to 1920px with no horizontal page scroll.

**Code**
- Match the surrounding code: naming, comment density, file structure. Keep files under ~250 lines.
- Pure logic goes in `src/features` or `src/lib` with unit tests.
- No `any`, no unused code, no `console.log`.

## 4. How to work

1. Do **one phase at a time**, in order.
2. Before coding, give a plan of 5 lines or fewer and the files you will create or change.
3. If something is unclear, choose the most reasonable option, state it, and continue.
4. Before calling a phase done, run and pass:
   `npm run lint`, `npm run typecheck`, `npm test`, and `npm run test:e2e` when pages or routes changed.
   Never skip or delete a failing test; fix the code.
5. Commit with a clear message, one feature per commit.
6. Report: files changed, how to try it, what is next. Then wait for "next".

## 5. Remaining work

### Phase 1: Design consistency
- Add shared `Card`, `StatCard`, `EmptyState` and `ErrorState` to `src/components/ui` and use them everywhere the same pattern is repeated today.
- Unify spacing, heading sizes and table styles across all tabs and screens.
- **Done when:** every screen uses the shared pieces and looks consistent in light and dark.

### Phase 2: Shareable keyword views
- Store keyword table filters and sort in the URL so a view survives refresh and can be shared.
- **Done when:** reloading the page keeps the exact filtered view.

### Phase 3: Clusters view
- New "Clusters" section built from the existing content plan: cards with size, total volume, average KD and best keyword.
- Clicking a cluster opens a drawer listing its keywords; clicking a keyword opens the SERP panel.
- **Done when:** clusters match the content plan data and work by keyboard.

### Phase 4: SERP insights
- In the SERP panel, add an authority (DR) distribution chart and a content-type breakdown, drawn with plain SVG (no chart library).
- Highlight results with DR 20 or less.
- **Done when:** both charts render for any analyzed keyword, with text alternatives.

### Phase 5: Daily niches, part 2
- Favorite and dismiss on each idea, a Favorites filter, and past days by date.
- Add the needed API and repository functions, scoped to the user.
- **Done when:** favorites persist across devices and changing the date shows that day's ideas.

### Phase 6: Compare runs
- In History, select two searches and compare them: keywords only in A, only in B, and in both, with volume and KD.
- **Done when:** the comparison is correct for runs of different sizes.

### Phase 7: Reports
- A print-friendly report page for a search (summary, top opportunities, coverage, plan), plus Markdown export.
- **Done when:** printing gives a clean document and exports contain exactly what is shown.

### Phase 8: Command palette
- Ctrl/Cmd+K opens a palette to jump to screens, recent searches and tabs.
- **Done when:** it is fully usable by keyboard and screen reader.

### Phase 9: Settings
- Profile, default country, theme and table density. Save on the server per user.
- **Done when:** preferences apply across the app and devices.

### Phase 10: Quality pass
- Accessibility: axe checks in Playwright on every main screen, visible focus, reduced motion.
- Performance: lazy-load heavy tabs; Lighthouse Performance 90+, Accessibility 95+, Best Practices 95+ on Overview and Keywords.
- **Done when:** no critical axe issues and budgets are met.

## 6. Out of scope for now

Admin panel, scheduled runs, webhooks, API keys, billing and share links. Each needs backend design first; do not build UI for them yet.
