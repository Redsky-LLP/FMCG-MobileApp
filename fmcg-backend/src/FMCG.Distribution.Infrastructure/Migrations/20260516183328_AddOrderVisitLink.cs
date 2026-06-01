using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FMCG.Distribution.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderVisitLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CustomerVisitId",
                table: "Orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_CustomerVisitId",
                table: "Orders",
                column: "CustomerVisitId");

            migrationBuilder.AddForeignKey(
                name: "FK_Orders_CustomerVisits_CustomerVisitId",
                table: "Orders",
                column: "CustomerVisitId",
                principalTable: "CustomerVisits",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Orders_CustomerVisits_CustomerVisitId",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_CustomerVisitId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "CustomerVisitId",
                table: "Orders");
        }
    }
}
