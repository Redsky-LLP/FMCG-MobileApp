using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FMCG.Distribution.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUnitSizeAndIncentiveToProduct : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Incentive",
                table: "Products",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "UnitSize",
                table: "Products",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Incentive",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "UnitSize",
                table: "Products");
        }
    }
}
