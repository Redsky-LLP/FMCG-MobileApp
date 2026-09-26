using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FMCG.Distribution.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueActiveOrderPerCustomer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_CustomerId",
                table: "Orders");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_CustomerId_ActiveUnique",
                table: "Orders",
                column: "CustomerId",
                unique: true,
                filter: "\"IsDeleted\" = false AND \"Status\" <> 5");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_CustomerId_ActiveUnique",
                table: "Orders");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_CustomerId",
                table: "Orders",
                column: "CustomerId");
        }
    }
}
