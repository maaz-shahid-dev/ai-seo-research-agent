ALTER TABLE "niche_ideas" ADD COLUMN "country_code" varchar(2) DEFAULT 'US' NOT NULL;--> statement-breakpoint
ALTER TABLE "niche_ideas" ADD COLUMN "search_volume" integer;--> statement-breakpoint
ALTER TABLE "niche_ideas" ADD COLUMN "difficulty" smallint;--> statement-breakpoint
ALTER TABLE "niche_ideas" ADD COLUMN "low_authority_count" smallint;--> statement-breakpoint
ALTER TABLE "niche_ideas" ADD CONSTRAINT "niche_ideas_country_check" CHECK ("niche_ideas"."country_code" ~ '^[A-Z]{2}$');--> statement-breakpoint
ALTER TABLE "niche_ideas" ADD CONSTRAINT "niche_ideas_low_authority_check" CHECK ("niche_ideas"."low_authority_count" is null or "niche_ideas"."low_authority_count" between 0 and 10);