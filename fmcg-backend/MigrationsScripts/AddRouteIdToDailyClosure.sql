-- Add RouteId column
ALTER TABLE ""DailyClosures"" ADD COLUMN IF NOT EXISTS ""RouteId"" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Add RouteName column
ALTER TABLE ""DailyClosures"" ADD COLUMN IF NOT EXISTS ""RouteName"" text NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS ""IX_DailyClosures_ClosureDate_RouteId"" ON ""DailyClosures"" (""ClosureDate"", ""RouteId"");

-- Record the migration in EF history
INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
VALUES ('20260715034834_AddRouteIdToDailyClosure', '8.0.0')
ON CONFLICT (""MigrationId"") DO NOTHING;
