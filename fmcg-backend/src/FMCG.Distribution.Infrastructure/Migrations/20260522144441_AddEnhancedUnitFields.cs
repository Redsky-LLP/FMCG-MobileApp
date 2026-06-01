using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FMCG.Distribution.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEnhancedUnitFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BaseUnitName",
                table: "ProductUnits",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "BaseUnitValue",
                table: "ProductUnits",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MeasurementType",
                table: "ProductUnits",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BaseUnitName",
                table: "ProductUnits");

            migrationBuilder.DropColumn(
                name: "BaseUnitValue",
                table: "ProductUnits");

            migrationBuilder.DropColumn(
                name: "MeasurementType",
                table: "ProductUnits");
        }
    }
}
