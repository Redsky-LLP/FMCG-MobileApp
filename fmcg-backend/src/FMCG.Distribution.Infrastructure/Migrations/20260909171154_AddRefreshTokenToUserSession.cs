using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FMCG.Distribution.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRefreshTokenToUserSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RefreshToken",
                table: "UserSessions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RefreshTokenExpiry",
                table: "UserSessions",
                type: "timestamp without time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RefreshToken",
                table: "UserSessions");

            migrationBuilder.DropColumn(
                name: "RefreshTokenExpiry",
                table: "UserSessions");
        }
    }
}
