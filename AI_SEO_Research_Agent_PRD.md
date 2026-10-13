# Product Requirements Document (PRD)
## AI SEO Research Agent

**Document status:** MVP planning draft  
**Version:** 1.0  
**Last updated:** 2026-10-13  
**Product type:** Web application with admin dashboard  
**Primary builder:** Solo developer using Cursor and AI-assisted (vibe) coding

---

## 1. Product Summary

The AI SEO Research Agent helps website owners and SEO learners research keyword opportunities by country and language, inspect search engine results pages (SERPs), organize evidence, and evaluate whether a niche deserves further investigation.

The product combines real SEO data from external providers with AI-assisted analysis. AI must explain the evidence and its limitations; it must not invent search volume, keyword difficulty, domain metrics, or ranking URLs.

## 2. Problem Statement

Keyword research is spread across multiple tools and spreadsheets. It can be difficult to compare countries, find related long-tail keywords, inspect ranking competitors, and consistently decide which opportunities deserve more research.

The product aims to put these tasks into one workflow, with saved projects and transparent evidence.

## 3. Goals

### MVP goals
- Let a user create and manage niche research projects.
- Accept a seed keyword, target country, and language.
- Retrieve keyword and SERP data from a real provider when configured.
- Show keyword ideas and available metrics in a filterable table.
- Present SERP competitors and available domain metrics with source and retrieval date.
- Generate an AI-written assessment based only on retrieved data.
- Save research and export results to CSV.
- Provide a basic protected admin area for operational visibility.

### Success criteria for the MVP
- A user can create a project, run a research task, inspect results, save them, and export a CSV.
- Every externally sourced metric has a provider/source and retrieval timestamp where available.
- If a provider or AI request fails, the app displays a useful error and does not fabricate results.
- AI conclusions identify missing evidence and are presented as recommendations to verify, not guarantees.
- The deployed app can be used end-to-end without developer tools.

## 4. Non-Goals for the MVP

Do not build these in the first release:
- A full SEO suite that replaces Ahrefs, Semrush, or Rankytools.
- Guaranteed ranking, traffic, or income predictions.
- Automatic publishing of articles or website changes.
- Autonomous agents that purchase services or take irreversible actions.
- Multiple cooperating agents.
- Paid subscription billing before the core workflow is validated.
- Scraping sites or search engines in ways that violate provider terms.
- Fake or hard-coded production SEO metrics.

## 5. Target Users

### Primary user
An SEO learner or niche researcher who compares keyword opportunities across countries and languages.

### Secondary users
- Bloggers and website owners
- Freelance SEO professionals
- Small content teams

## 6. Core User Workflow

1. Sign in.
2. Create a research project and give it a name.
3. Enter a seed keyword.
4. Select the target country and language.
5. Start keyword research.
6. Review keyword ideas and available metrics.
7. Select a keyword to inspect its SERP.
8. Review ranking URLs, available domain metrics, and search intent.
9. Ask the AI agent to summarize strengths, weaknesses, uncertainties, and next research steps.
10. Save the findings and export a CSV report.

## 7. Functional Requirements

### FR-01: Projects
- Users can create, view, rename, and archive projects.
- A project stores its name, description (optional), target country, language, and timestamps.
- Research records must be associated with the correct project and user.

### FR-02: Keyword Research
- Accept a seed keyword and target market.
- Send a request to a configured SEO data provider.
- Display returned keyword ideas and only the metrics supplied by the provider.
- Support search, sorting, and filters for available metrics.
- Show loading, empty, rate-limit, and error states.
- Clearly label demo/sample data when no provider is configured.

### FR-03: Country and Language
- Allow the user to select a supported country and language.
- Store provider-specific location/language identifiers where needed.
- Explain that country and language targeting are related but not interchangeable.
- Do not imply that every provider supports every market.

### FR-04: SERP Analysis
- Request SERP data for a selected keyword and target market from a configured provider.
- Display ranking position, page title, URL, and available domain/page metrics.
- Show data source and retrieval time.
- Do not treat third-party DR, DA, or authority scores as Google metrics.
- If a metric is unavailable, display “Not available” rather than guessing.

### FR-05: AI Niche Evaluation
- Send the AI model a structured summary of retrieved evidence.
- Return a concise assessment covering:
  - Potential opportunity
  - Search intent
  - SERP strength and weakness signals
  - Evidence gaps
  - Risks and uncertainty
  - Suggested next checks
- Cite or reference the relevant records within the app where practical.
- Distinguish measured facts from AI-generated interpretation.
- Never fabricate keyword volume, CPC, difficulty, rankings, backlinks, or domain authority.

### FR-06: Saved Research
- Save keyword lists, SERP snapshots, and AI assessments.
- Allow users to reopen and review past runs.
- Record timestamps and provider details to make data freshness clear.

### FR-07: CSV Export
- Export selected keyword results and available metrics to CSV.
- Include the keyword, country, language, metrics, source, and retrieval time where available.
- Protect against malformed CSV content where appropriate.

### FR-08: Admin Dashboard
For the MVP, the admin area should show:
- Basic user and project counts
- Research task status and recent failures
- Provider configuration status without exposing secrets
- AI request usage/cost estimates if the provider supplies sufficient data
- Basic operational logs

Admin access must be restricted to authorized accounts.

### FR-09: Error Handling
- Provide clear messages for missing configuration, invalid input, provider timeouts, rate limits, and AI errors.
- Use bounded retries only for safe, retryable requests.
- Never display secret API keys in the browser or logs.
- Preserve completed research when a later step fails.

## 8. Proposed Technology Stack

### Frontend
- Next.js with App Router
- TypeScript
- Tailwind CSS
- A reusable accessible component system

### Backend
- Python
- FastAPI
- Pydantic for request/response validation

### Database
- PostgreSQL
- SQLAlchemy or SQLModel for data access
- Alembic for schema migrations if using SQLAlchemy

### AI
- An LLM API selected after comparing cost, quality, privacy, and tool/function-calling support
- Start with one agent/workflow; add more only when needed

### SEO data
- One provider with suitable keyword and SERP API coverage
- Evaluate country coverage, data fields, pricing, rate limits, licensing, and terms before choosing
- Keep provider access behind a backend adapter so it can be replaced later

### Tooling and deployment
- Cursor for AI-assisted development
- Git for version control
- GitHub for remote repository and collaboration
- Vercel or another suitable host for the frontend
- A Python-compatible host for FastAPI
- Managed PostgreSQL for production

**Architecture decision:** Keep the frontend and Python API separate. All SEO-provider and AI API keys must remain server-side.

## 9. High-Level Architecture

```text
User
  |
  v
Next.js Web App
  |
  v
FastAPI Backend
  |----------------------|
  v                      v
SEO Provider Adapter    AI Service
  |                      |
  v                      v
Keyword/SERP Evidence   Evidence-based Analysis
  |                      |
  |----------|-----------|
             v
         PostgreSQL
             |
             v
       Saved Projects
       Research History
       CSV Export
```

## 10. Initial Data Model

### User
- id
- email
- password/auth provider reference
- role
- created_at

### Project
- id
- user_id
- name
- description
- target_country
- target_language
- created_at
- updated_at
- archived_at (optional)

### ResearchRun
- id
- project_id
- seed_keyword
- country
- language
- provider
- status
- error_summary (optional)
- started_at
- completed_at (optional)

### KeywordResult
- id
- research_run_id
- keyword
- search_volume (nullable)
- keyword_difficulty (nullable)
- cpc (nullable)
- intent (nullable)
- raw_provider_data (optional, subject to provider terms)
- source
- retrieved_at

### SERPResult
- id
- research_run_id
- keyword
- position
- title
- url
- domain
- authority_metric_name (nullable)
- authority_metric_value (nullable)
- source
- retrieved_at

### AIAnalysis
- id
- research_run_id
- summary
- opportunity_signals
- risks
- missing_evidence
- next_steps
- model_name
- created_at

Store only the data needed for the product and follow provider retention and licensing rules.

## 11. UX Requirements

- Simple, clean, responsive dashboard.
- Main navigation: Overview, Projects, Keyword Research, SERP Analysis, Reports, Settings.
- Tables must support loading, empty, error, and partial-data states.
- Use plain language for SEO metrics and explain unfamiliar terms.
- Mark demo data clearly.
- Show when results were last retrieved.
- Make the source of metrics easy to inspect.
- Meet basic keyboard accessibility and readable contrast requirements.

## 12. Security and Privacy

- Keep all API keys in environment variables on the server.
- Add authentication before storing personal research in a deployed app.
- Enforce user-level access checks on every project and research endpoint.
- Restrict admin functions using server-side role checks.
- Validate inputs and response schemas.
- Use HTTPS in production.
- Avoid logging secrets or unnecessary personal data.
- Apply provider usage limits and request throttling.
- Back up the production database and test restoration.

## 13. Environment Configuration

Use `.env.example` to document required configuration names without real secrets. Expected variables may include:

```env
DATABASE_URL=
AI_PROVIDER_API_KEY=
SEO_DATA_PROVIDER_API_KEY=
```

The exact variables depend on the chosen providers. Add `.env` to `.gitignore` and never commit real keys to GitHub.

## 14. Testing and Acceptance Criteria

### MVP acceptance checklist
- [ ] Frontend starts locally and loads the dashboard.
- [ ] Backend starts locally and its health endpoint responds.
- [ ] Frontend can call the backend successfully.
- [ ] User can create and reopen a project.
- [ ] Keyword request validates input and selected market.
- [ ] Real provider results are shown with provenance, or demo data is explicitly labeled.
- [ ] SERP results show available fields without invented metrics.
- [ ] AI assessment uses supplied evidence and lists missing information.
- [ ] Provider/AI failure states are handled clearly.
- [ ] CSV export opens correctly in common spreadsheet software.
- [ ] Secrets are not exposed to the frontend or committed to Git.
- [ ] User and admin permissions are tested.
- [ ] Core workflow is tested in a deployed environment.

## 15. Delivery Plan

### Milestone 1: UI scaffold
- Create Next.js app.
- Build responsive dashboard shell.
- Add demo keyword table with a visible demo-data label.

### Milestone 2: Python API
- Create FastAPI service.
- Add health endpoint.
- Connect frontend to backend.

### Milestone 3: Data provider
- Choose a provider after reviewing cost and coverage.
- Implement keyword research adapter.
- Add clear loading and error states.

### Milestone 4: SERP analysis
- Implement SERP retrieval and competitor table.
- Track metric sources and timestamps.

### Milestone 5: AI analysis
- Add one evidence-based AI workflow.
- Validate structured output and handle provider errors.

### Milestone 6: Persistence and export
- Add PostgreSQL and migrations.
- Save projects and research runs.
- Add CSV export.

### Milestone 7: Security and launch
- Add authentication and role-based admin access.
- Configure production environment variables.
- Test and deploy.

## 16. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| SEO API costs become too high | Set usage limits; cache results where permitted; track usage |
| Provider lacks target-country coverage | Verify coverage before choosing; isolate provider behind an adapter |
| AI invents or misreads metrics | Supply structured evidence; validate output; show sources and uncertainty |
| Scope becomes too large | Ship milestones in order; postpone multi-agent workflows and billing |
| API keys leak | Keep keys server-side; use environment variables; review commits |
| Data becomes stale | Show retrieval timestamps and allow refresh |
| Search engine/provider terms are violated | Use licensed APIs and follow provider terms |

## 17. Future Features (After MVP Validation)

- Multiple SEO data providers
- Keyword clustering and topical maps
- Content briefs and article outlines
- SERP history and change detection
- Saved filters and scheduled reports
- Team accounts and sharing
- Usage quotas and paid plans
- Additional AI tools for internal linking and content audits

## 18. Product Principles

1. Evidence before AI conclusions.
2. No fabricated metrics.
3. Small, testable milestones.
4. Human review for important decisions.
5. Secure secrets and user data.
6. Build for a real workflow before adding complexity.

---

## 19. Immediate Next Step

Create the Next.js project locally:

```powershell
npx create-next-app@latest seo-research-agent --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Verify the project starts successfully before moving to the next task. Then build the dashboard shell with clearly labeled demo data. Do not configure paid SEO or AI APIs until the initial app structure is working.
