-- Add ClosedByRouteClosure column to Orders table
ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "ClosedByRouteClosure" boolean NOT NULL DEFAULT false;

-- Record the migration in EF history
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260715095909_AddClosedByRouteClosureToOrder', '8.0.0')
ON CONFLICT ("MigrationId") DO NOTHING;

