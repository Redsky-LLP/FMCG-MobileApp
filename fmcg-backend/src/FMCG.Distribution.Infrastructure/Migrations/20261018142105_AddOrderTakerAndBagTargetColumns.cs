using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FMCG.Distribution.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderTakerAndBagTargetColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // IF NOT EXISTS: safe on databases where these columns were already added by hand.
            migrationBuilder.Sql(@"ALTER TABLE ""Customers"" ADD COLUMN IF NOT EXISTS ""OrderTakenByAdmin"" boolean NOT NULL DEFAULT false;");
            migrationBuilder.Sql(@"ALTER TABLE ""Orders"" ADD COLUMN IF NOT EXISTS ""TakenByAdmin"" boolean NOT NULL DEFAULT false;");
            migrationBuilder.Sql(@"ALTER TABLE ""Routes"" ADD COLUMN IF NOT EXISTS ""DailyBagTarget"" integer NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Routes"" ADD COLUMN IF NOT EXISTS ""MonthlyBagTarget"" integer NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally empty: these columns hold live data, so we never drop them automatically.
        }
    }
}