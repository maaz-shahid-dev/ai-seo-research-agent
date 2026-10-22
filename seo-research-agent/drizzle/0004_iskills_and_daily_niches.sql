CREATE TABLE "niche_ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idea_date" date NOT NULL,
	"niche" varchar(120) NOT NULL,
	"seed_keyword" varchar(120) NOT NULL,
	"problem" varchar(300) NOT NULL,
	"audience" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "niche_ideas_seed_not_blank_check" CHECK (char_length(btrim("niche_ideas"."seed_keyword")) > 0)
);
--> statement-breakpoint
ALTER TABLE "domain_metrics" ADD COLUMN "ranking_keywords" bigint;--> statement-breakpoint
CREATE UNIQUE INDEX "niche_ideas_date_seed_unique" ON "niche_ideas" USING btree ("idea_date",lower("seed_keyword"));--> statement-breakpoint
CREATE INDEX "niche_ideas_date_idx" ON "niche_ideas" USING btree ("idea_date");--> statement-breakpoint
ALTER TABLE "domain_metrics" ADD CONSTRAINT "domain_metrics_ranking_keywords_check" CHECK ("domain_metrics"."ranking_keywords" is null or "domain_metrics"."ranking_keywords" >= 0);