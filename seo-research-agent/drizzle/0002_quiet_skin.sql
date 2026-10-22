ALTER TABLE "ai_analyses" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN "lease_owner" varchar(160);--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "ai_analyses_status_lease_idx" ON "ai_analyses" USING btree ("status","lease_expires_at") WHERE "ai_analyses"."status" in ('queued', 'running');--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_version_check" CHECK ("ai_analyses"."version" > 0);--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_lease_state_check" CHECK (("ai_analyses"."status" = 'running') = ("ai_analyses"."lease_owner" is not null and "ai_analyses"."lease_expires_at" is not null));