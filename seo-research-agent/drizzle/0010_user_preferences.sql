ALTER TABLE "users" ADD COLUMN "default_country_code" varchar(2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "theme" varchar(5) DEFAULT 'light' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "table_density" varchar(12) DEFAULT 'comfortable' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_default_country_check" CHECK ("users"."default_country_code" is null or "users"."default_country_code" ~ '^[A-Z]{2}$');--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_theme_check" CHECK ("users"."theme" in ('light', 'dark'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_table_density_check" CHECK ("users"."table_density" in ('comfortable', 'compact'));