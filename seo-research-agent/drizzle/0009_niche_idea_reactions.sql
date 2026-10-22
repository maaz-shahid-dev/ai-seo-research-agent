CREATE TABLE "niche_idea_reactions" (
	"owner_id" uuid NOT NULL,
	"idea_id" uuid NOT NULL,
	"status" varchar(12) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "niche_idea_reactions_owner_id_idea_id_pk" PRIMARY KEY("owner_id","idea_id"),
	CONSTRAINT "niche_idea_reactions_status_check" CHECK ("niche_idea_reactions"."status" in ('favorite', 'dismissed'))
);
--> statement-breakpoint
ALTER TABLE "niche_idea_reactions" ADD CONSTRAINT "niche_idea_reactions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "niche_idea_reactions" ADD CONSTRAINT "niche_idea_reactions_idea_id_niche_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."niche_ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "niche_idea_reactions_owner_status_idx" ON "niche_idea_reactions" USING btree ("owner_id","status","updated_at");