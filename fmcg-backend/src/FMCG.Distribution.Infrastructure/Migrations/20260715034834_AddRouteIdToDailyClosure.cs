using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FMCG.Distribution.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRouteIdToDailyClosure : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "RouteId",
                table: "DailyClosures",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "RouteName",
                table: "DailyClosures",
                type: "text",
                nullable: true);

            // ✅ ADD THIS INDEX
            migrationBuilder.CreateIndex(
                name: "IX_DailyClosures_ClosureDate_RouteId",
                table: "DailyClosures",
                columns: new[] { "ClosureDate", "RouteId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // ✅ ADD THIS TOO
            migrationBuilder.DropIndex(
                name: "IX_DailyClosures_ClosureDate_RouteId",
                table: "DailyClosures");

            migrationBuilder.DropColumn(
                name: "RouteId",
                table: "DailyClosures");

            migrationBuilder.DropColumn(
                name: "RouteName",
                table: "DailyClosures");
        }
    }
}