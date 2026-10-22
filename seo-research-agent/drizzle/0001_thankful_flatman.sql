ALTER TABLE "ai_citations" DROP CONSTRAINT "ai_citations_keyword_owner_fk";
--> statement-breakpoint
ALTER TABLE "ai_citations" DROP CONSTRAINT "ai_citations_serp_result_owner_fk";
--> statement-breakpoint
ALTER TABLE "ai_citations" DROP CONSTRAINT "ai_citations_analysis_owner_fk";
--> statement-breakpoint
ALTER TABLE "serp_results" DROP CONSTRAINT "serp_results_snapshot_owner_fk";
--> statement-breakpoint
DROP INDEX "job_outbox_idempotency_unique";--> statement-breakpoint
DROP INDEX "projects_owner_status_updated_idx";--> statement-breakpoint
DROP INDEX "provider_requests_retry_idx";--> statement-breakpoint
DROP INDEX "research_runs_owner_created_idx";--> statement-breakpoint
DROP INDEX "research_runs_project_created_idx";--> statement-breakpoint
DROP INDEX "serp_results_snapshot_type_rank_unique";--> statement-breakpoint
ALTER TABLE "ai_citations" ADD COLUMN "run_id" uuid;--> statement-breakpoint
ALTER TABLE "research_runs" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "research_runs" ADD COLUMN "lease_owner" varchar(160);--> statement-breakpoint
ALTER TABLE "research_runs" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "serp_results" ADD COLUMN "run_id" uuid;--> statement-breakpoint
UPDATE "ai_citations" AS citation
SET "run_id" = analysis."run_id"
FROM "ai_analyses" AS analysis
WHERE citation."analysis_id" = analysis."id"
  AND citation."owner_id" = analysis."owner_id";--> statement-breakpoint
UPDATE "serp_results" AS result
SET "run_id" = snapshot."run_id"
FROM "serp_snapshots" AS snapshot
WHERE result."snapshot_id" = snapshot."id"
  AND result."owner_id" = snapshot."owner_id";--> statement-breakpoint
ALTER TABLE "ai_citations" ALTER COLUMN "run_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "serp_results" ALTER COLUMN "run_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_id_run_owner_unique" UNIQUE("id","run_id","owner_id");--> statement-breakpoint
ALTER TABLE "serp_results" ADD CONSTRAINT "serp_results_id_run_owner_unique" UNIQUE("id","run_id","owner_id");--> statement-breakpoint
ALTER TABLE "serp_snapshots" ADD CONSTRAINT "serp_snapshots_id_run_owner_unique" UNIQUE("id","run_id","owner_id");--> statement-breakpoint
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_keyword_run_owner_fk" FOREIGN KEY ("keyword_result_id","run_id","owner_id") REFERENCES "public"."keyword_results"("id","run_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_serp_result_run_owner_fk" FOREIGN KEY ("serp_result_id","run_id","owner_id") REFERENCES "public"."serp_results"("id","run_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_analysis_owner_fk" FOREIGN KEY ("analysis_id","run_id","owner_id") REFERENCES "public"."ai_analyses"("id","run_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_results" ADD CONSTRAINT "serp_results_snapshot_owner_fk" FOREIGN KEY ("snapshot_id","run_id","owner_id") REFERENCES "public"."serp_snapshots"("id","run_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_citations_keyword_run_owner_idx" ON "ai_citations" USING btree ("keyword_result_id","run_id","owner_id");--> statement-breakpoint
CREATE INDEX "ai_citations_serp_result_run_owner_idx" ON "ai_citations" USING btree ("serp_result_id","run_id","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_outbox_owner_event_idempotency_unique" ON "job_outbox" USING btree ("owner_id","event_type","idempotency_key");--> statement-breakpoint
CREATE INDEX "job_outbox_stale_lease_idx" ON "job_outbox" USING btree ("status","locked_at") WHERE "job_outbox"."status" = 'processing';--> statement-breakpoint
CREATE INDEX "projects_owner_updated_idx" ON "projects" USING btree ("owner_id","updated_at","id");--> statement-breakpoint
CREATE INDEX "saved_reports_run_project_owner_idx" ON "saved_reports" USING btree ("run_id","project_id","owner_id");--> statement-breakpoint
CREATE INDEX "serp_snapshots_keyword_run_owner_idx" ON "serp_snapshots" USING btree ("keyword_result_id","run_id","owner_id");--> statement-breakpoint
CREATE INDEX "projects_owner_status_updated_idx" ON "projects" USING btree ("owner_id","status","updated_at","id");--> statement-breakpoint
CREATE INDEX "provider_requests_retry_idx" ON "provider_requests" USING btree ("status","next_retry_at") WHERE "provider_requests"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "research_runs_owner_created_idx" ON "research_runs" USING btree ("owner_id","created_at","id");--> statement-breakpoint
CREATE INDEX "research_runs_project_created_idx" ON "research_runs" USING btree ("project_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "serp_results_snapshot_type_rank_unique" ON "serp_results" USING btree ("snapshot_id","result_type","page","rank");--> statement-breakpoint
ALTER TABLE "job_outbox" ADD CONSTRAINT "job_outbox_idempotency_key_check" CHECK ("job_outbox"."idempotency_key" ~ '^[A-Za-z0-9._:-]{16,160}$');--> statement-breakpoint
ALTER TABLE "provider_requests" ADD CONSTRAINT "provider_requests_idempotency_key_check" CHECK ("provider_requests"."idempotency_key" ~ '^[A-Za-z0-9._:-]{16,160}$');--> statement-breakpoint
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_idempotency_key_check" CHECK ("research_runs"."idempotency_key" ~ '^[A-Za-z0-9._:-]{16,128}$');--> statement-breakpoint
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_version_check" CHECK ("research_runs"."version" > 0);--> statement-breakpoint
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_lease_pair_check" CHECK (("research_runs"."lease_owner" is null) = ("research_runs"."lease_expires_at" is null));
--> statement-breakpoint
INSERT INTO "provider_markets" (
  "provider", "country_code", "language_code", "location_code", "location_name",
  "location_type", "canonical_name", "active"
) VALUES (
  'dataforseo', 'US', 'en', 2840, 'United States', 'Country', 'United States', true
) ON CONFLICT ("provider", "location_code", "language_code") DO NOTHING;
