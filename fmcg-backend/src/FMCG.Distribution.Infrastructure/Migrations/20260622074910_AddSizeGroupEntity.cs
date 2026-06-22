using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FMCG.Distribution.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSizeGroupEntity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UQC",
                table: "ProductUnits",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SizeGroupId",
                table: "Products",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SizeGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NameMl = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SizeGroups", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Products_SizeGroupId",
                table: "Products",
                column: "SizeGroupId");

            migrationBuilder.AddForeignKey(
                name: "FK_Products_SizeGroups_SizeGroupId",
                table: "Products",
                column: "SizeGroupId",
                principalTable: "SizeGroups",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Products_SizeGroups_SizeGroupId",
                table: "Products");

            migrationBuilder.DropTable(
                name: "SizeGroups");

            migrationBuilder.DropIndex(
                name: "IX_Products_SizeGroupId",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "UQC",
                table: "ProductUnits");

            migrationBuilder.DropColumn(
                name: "SizeGroupId",
                table: "Products");
        }
    }
}
