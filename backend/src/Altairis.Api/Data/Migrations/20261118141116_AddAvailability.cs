using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Altairis.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAvailability : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Availability",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoomId = table.Column<int>(type: "int", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    TotalRooms = table.Column<int>(type: "int", nullable: false),
                    BookedRooms = table.Column<int>(type: "int", nullable: false),
                    Price = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Availability", x => x.Id);
                    table.CheckConstraint("CK_Availability_BookedRooms", "[BookedRooms] >= 0 AND [BookedRooms] <= [TotalRooms]");
                    table.CheckConstraint("CK_Availability_Price", "[Price] IS NULL OR [Price] >= 0");
                    table.CheckConstraint("CK_Availability_TotalRooms", "[TotalRooms] >= 0");
                    table.ForeignKey(
                        name: "FK_Availability_Rooms_RoomId",
                        column: x => x.RoomId,
                        principalTable: "Rooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Availability_Date",
                table: "Availability",
                column: "Date")
                .Annotation("SqlServer:Include", new[] { "RoomId", "TotalRooms", "BookedRooms" });

            migrationBuilder.CreateIndex(
                name: "IX_Availability_RoomId_Date",
                table: "Availability",
                columns: new[] { "RoomId", "Date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Availability");
        }
    }
}
