CREATE TYPE "public"."analysis_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."analysis_type" AS ENUM('intent', 'serp_summary', 'content_gap', 'niche', 'report');--> statement-breakpoint
CREATE TYPE "public"."keyword_source" AS ENUM('seed', 'related', 'autocomplete', 'competitor');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'processing', 'published', 'failed', 'dead');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."provider_request_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."report_format" AS ENUM('dashboard', 'csv', 'json');--> statement-breakpoint
CREATE TYPE "public"."research_device" AS ENUM('desktop', 'mobile');--> statement-breakpoint
CREATE TYPE "public"."research_run_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."search_intent" AS ENUM('informational', 'navigational', 'commercial', 'transactional', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."serp_result_type" AS ENUM('organic', 'paid', 'featured_snippet', 'people_also_ask', 'local_pack', 'video', 'image', 'news', 'other');--> statement-breakpoint
CREATE TYPE "public"."usage_metric" AS ENUM('requests', 'keywords', 'tokens', 'cost_micros');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "ai_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"type" "analysis_type" NOT NULL,
	"status" "analysis_status" DEFAULT 'queued' NOT NULL,
	"provider" varchar(80) NOT NULL,
	"model" varchar(120) NOT NULL,
	"prompt_version" varchar(40) NOT NULL,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"input_hash" varchar(64) NOT NULL,
	"summary" text,
	"output" jsonb,
	"confidence" numeric(5, 4),
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"error_code" varchar(80),
	"error_message" varchar(500),
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_analyses_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "ai_analyses_provider_not_blank_check" CHECK (char_length(btrim("ai_analyses"."provider")) > 0),
	CONSTRAINT "ai_analyses_model_not_blank_check" CHECK (char_length(btrim("ai_analyses"."model")) > 0),
	CONSTRAINT "ai_analyses_hash_check" CHECK ("ai_analyses"."input_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "ai_analyses_schema_version_check" CHECK ("ai_analyses"."schema_version" > 0),
	CONSTRAINT "ai_analyses_confidence_check" CHECK ("ai_analyses"."confidence" is null or "ai_analyses"."confidence" between 0 and 1),
	CONSTRAINT "ai_analyses_input_tokens_check" CHECK ("ai_analyses"."input_tokens" is null or "ai_analyses"."input_tokens" >= 0),
	CONSTRAINT "ai_analyses_output_tokens_check" CHECK ("ai_analyses"."output_tokens" is null or "ai_analyses"."output_tokens" >= 0),
	CONSTRAINT "ai_analyses_latency_check" CHECK ("ai_analyses"."latency_ms" is null or "ai_analyses"."latency_ms" >= 0),
	CONSTRAINT "ai_analyses_terminal_state_check" CHECK ((("ai_analyses"."status" in ('completed', 'failed')) = ("ai_analyses"."finished_at" is not null))),
	CONSTRAINT "ai_analyses_completed_output_check" CHECK ("ai_analyses"."status" <> 'completed' or ("ai_analyses"."output" is not null and jsonb_typeof("ai_analyses"."output") = 'object')),
	CONSTRAINT "ai_analyses_finished_after_started_check" CHECK ("ai_analyses"."finished_at" is null or "ai_analyses"."finished_at" >= coalesce("ai_analyses"."started_at", "ai_analyses"."created_at"))
);
--> statement-breakpoint
CREATE TABLE "ai_citations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"keyword_result_id" bigint,
	"serp_result_id" bigint,
	"position" smallint NOT NULL,
	"url" text,
	"title" varchar(500),
	"excerpt" varchar(1000),
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_citations_position_check" CHECK ("ai_citations"."position" > 0),
	CONSTRAINT "ai_citations_evidence_target_check" CHECK ("ai_citations"."keyword_result_id" is not null or "ai_citations"."serp_result_id" is not null),
	CONSTRAINT "ai_citations_url_not_blank_check" CHECK ("ai_citations"."url" is null or char_length(btrim("ai_citations"."url")) > 0)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_id" uuid,
	"actor_user_id" uuid,
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid,
	"request_id" varchar(120),
	"ip_hash" varchar(64),
	"user_agent" varchar(500),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_action_not_blank_check" CHECK (char_length(btrim("audit_logs"."action")) > 0),
	CONSTRAINT "audit_logs_entity_type_not_blank_check" CHECK (char_length(btrim("audit_logs"."entity_type")) > 0),
	CONSTRAINT "audit_logs_ip_hash_check" CHECK ("audit_logs"."ip_hash" is null or "audit_logs"."ip_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "audit_logs_metadata_object_check" CHECK (jsonb_typeof("audit_logs"."metadata") = 'object')
);
--> statement-breakpoint
CREATE TABLE "daily_usage" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"usage_date" date NOT NULL,
	"provider" varchar(80) NOT NULL,
	"metric" "usage_metric" NOT NULL,
	"quantity" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_usage_provider_not_blank_check" CHECK (char_length(btrim("daily_usage"."provider")) > 0),
	CONSTRAINT "daily_usage_quantity_check" CHECK ("daily_usage"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "job_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"aggregate_type" varchar(80) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" varchar(160),
	"last_error" varchar(1000),
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_outbox_aggregate_type_not_blank_check" CHECK (char_length(btrim("job_outbox"."aggregate_type")) > 0),
	CONSTRAINT "job_outbox_event_type_not_blank_check" CHECK (char_length(btrim("job_outbox"."event_type")) > 0),
	CONSTRAINT "job_outbox_payload_object_check" CHECK (jsonb_typeof("job_outbox"."payload") = 'object'),
	CONSTRAINT "job_outbox_attempts_check" CHECK ("job_outbox"."attempts" between 0 and 100),
	CONSTRAINT "job_outbox_lock_pair_check" CHECK (("job_outbox"."locked_at" is null) = ("job_outbox"."locked_by" is null)),
	CONSTRAINT "job_outbox_published_state_check" CHECK (("job_outbox"."status" = 'published') = ("job_outbox"."published_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "keyword_results" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"keyword" varchar(500) NOT NULL,
	"normalized_keyword" varchar(500) NOT NULL,
	"source" "keyword_source" NOT NULL,
	"provider" varchar(80) NOT NULL,
	"provider_request_id" varchar(200),
	"retrieved_at" timestamp with time zone NOT NULL,
	"intent" "search_intent" DEFAULT 'unknown' NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"search_volume" integer,
	"cpc_micros" bigint,
	"competition" numeric(5, 4),
	"difficulty" smallint,
	"trend" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "keyword_results_id_run_owner_unique" UNIQUE("id","run_id","owner_id"),
	CONSTRAINT "keyword_results_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "keyword_results_keyword_not_blank_check" CHECK (char_length(btrim("keyword_results"."keyword")) > 0),
	CONSTRAINT "keyword_results_provider_not_blank_check" CHECK (char_length(btrim("keyword_results"."provider")) > 0),
	CONSTRAINT "keyword_results_normalized_keyword_check" CHECK ("keyword_results"."normalized_keyword" = lower(btrim("keyword_results"."normalized_keyword")) and char_length("keyword_results"."normalized_keyword") > 0),
	CONSTRAINT "keyword_results_country_code_check" CHECK ("keyword_results"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "keyword_results_language_code_check" CHECK ("keyword_results"."language_code" ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
	CONSTRAINT "keyword_results_search_volume_check" CHECK ("keyword_results"."search_volume" is null or "keyword_results"."search_volume" >= 0),
	CONSTRAINT "keyword_results_cpc_check" CHECK ("keyword_results"."cpc_micros" is null or "keyword_results"."cpc_micros" >= 0),
	CONSTRAINT "keyword_results_competition_check" CHECK ("keyword_results"."competition" is null or "keyword_results"."competition" between 0 and 1),
	CONSTRAINT "keyword_results_difficulty_check" CHECK ("keyword_results"."difficulty" is null or "keyword_results"."difficulty" between 0 and 100),
	CONSTRAINT "keyword_results_trend_array_check" CHECK ("keyword_results"."trend" is null or jsonb_typeof("keyword_results"."trend") = 'array')
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_hash_check" CHECK ("password_reset_tokens"."token_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "password_reset_tokens_expiry_check" CHECK ("password_reset_tokens"."expires_at" > "password_reset_tokens"."created_at"),
	CONSTRAINT "password_reset_tokens_used_after_created_check" CHECK ("password_reset_tokens"."used_at" is null or "password_reset_tokens"."used_at" >= "password_reset_tokens"."created_at")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"target_domain" varchar(253),
	"description" varchar(500),
	"default_country_code" varchar(2) DEFAULT 'US' NOT NULL,
	"default_language_code" varchar(35) DEFAULT 'en' NOT NULL,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "projects_name_not_blank_check" CHECK (char_length(btrim("projects"."name")) > 0),
	CONSTRAINT "projects_domain_normalized_check" CHECK ("projects"."target_domain" is null or ("projects"."target_domain" = lower(btrim("projects"."target_domain")) and char_length("projects"."target_domain") > 0)),
	CONSTRAINT "projects_country_code_check" CHECK ("projects"."default_country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "projects_language_code_check" CHECK ("projects"."default_language_code" ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
	CONSTRAINT "projects_version_check" CHECK ("projects"."version" > 0),
	CONSTRAINT "projects_updated_after_created_check" CHECK ("projects"."updated_at" >= "projects"."created_at")
);
--> statement-breakpoint
CREATE TABLE "provider_markets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"provider" varchar(80) NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"location_code" integer NOT NULL,
	"location_name" varchar(255) NOT NULL,
	"location_type" varchar(80) NOT NULL,
	"canonical_name" varchar(500) NOT NULL,
	"parent_location_code" integer,
	"active" boolean DEFAULT true NOT NULL,
	"provider_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_markets_provider_not_blank_check" CHECK (char_length(btrim("provider_markets"."provider")) > 0),
	CONSTRAINT "provider_markets_country_code_check" CHECK ("provider_markets"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "provider_markets_language_code_check" CHECK ("provider_markets"."language_code" ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
	CONSTRAINT "provider_markets_location_code_check" CHECK ("provider_markets"."location_code" > 0),
	CONSTRAINT "provider_markets_location_name_not_blank_check" CHECK (char_length(btrim("provider_markets"."location_name")) > 0),
	CONSTRAINT "provider_markets_location_type_not_blank_check" CHECK (char_length(btrim("provider_markets"."location_type")) > 0),
	CONSTRAINT "provider_markets_canonical_name_not_blank_check" CHECK (char_length(btrim("provider_markets"."canonical_name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "provider_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"run_id" uuid,
	"provider" varchar(80) NOT NULL,
	"operation" varchar(120) NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"external_request_id" varchar(200),
	"status" "provider_request_status" DEFAULT 'queued' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"response_status" smallint,
	"request_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response_metadata" jsonb,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_requests_provider_not_blank_check" CHECK (char_length(btrim("provider_requests"."provider")) > 0),
	CONSTRAINT "provider_requests_operation_not_blank_check" CHECK (char_length(btrim("provider_requests"."operation")) > 0),
	CONSTRAINT "provider_requests_hash_check" CHECK ("provider_requests"."request_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "provider_requests_request_metadata_object_check" CHECK (jsonb_typeof("provider_requests"."request_metadata") = 'object'),
	CONSTRAINT "provider_requests_response_metadata_object_check" CHECK ("provider_requests"."response_metadata" is null or jsonb_typeof("provider_requests"."response_metadata") = 'object'),
	CONSTRAINT "provider_requests_attempts_check" CHECK ("provider_requests"."attempts" between 0 and 100),
	CONSTRAINT "provider_requests_response_status_check" CHECK ("provider_requests"."response_status" is null or "provider_requests"."response_status" between 100 and 599),
	CONSTRAINT "provider_requests_cost_check" CHECK ("provider_requests"."cost_micros" >= 0),
	CONSTRAINT "provider_requests_terminal_state_check" CHECK ((("provider_requests"."status" in ('succeeded', 'failed')) = ("provider_requests"."finished_at" is not null)))
);
--> statement-breakpoint
CREATE TABLE "research_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"query" varchar(500) NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"device" "research_device" DEFAULT 'desktop' NOT NULL,
	"configuration" jsonb NOT NULL,
	"status" "research_run_status" DEFAULT 'queued' NOT NULL,
	"progress" smallint DEFAULT 0 NOT NULL,
	"keyword_count" integer DEFAULT 0 NOT NULL,
	"error_code" varchar(80),
	"error_message" varchar(500),
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_runs_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "research_runs_id_project_owner_unique" UNIQUE("id","project_id","owner_id"),
	CONSTRAINT "research_runs_query_not_blank_check" CHECK (char_length(btrim("research_runs"."query")) > 0),
	CONSTRAINT "research_runs_request_hash_check" CHECK ("research_runs"."request_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "research_runs_country_code_check" CHECK ("research_runs"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "research_runs_language_code_check" CHECK ("research_runs"."language_code" ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
	CONSTRAINT "research_runs_progress_check" CHECK ("research_runs"."progress" between 0 and 100),
	CONSTRAINT "research_runs_keyword_count_check" CHECK ("research_runs"."keyword_count" >= 0),
	CONSTRAINT "research_runs_configuration_object_check" CHECK (jsonb_typeof("research_runs"."configuration") = 'object'),
	CONSTRAINT "research_runs_started_after_created_check" CHECK ("research_runs"."started_at" is null or "research_runs"."started_at" >= "research_runs"."created_at"),
	CONSTRAINT "research_runs_finished_after_started_check" CHECK ("research_runs"."finished_at" is null or "research_runs"."finished_at" >= coalesce("research_runs"."started_at", "research_runs"."created_at")),
	CONSTRAINT "research_runs_terminal_state_check" CHECK ((("research_runs"."status" in ('completed', 'failed', 'cancelled')) = ("research_runs"."finished_at" is not null))),
	CONSTRAINT "research_runs_updated_after_created_check" CHECK ("research_runs"."updated_at" >= "research_runs"."created_at")
);
--> statement-breakpoint
CREATE TABLE "saved_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"format" "report_format" DEFAULT 'dashboard' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_reports_name_not_blank_check" CHECK (char_length(btrim("saved_reports"."name")) > 0),
	CONSTRAINT "saved_reports_snapshot_object_check" CHECK (jsonb_typeof("saved_reports"."snapshot") = 'object'),
	CONSTRAINT "saved_reports_version_check" CHECK ("saved_reports"."version" > 0),
	CONSTRAINT "saved_reports_updated_after_created_check" CHECK ("saved_reports"."updated_at" >= "saved_reports"."created_at")
);
--> statement-breakpoint
CREATE TABLE "serp_results" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"rank" smallint NOT NULL,
	"page" smallint DEFAULT 1 NOT NULL,
	"result_type" "serp_result_type" NOT NULL,
	"title" varchar(500),
	"url" text,
	"domain" varchar(253),
	"description" text,
	"is_target_domain" boolean DEFAULT false NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "serp_results_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "serp_results_rank_check" CHECK ("serp_results"."rank" > 0),
	CONSTRAINT "serp_results_page_check" CHECK ("serp_results"."page" > 0),
	CONSTRAINT "serp_results_features_array_check" CHECK (jsonb_typeof("serp_results"."features") = 'array'),
	CONSTRAINT "serp_results_content_check" CHECK ("serp_results"."title" is not null or "serp_results"."url" is not null or jsonb_array_length("serp_results"."features") > 0),
	CONSTRAINT "serp_results_domain_normalized_check" CHECK ("serp_results"."domain" is null or "serp_results"."domain" = lower(btrim("serp_results"."domain")))
);
--> statement-breakpoint
CREATE TABLE "serp_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"keyword_result_id" bigint,
	"keyword" varchar(500) NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"device" "research_device" NOT NULL,
	"provider" varchar(80) NOT NULL,
	"provider_request_id" varchar(160),
	"content_hash" varchar(64) NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "serp_snapshots_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "serp_snapshots_keyword_not_blank_check" CHECK (char_length(btrim("serp_snapshots"."keyword")) > 0),
	CONSTRAINT "serp_snapshots_provider_not_blank_check" CHECK (char_length(btrim("serp_snapshots"."provider")) > 0),
	CONSTRAINT "serp_snapshots_hash_check" CHECK ("serp_snapshots"."content_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "serp_snapshots_country_code_check" CHECK ("serp_snapshots"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "serp_snapshots_language_code_check" CHECK ("serp_snapshots"."language_code" ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
	CONSTRAINT "serp_snapshots_expiry_check" CHECK ("serp_snapshots"."expires_at" > "serp_snapshots"."fetched_at")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"session_version" integer DEFAULT 0 NOT NULL,
	"failed_auth_attempts" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"email_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_normalized_check" CHECK ("users"."email" = lower(btrim("users"."email"))),
	CONSTRAINT "users_email_shape_check" CHECK ("users"."email" like '%_@_%._%'),
	CONSTRAINT "users_display_name_not_blank_check" CHECK (char_length(btrim("users"."display_name")) > 0),
	CONSTRAINT "users_password_hash_argon2id_check" CHECK (char_length("users"."password_hash") >= 32 and "users"."password_hash" like '$argon2id$%'),
	CONSTRAINT "users_session_version_check" CHECK ("users"."session_version" >= 0),
	CONSTRAINT "users_failed_auth_attempts_check" CHECK ("users"."failed_auth_attempts" between 0 and 100),
	CONSTRAINT "users_updated_after_created_check" CHECK ("users"."updated_at" >= "users"."created_at")
);
--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_run_owner_fk" FOREIGN KEY ("run_id","owner_id") REFERENCES "public"."research_runs"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_analysis_owner_fk" FOREIGN KEY ("analysis_id","owner_id") REFERENCES "public"."ai_analyses"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_keyword_owner_fk" FOREIGN KEY ("keyword_result_id","owner_id") REFERENCES "public"."keyword_results"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_serp_result_owner_fk" FOREIGN KEY ("serp_result_id","owner_id") REFERENCES "public"."serp_results"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_usage" ADD CONSTRAINT "daily_usage_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_outbox" ADD CONSTRAINT "job_outbox_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_results" ADD CONSTRAINT "keyword_results_run_owner_fk" FOREIGN KEY ("run_id","owner_id") REFERENCES "public"."research_runs"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_requests" ADD CONSTRAINT "provider_requests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_requests" ADD CONSTRAINT "provider_requests_run_owner_fk" FOREIGN KEY ("run_id","owner_id") REFERENCES "public"."research_runs"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_project_owner_fk" FOREIGN KEY ("project_id","owner_id") REFERENCES "public"."projects"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_run_project_owner_fk" FOREIGN KEY ("run_id","project_id","owner_id") REFERENCES "public"."research_runs"("id","project_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_results" ADD CONSTRAINT "serp_results_snapshot_owner_fk" FOREIGN KEY ("snapshot_id","owner_id") REFERENCES "public"."serp_snapshots"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_snapshots" ADD CONSTRAINT "serp_snapshots_run_owner_fk" FOREIGN KEY ("run_id","owner_id") REFERENCES "public"."research_runs"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_snapshots" ADD CONSTRAINT "serp_snapshots_keyword_run_owner_fk" FOREIGN KEY ("keyword_result_id","run_id","owner_id") REFERENCES "public"."keyword_results"("id","run_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_analyses_run_type_input_model_version_unique" ON "ai_analyses" USING btree ("run_id","type","input_hash","model","prompt_version");--> statement-breakpoint
CREATE INDEX "ai_analyses_owner_run_created_idx" ON "ai_analyses" USING btree ("owner_id","run_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_analyses_status_created_idx" ON "ai_analyses" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_citations_analysis_position_unique" ON "ai_citations" USING btree ("analysis_id","position");--> statement-breakpoint
CREATE INDEX "ai_citations_owner_analysis_idx" ON "ai_citations" USING btree ("owner_id","analysis_id");--> statement-breakpoint
CREATE INDEX "audit_logs_owner_created_idx" ON "audit_logs" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_created_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_created_idx" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_usage_owner_date_provider_metric_unique" ON "daily_usage" USING btree ("owner_id","usage_date","provider","metric");--> statement-breakpoint
CREATE INDEX "daily_usage_date_provider_idx" ON "daily_usage" USING btree ("usage_date","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "job_outbox_idempotency_unique" ON "job_outbox" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "job_outbox_dispatch_idx" ON "job_outbox" USING btree ("status","available_at","created_at") WHERE "job_outbox"."status" in ('pending', 'failed');--> statement-breakpoint
CREATE INDEX "job_outbox_owner_created_idx" ON "job_outbox" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "keyword_results_run_keyword_market_unique" ON "keyword_results" USING btree ("run_id","normalized_keyword","country_code","language_code");--> statement-breakpoint
CREATE INDEX "keyword_results_owner_run_id_idx" ON "keyword_results" USING btree ("owner_id","run_id","id");--> statement-breakpoint
CREATE INDEX "keyword_results_run_volume_idx" ON "keyword_results" USING btree ("run_id","search_volume");--> statement-breakpoint
CREATE INDEX "keyword_results_run_difficulty_idx" ON "keyword_results" USING btree ("run_id","difficulty");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_expiry_idx" ON "password_reset_tokens" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_owner_name_unique" ON "projects" USING btree ("owner_id",lower(btrim("name")));--> statement-breakpoint
CREATE INDEX "projects_owner_status_updated_idx" ON "projects" USING btree ("owner_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_markets_provider_location_language_unique" ON "provider_markets" USING btree ("provider","location_code","language_code");--> statement-breakpoint
CREATE INDEX "provider_markets_lookup_idx" ON "provider_markets" USING btree ("provider","country_code","language_code","active");--> statement-breakpoint
CREATE INDEX "provider_markets_name_idx" ON "provider_markets" USING btree ("provider","location_name");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_requests_owner_provider_idempotency_unique" ON "provider_requests" USING btree ("owner_id","provider","idempotency_key");--> statement-breakpoint
CREATE INDEX "provider_requests_run_created_idx" ON "provider_requests" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "provider_requests_retry_idx" ON "provider_requests" USING btree ("status","next_retry_at") WHERE "provider_requests"."status" in ('queued', 'failed');--> statement-breakpoint
CREATE UNIQUE INDEX "research_runs_owner_idempotency_unique" ON "research_runs" USING btree ("owner_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "research_runs_owner_created_idx" ON "research_runs" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "research_runs_project_created_idx" ON "research_runs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "research_runs_status_created_idx" ON "research_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_reports_owner_project_name_unique" ON "saved_reports" USING btree ("owner_id","project_id",lower(btrim("name")));--> statement-breakpoint
CREATE INDEX "saved_reports_owner_updated_idx" ON "saved_reports" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "saved_reports_project_created_idx" ON "saved_reports" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "serp_results_snapshot_type_rank_unique" ON "serp_results" USING btree ("snapshot_id","result_type","rank");--> statement-breakpoint
CREATE INDEX "serp_results_owner_snapshot_rank_idx" ON "serp_results" USING btree ("owner_id","snapshot_id","rank");--> statement-breakpoint
CREATE INDEX "serp_results_domain_idx" ON "serp_results" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "serp_snapshots_run_market_hash_unique" ON "serp_snapshots" USING btree ("run_id","country_code","language_code","device","content_hash");--> statement-breakpoint
CREATE INDEX "serp_snapshots_owner_run_fetched_idx" ON "serp_snapshots" USING btree ("owner_id","run_id","fetched_at");--> statement-breakpoint
CREATE INDEX "serp_snapshots_expiry_idx" ON "serp_snapshots" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_status_created_idx" ON "users" USING btree ("status","created_at");