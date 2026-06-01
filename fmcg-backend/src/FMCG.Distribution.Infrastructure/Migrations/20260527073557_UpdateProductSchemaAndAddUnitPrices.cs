using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FMCG.Distribution.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateProductSchemaAndAddUnitPrices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Products_ProductUnits_ProductUnitId",
                table: "Products");

            migrationBuilder.RenameColumn(
                name: "ProductUnitId",
                table: "Products",
                newName: "DefaultUnitId");

            migrationBuilder.RenameIndex(
                name: "IX_Products_ProductUnitId",
                table: "Products",
                newName: "IX_Products_DefaultUnitId");

            migrationBuilder.AddColumn<decimal>(
                name: "ClosingStock",
                table: "Products",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "HSNCode",
                table: "Products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ItemCode",
                table: "Products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MaxOrderQty",
                table: "Products",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MinOrderQty",
                table: "Products",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Supplier",
                table: "Products",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProductUnitPrices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductUnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitSize = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    UnitSizeLabel = table.Column<string>(type: "text", nullable: true),
                    SalePrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SalePrice2 = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SalePrice3 = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SalePrice4 = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PurchaseRate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LandingCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MRP = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MOP = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Discount1 = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Discount2 = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Discount3 = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Discount4 = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    VAT = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    FloodCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductUnitPrices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductUnitPrices_ProductUnits_ProductUnitId",
                        column: x => x.ProductUnitId,
                        principalTable: "ProductUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductUnitPrices_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductUnitPrices_IsDefault",
                table: "ProductUnitPrices",
                column: "IsDefault");

            migrationBuilder.CreateIndex(
                name: "IX_ProductUnitPrices_ProductId_ProductUnitId",
                table: "ProductUnitPrices",
                columns: new[] { "ProductId", "ProductUnitId" });

            migrationBuilder.CreateIndex(
                name: "IX_ProductUnitPrices_ProductUnitId",
                table: "ProductUnitPrices",
                column: "ProductUnitId");

            migrationBuilder.AddForeignKey(
                name: "FK_Products_ProductUnits_DefaultUnitId",
                table: "Products",
                column: "DefaultUnitId",
                principalTable: "ProductUnits",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Products_ProductUnits_DefaultUnitId",
                table: "Products");

            migrationBuilder.DropTable(
                name: "ProductUnitPrices");

            migrationBuilder.DropColumn(
                name: "ClosingStock",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "HSNCode",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "ItemCode",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "MaxOrderQty",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "MinOrderQty",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Supplier",
                table: "Products");

            migrationBuilder.RenameColumn(
                name: "DefaultUnitId",
                table: "Products",
                newName: "ProductUnitId");

            migrationBuilder.RenameIndex(
                name: "IX_Products_DefaultUnitId",
                table: "Products",
                newName: "IX_Products_ProductUnitId");

            migrationBuilder.AddForeignKey(
                name: "FK_Products_ProductUnits_ProductUnitId",
                table: "Products",
                column: "ProductUnitId",
                principalTable: "ProductUnits",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
