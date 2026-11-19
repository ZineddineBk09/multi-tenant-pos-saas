ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "address" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "phone" text;--> statement-breakpoint
UPDATE "tenants" SET "address" = 'Shop #22, 2nd Floor, Al Hilal Market, Bara Bazar, Rawalpindi', "phone" = '0333-3187875' WHERE "slug" = 'amin-cosmetics' AND "address" IS NULL;--> statement-breakpoint
UPDATE "tenants" SET "address" = 'Shop # B1-A, Kamil Plaza, Basement Bara Bazar, Rawalpindi', "phone" = '03451523394' WHERE "slug" = 'imdad-cosmetics' AND "address" IS NULL;
