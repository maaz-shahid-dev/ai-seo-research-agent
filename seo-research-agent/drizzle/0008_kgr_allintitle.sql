ALTER TABLE "keyword_results" ADD COLUMN "allintitle_count" integer;--> statement-breakpoint
ALTER TABLE "keyword_results" ADD COLUMN "allintitle_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "keyword_results" ADD CONSTRAINT "keyword_results_allintitle_check" CHECK ("keyword_results"."allintitle_count" is null or "keyword_results"."allintitle_count" >= 0);