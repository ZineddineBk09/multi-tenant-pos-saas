CREATE TABLE IF NOT EXISTS "tenant_cards" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"mime_type" text NOT NULL,
	"image" bytea NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_cards" ADD CONSTRAINT "tenant_cards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
