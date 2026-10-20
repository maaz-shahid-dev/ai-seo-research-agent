# AI SEO Research Agent

An evidence-first Next.js dashboard for exploring keyword opportunities, inspecting SERP snapshots, mapping content coverage, and reviewing AI-assisted niche assessments.

The current repository is a Milestone 1 frontend demo. It ships one complete, clearly labeled static research snapshot for:

- Project: `AI Productivity SaaS & Agents`
- Seed: `best ai tools for productivity`
- Market: `US / en`

Other project and run rows are metadata previews only. The app intentionally shows an unavailable/empty state instead of relabeling that US snapshot or inventing metrics for another query.

## Run locally

Requirements: Node.js 22.18+ and npm (the regression tests use Node's built-in TypeScript stripping).

```powershell
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality checks

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

## Current capabilities

- Responsive dashboard navigation and URL-backed views
- Exact project/query/market snapshot isolation
- Keyword search, filters, sorting, clusters, selection, and CSV export
- SERP evidence with explicit missing-snapshot states
- Derived content-coverage and overview indicators
- Evidence-based AI demo assessment
- Project creation and session-level project operations
- Admin/researcher role preview with guarded admin UI
- Formula-safe RFC-4180 CSV generation and exact in-session report snapshots
- Loading, empty, provider-error, and rate-limit UI previews

## Data integrity

- No live SEO or AI provider is connected.
- No code path generates random search volume, difficulty, CPC, ranking URLs, or authority metrics.
- Every bundled metric retains its source and retrieval timestamp.
- Historical rows without bundled payloads cannot download the current buffer as if it were the original report.
- Demo role switching is a UI preview, not production authentication. Real authorization must be enforced server-side.

## Planned backend

The product PRD proposes a separate FastAPI service, PostgreSQL, a licensed SEO data adapter, and an evidence-grounded AI service. Keep all credentials server-side. [.env.example](./.env.example) documents placeholder names only; this frontend does not consume them yet.

## Deployment

The frontend can be deployed to Vercel after all quality checks pass. Connect a backend and authentication before treating projects, reports, admin diagnostics, or provider health as persistent production features.
