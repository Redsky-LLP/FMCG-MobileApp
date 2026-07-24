using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FMCG.Distribution.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeedSizeGroupSortOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── The previous migration (AddSortOrderToSizeGroups) added the column with
            // EF's own default of 0 for every existing row, instead of the intended -1
            // ("not yet assigned"). Because the report handlers treat any value >= 0 as a
            // real, trustable priority, every group currently reads as priority 0 and ties
            // with every other group. This fixes that in two steps:
            //
            // 1. Reset every group back to -1 (the true "unassigned" sentinel).
            // 2. Re-seed the 8 known groups with their correct 1-8 priority, matching the
            //    client's hand-written "Size Group Priority" reference sheet.
            //
            // Any group NOT in this list (custom/future groups) is left at -1 and the
            // report handlers fall back to a heaviest-first guess for those, until someone
            // reorders it from the Size Groups admin screen. ──
            migrationBuilder.Sql(@"UPDATE ""SizeGroups"" SET ""SortOrder"" = -1;");

            migrationBuilder.Sql(@"
                UPDATE ""SizeGroups"" SET ""SortOrder"" = 1 WHERE UPPER(""Name"") = '50 KG BAG';
                UPDATE ""SizeGroups"" SET ""SortOrder"" = 2 WHERE UPPER(""Name"") = '30 KG BAG';
                UPDATE ""SizeGroups"" SET ""SortOrder"" = 3 WHERE UPPER(""Name"") = '26 KG BAG';
                UPDATE ""SizeGroups"" SET ""SortOrder"" = 4 WHERE UPPER(""Name"") = '20 KG BAG';
                UPDATE ""SizeGroups"" SET ""SortOrder"" = 5 WHERE UPPER(""Name"") = '20 LTR CASE';
                UPDATE ""SizeGroups"" SET ""SortOrder"" = 6 WHERE UPPER(""Name"") = '10 LTR CASE';
                UPDATE ""SizeGroups"" SET ""SortOrder"" = 7 WHERE UPPER(""Name"") = '15 LTR TIN';
                UPDATE ""SizeGroups"" SET ""SortOrder"" = 8 WHERE UPPER(""Name"") = '5 LTR CAN';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data-only migration — nothing to structurally roll back. Reverting the seed
            // itself isn't meaningful (there's no "before" state worth restoring to), so
            // Down() is intentionally a no-op here.
        }
    }
}