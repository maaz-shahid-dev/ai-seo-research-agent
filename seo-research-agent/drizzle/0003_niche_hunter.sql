CREATE TABLE "content_gap_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"target_domain" varchar(253) NOT NULL,
	"status" "analysis_status" DEFAULT 'queued' NOT NULL,
	"competitors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"lease_owner" varchar(160),
	"lease_expires_at" timestamp with time zone,
	"error_code" varchar(80),
	"error_message" varchar(500),
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_gap_reports_domain_normalized_check" CHECK ("content_gap_reports"."target_domain" = lower(btrim("content_gap_reports"."target_domain")) and char_length("content_gap_reports"."target_domain") > 0),
	CONSTRAINT "content_gap_reports_competitors_array_check" CHECK (jsonb_typeof("content_gap_reports"."competitors") = 'array'),
	CONSTRAINT "content_gap_reports_keywords_array_check" CHECK (jsonb_typeof("content_gap_reports"."keywords") = 'array'),
	CONSTRAINT "content_gap_reports_version_check" CHECK ("content_gap_reports"."version" > 0),
	CONSTRAINT "content_gap_reports_lease_state_check" CHECK (("content_gap_reports"."status" = 'running') = ("content_gap_reports"."lease_owner" is not null and "content_gap_reports"."lease_expires_at" is not null)),
	CONSTRAINT "content_gap_reports_terminal_state_check" CHECK ((("content_gap_reports"."status" in ('completed', 'failed')) = ("content_gap_reports"."finished_at" is not null)))
);
--> statement-breakpoint
CREATE TABLE "domain_metrics" (
	"domain" varchar(253) PRIMARY KEY NOT NULL,
	"authority" smallint,
	"backlinks" bigint,
	"referring_domains" integer,
	"monthly_traffic" bigint,
	"registered_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "domain_metrics_domain_normalized_check" CHECK ("domain_metrics"."domain" = lower(btrim("domain_metrics"."domain")) and char_length("domain_metrics"."domain") > 0),
	CONSTRAINT "domain_metrics_authority_check" CHECK ("domain_metrics"."authority" is null or "domain_metrics"."authority" between 0 and 100),
	CONSTRAINT "domain_metrics_backlinks_check" CHECK ("domain_metrics"."backlinks" is null or "domain_metrics"."backlinks" >= 0),
	CONSTRAINT "domain_metrics_referring_domains_check" CHECK ("domain_metrics"."referring_domains" is null or "domain_metrics"."referring_domains" >= 0),
	CONSTRAINT "domain_metrics_traffic_check" CHECK ("domain_metrics"."monthly_traffic" is null or "domain_metrics"."monthly_traffic" >= 0),
	CONSTRAINT "domain_metrics_expiry_check" CHECK ("domain_metrics"."expires_at" > "domain_metrics"."fetched_at")
);
--> statement-breakpoint
CREATE TABLE "serp_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"keyword_result_id" bigint NOT NULL,
	"status" "analysis_status" DEFAULT 'queued' NOT NULL,
	"snapshot_id" uuid,
	"niche_score" smallint,
	"has_ai_overview" boolean,
	"version" integer DEFAULT 1 NOT NULL,
	"lease_owner" varchar(160),
	"lease_expires_at" timestamp with time zone,
	"error_code" varchar(80),
	"error_message" varchar(500),
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "serp_analyses_niche_score_check" CHECK ("serp_analyses"."niche_score" is null or "serp_analyses"."niche_score" between 0 and 100),
	CONSTRAINT "serp_analyses_version_check" CHECK ("serp_analyses"."version" > 0),
	CONSTRAINT "serp_analyses_lease_state_check" CHECK (("serp_analyses"."status" = 'running') = ("serp_analyses"."lease_owner" is not null and "serp_analyses"."lease_expires_at" is not null)),
	CONSTRAINT "serp_analyses_terminal_state_check" CHECK ((("serp_analyses"."status" in ('completed', 'failed')) = ("serp_analyses"."finished_at" is not null))),
	CONSTRAINT "serp_analyses_completed_snapshot_check" CHECK ("serp_analyses"."status" <> 'completed' or "serp_analyses"."snapshot_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "content_gap_reports" ADD CONSTRAINT "content_gap_reports_run_owner_fk" FOREIGN KEY ("run_id","owner_id") REFERENCES "public"."research_runs"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_analyses" ADD CONSTRAINT "serp_analyses_keyword_run_owner_fk" FOREIGN KEY ("keyword_result_id","run_id","owner_id") REFERENCES "public"."keyword_results"("id","run_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_analyses" ADD CONSTRAINT "serp_analyses_snapshot_run_owner_fk" FOREIGN KEY ("snapshot_id","run_id","owner_id") REFERENCES "public"."serp_snapshots"("id","run_id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_gap_reports_owner_run_domain_unique" ON "content_gap_reports" USING btree ("owner_id","run_id","target_domain");--> statement-breakpoint
CREATE INDEX "content_gap_reports_status_lease_idx" ON "content_gap_reports" USING btree ("status","lease_expires_at") WHERE "content_gap_reports"."status" in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "domain_metrics_expiry_idx" ON "domain_metrics" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "serp_analyses_owner_keyword_unique" ON "serp_analyses" USING btree ("owner_id","keyword_result_id");--> statement-breakpoint
CREATE INDEX "serp_analyses_owner_run_idx" ON "serp_analyses" USING btree ("owner_id","run_id");--> statement-breakpoint
CREATE INDEX "serp_analyses_status_lease_idx" ON "serp_analyses" USING btree ("status","lease_expires_at") WHERE "serp_analyses"."status" in ('queued', 'running');