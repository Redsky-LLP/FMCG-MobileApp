CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514032859_InitialCreate') THEN
    CREATE TABLE "Users" (
        "Id" uuid NOT NULL,
        "Email" character varying(100) NOT NULL,
        "PasswordHash" text NOT NULL,
        "FullName" character varying(100) NOT NULL,
        "Role" integer NOT NULL,
        "IsActive" boolean NOT NULL,
        "RefreshToken" character varying(500),
        "RefreshTokenExpiry" timestamp with time zone,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_Users" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514032859_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_Users_Email" ON "Users" ("Email");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514032859_InitialCreate') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260514032859_InitialCreate', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514100158_AddMasterDataEntities') THEN
    CREATE TABLE "ProductGroups" (
        "Id" uuid NOT NULL,
        "Name" character varying(100) NOT NULL,
        "Description" character varying(500),
        "IsActive" boolean NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_ProductGroups" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514100158_AddMasterDataEntities') THEN
    CREATE TABLE "Routes" (
        "Id" uuid NOT NULL,
        "Name" character varying(100) NOT NULL,
        "Description" character varying(500),
        "SequenceOrder" integer NOT NULL,
        "AssignedSalesmanId" uuid,
        "IsActive" boolean NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_Routes" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Routes_Users_AssignedSalesmanId" FOREIGN KEY ("AssignedSalesmanId") REFERENCES "Users" ("Id") ON DELETE SET NULL
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514100158_AddMasterDataEntities') THEN
    CREATE TABLE "Units" (
        "Id" uuid NOT NULL,
        "Name" character varying(50) NOT NULL,
        "Symbol" character varying(20),
        "IsActive" boolean NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_Units" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514100158_AddMasterDataEntities') THEN
    CREATE TABLE "Customers" (
        "Id" uuid NOT NULL,
        "NameEnglish" character varying(200) NOT NULL,
        "NameMalayalam" character varying(200) NOT NULL,
        "PhoneNumber" character varying(20) NOT NULL,
        "Address" character varying(500),
        "RouteId" uuid NOT NULL,
        "SequenceOrder" integer NOT NULL,
        "IsActive" boolean NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_Customers" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Customers_Routes_RouteId" FOREIGN KEY ("RouteId") REFERENCES "Routes" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514100158_AddMasterDataEntities') THEN
    CREATE TABLE "Products" (
        "Id" uuid NOT NULL,
        "NameEnglish" character varying(200) NOT NULL,
        "NameMalayalam" character varying(200) NOT NULL,
        "ProductGroupId" uuid NOT NULL,
        "UnitId" uuid NOT NULL,
        "BasePrice" numeric(18,2) NOT NULL,
        "IsActive" boolean NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_Products" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Products_ProductGroups_ProductGroupId" FOREIGN KEY ("ProductGroupId") REFERENCES "ProductGroups" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_Products_Units_UnitId" FOREIGN KEY ("UnitId") REFERENCES "Units" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514100158_AddMasterDataEntities') THEN
    CREATE INDEX "IX_Customers_NameMalayalam" ON "Customers" ("NameMalayalam");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514100158_AddMasterDataEntities') THEN
    CREATE INDEX "IX_Customers_RouteId_SequenceOrder" ON "Customers" ("RouteId", "SequenceOrder");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514100158_AddMasterDataEntities') THEN
    CREATE INDEX "IX_Products_NameMalayalam" ON "Products" ("NameMalayalam");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514100158_AddMasterDataEntities') THEN
    CREATE INDEX "IX_Products_ProductGroupId" ON "Products" ("ProductGroupId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514100158_AddMasterDataEntities') THEN
    CREATE INDEX "IX_Products_UnitId" ON "Products" ("UnitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514100158_AddMasterDataEntities') THEN
    CREATE INDEX "IX_Routes_AssignedSalesmanId" ON "Routes" ("AssignedSalesmanId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514100158_AddMasterDataEntities') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260514100158_AddMasterDataEntities', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514175234_AddProductUnitsAndProductGroups') THEN
    ALTER TABLE "Products" DROP CONSTRAINT "FK_Products_Units_UnitId";
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514175234_AddProductUnitsAndProductGroups') THEN
    DROP TABLE "Units";
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514175234_AddProductUnitsAndProductGroups') THEN
    ALTER TABLE "Products" RENAME COLUMN "UnitId" TO "ProductUnitId";
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514175234_AddProductUnitsAndProductGroups') THEN
    ALTER INDEX "IX_Products_UnitId" RENAME TO "IX_Products_ProductUnitId";
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514175234_AddProductUnitsAndProductGroups') THEN
    CREATE TABLE "ProductUnits" (
        "Id" uuid NOT NULL,
        "Name" character varying(50) NOT NULL,
        "Symbol" character varying(20),
        "IsActive" boolean NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_ProductUnits" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514175234_AddProductUnitsAndProductGroups') THEN
    ALTER TABLE "Products" ADD CONSTRAINT "FK_Products_ProductUnits_ProductUnitId" FOREIGN KEY ("ProductUnitId") REFERENCES "ProductUnits" ("Id") ON DELETE RESTRICT;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514175234_AddProductUnitsAndProductGroups') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260514175234_AddProductUnitsAndProductGroups', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515063201_AddOrderModule') THEN
    CREATE TABLE "Orders" (
        "Id" uuid NOT NULL,
        "OrderNumber" character varying(50) NOT NULL,
        "CustomerId" uuid NOT NULL,
        "RouteId" uuid NOT NULL,
        "SalesmanId" uuid NOT NULL,
        "OrderDate" timestamp with time zone NOT NULL,
        "Status" integer NOT NULL,
        "Remarks" character varying(1000),
        "SubmittedAt" timestamp with time zone,
        "ClosedAt" timestamp with time zone,
        "ModifiedBy" character varying(100),
        "ModifiedAt" timestamp with time zone,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_Orders" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Orders_Customers_CustomerId" FOREIGN KEY ("CustomerId") REFERENCES "Customers" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_Orders_Routes_RouteId" FOREIGN KEY ("RouteId") REFERENCES "Routes" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_Orders_Users_SalesmanId" FOREIGN KEY ("SalesmanId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515063201_AddOrderModule') THEN
    CREATE TABLE "OrderItems" (
        "Id" uuid NOT NULL,
        "OrderId" uuid NOT NULL,
        "ProductId" uuid NOT NULL,
        "Quantity" numeric(18,3) NOT NULL,
        "UnitId" uuid NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_OrderItems" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_OrderItems_Orders_OrderId" FOREIGN KEY ("OrderId") REFERENCES "Orders" ("Id") ON DELETE CASCADE,
        CONSTRAINT "FK_OrderItems_ProductUnits_UnitId" FOREIGN KEY ("UnitId") REFERENCES "ProductUnits" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_OrderItems_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515063201_AddOrderModule') THEN
    CREATE INDEX "IX_OrderItems_OrderId" ON "OrderItems" ("OrderId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515063201_AddOrderModule') THEN
    CREATE INDEX "IX_OrderItems_ProductId" ON "OrderItems" ("ProductId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515063201_AddOrderModule') THEN
    CREATE INDEX "IX_OrderItems_UnitId" ON "OrderItems" ("UnitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515063201_AddOrderModule') THEN
    CREATE INDEX "IX_Orders_CustomerId" ON "Orders" ("CustomerId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515063201_AddOrderModule') THEN
    CREATE INDEX "IX_Orders_CustomerId_OrderDate" ON "Orders" ("CustomerId", "OrderDate");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515063201_AddOrderModule') THEN
    CREATE UNIQUE INDEX "IX_Orders_OrderNumber" ON "Orders" ("OrderNumber");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515063201_AddOrderModule') THEN
    CREATE INDEX "IX_Orders_RouteId" ON "Orders" ("RouteId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515063201_AddOrderModule') THEN
    CREATE INDEX "IX_Orders_RouteId_Status" ON "Orders" ("RouteId", "Status");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515063201_AddOrderModule') THEN
    CREATE INDEX "IX_Orders_SalesmanId" ON "Orders" ("SalesmanId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515063201_AddOrderModule') THEN
    CREATE INDEX "IX_Orders_Status" ON "Orders" ("Status");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515063201_AddOrderModule') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260515063201_AddOrderModule', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515122232_AddPricingModule') THEN
    ALTER TABLE "OrderItems" ADD "BasePriceAtTime" numeric NOT NULL DEFAULT 0.0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515122232_AddPricingModule') THEN
    ALTER TABLE "OrderItems" ADD "SellingPrice" numeric NOT NULL DEFAULT 0.0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515122232_AddPricingModule') THEN
    CREATE TABLE "BasePrices" (
        "Id" uuid NOT NULL,
        "ProductId" uuid NOT NULL,
        "Price" numeric(18,2) NOT NULL,
        "EffectiveDate" timestamp with time zone NOT NULL,
        "IsActive" boolean NOT NULL,
        "Reason" character varying(500),
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_BasePrices" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_BasePrices_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515122232_AddPricingModule') THEN
    CREATE TABLE "PricingAuditLogs" (
        "Id" uuid NOT NULL,
        "ProductId" uuid NOT NULL,
        "OldPrice" numeric(18,2) NOT NULL,
        "NewPrice" numeric(18,2) NOT NULL,
        "Action" integer NOT NULL,
        "Reason" character varying(500),
        "ModifiedBy" character varying(100) NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_PricingAuditLogs" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_PricingAuditLogs_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515122232_AddPricingModule') THEN
    CREATE INDEX "IX_BasePrices_EffectiveDate" ON "BasePrices" ("EffectiveDate");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515122232_AddPricingModule') THEN
    CREATE INDEX "IX_BasePrices_ProductId" ON "BasePrices" ("ProductId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515122232_AddPricingModule') THEN
    CREATE INDEX "IX_BasePrices_ProductId_IsActive" ON "BasePrices" ("ProductId", "IsActive");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515122232_AddPricingModule') THEN
    CREATE INDEX "IX_PricingAuditLogs_Action" ON "PricingAuditLogs" ("Action");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515122232_AddPricingModule') THEN
    CREATE INDEX "IX_PricingAuditLogs_CreatedAt" ON "PricingAuditLogs" ("CreatedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515122232_AddPricingModule') THEN
    CREATE INDEX "IX_PricingAuditLogs_ProductId" ON "PricingAuditLogs" ("ProductId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515122232_AddPricingModule') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260515122232_AddPricingModule', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515173637_AddSettlementAndDailyClosure') THEN
    ALTER TABLE "Orders" ADD "ExpectedPaymentAmount" numeric(18,2);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515173637_AddSettlementAndDailyClosure') THEN
    ALTER TABLE "Orders" ADD "IsLocked" boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515173637_AddSettlementAndDailyClosure') THEN
    ALTER TABLE "Orders" ADD "SettlementStatus" integer NOT NULL DEFAULT 0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515173637_AddSettlementAndDailyClosure') THEN
    CREATE TABLE "DailyClosures" (
        "Id" uuid NOT NULL,
        "ClosureDate" timestamp with time zone NOT NULL,
        "ClosedAt" timestamp with time zone NOT NULL,
        "ClosedByUserId" uuid NOT NULL,
        "TotalSales" numeric(18,2) NOT NULL,
        "TotalOutstanding" numeric(18,2) NOT NULL,
        "ExpectedCash" numeric(18,2) NOT NULL,
        "IsActive" boolean NOT NULL,
        "Notes" character varying(500),
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_DailyClosures" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_DailyClosures_Users_ClosedByUserId" FOREIGN KEY ("ClosedByUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515173637_AddSettlementAndDailyClosure') THEN
    CREATE TABLE "Outstandings" (
        "Id" uuid NOT NULL,
        "CustomerId" uuid NOT NULL,
        "OrderId" uuid,
        "OutstandingAmount" numeric(18,2) NOT NULL,
        "SettlementStatus" integer NOT NULL,
        "SettledAt" timestamp with time zone,
        "SettlementReference" character varying(100),
        "Remarks" character varying(500),
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_Outstandings" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Outstandings_Customers_CustomerId" FOREIGN KEY ("CustomerId") REFERENCES "Customers" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_Outstandings_Orders_OrderId" FOREIGN KEY ("OrderId") REFERENCES "Orders" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515173637_AddSettlementAndDailyClosure') THEN
    CREATE TABLE "SettlementPayments" (
        "Id" uuid NOT NULL,
        "CustomerId" uuid NOT NULL,
        "Amount" numeric(18,2) NOT NULL,
        "PaymentDate" timestamp with time zone NOT NULL,
        "PaymentReference" character varying(100),
        "PaymentMode" character varying(50),
        "Remarks" character varying(500),
        "RecordedByUserId" uuid NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_SettlementPayments" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_SettlementPayments_Customers_CustomerId" FOREIGN KEY ("CustomerId") REFERENCES "Customers" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_SettlementPayments_Users_RecordedByUserId" FOREIGN KEY ("RecordedByUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515173637_AddSettlementAndDailyClosure') THEN
    CREATE INDEX "IX_Orders_IsLocked" ON "Orders" ("IsLocked");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515173637_AddSettlementAndDailyClosure') THEN
    CREATE INDEX "IX_DailyClosures_ClosedByUserId" ON "DailyClosures" ("ClosedByUserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515173637_AddSettlementAndDailyClosure') THEN
    CREATE INDEX "IX_DailyClosures_ClosureDate" ON "DailyClosures" ("ClosureDate");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515173637_AddSettlementAndDailyClosure') THEN
    CREATE INDEX "IX_Outstandings_CustomerId" ON "Outstandings" ("CustomerId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515173637_AddSettlementAndDailyClosure') THEN
    CREATE INDEX "IX_Outstandings_OrderId" ON "Outstandings" ("OrderId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515173637_AddSettlementAndDailyClosure') THEN
    CREATE INDEX "IX_Outstandings_SettlementStatus" ON "Outstandings" ("SettlementStatus");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515173637_AddSettlementAndDailyClosure') THEN
    CREATE INDEX "IX_SettlementPayments_CustomerId" ON "SettlementPayments" ("CustomerId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515173637_AddSettlementAndDailyClosure') THEN
    CREATE INDEX "IX_SettlementPayments_PaymentDate" ON "SettlementPayments" ("PaymentDate");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515173637_AddSettlementAndDailyClosure') THEN
    CREATE INDEX "IX_SettlementPayments_RecordedByUserId" ON "SettlementPayments" ("RecordedByUserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260515173637_AddSettlementAndDailyClosure') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260515173637_AddSettlementAndDailyClosure', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516054057_AddReportsSupport') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260516054057_AddReportsSupport', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516081717_AddProductIncentiveTable') THEN
    CREATE TABLE "ProductIncentives" (
        "Id" uuid NOT NULL,
        "ProductId" uuid NOT NULL,
        "IncentiveValue" numeric(18,2) NOT NULL,
        "IncentiveType" integer NOT NULL,
        "EffectiveDate" timestamp with time zone NOT NULL,
        "EndDate" timestamp with time zone,
        "IsActive" boolean NOT NULL,
        "Description" character varying(500),
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_ProductIncentives" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_ProductIncentives_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516081717_AddProductIncentiveTable') THEN
    CREATE INDEX "IX_ProductIncentives_EffectiveDate" ON "ProductIncentives" ("EffectiveDate");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516081717_AddProductIncentiveTable') THEN
    CREATE INDEX "IX_ProductIncentives_ProductId" ON "ProductIncentives" ("ProductId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516081717_AddProductIncentiveTable') THEN
    CREATE INDEX "IX_ProductIncentives_ProductId_EffectiveDate" ON "ProductIncentives" ("ProductId", "EffectiveDate");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516081717_AddProductIncentiveTable') THEN
    CREATE INDEX "IX_ProductIncentives_ProductId_IsActive" ON "ProductIncentives" ("ProductId", "IsActive");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516081717_AddProductIncentiveTable') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260516081717_AddProductIncentiveTable', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Users" ALTER COLUMN "UpdatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Users" ALTER COLUMN "RefreshTokenExpiry" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Users" ALTER COLUMN "CreatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "SettlementPayments" ALTER COLUMN "UpdatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "SettlementPayments" ALTER COLUMN "PaymentDate" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "SettlementPayments" ALTER COLUMN "CreatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Routes" ALTER COLUMN "UpdatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Routes" ALTER COLUMN "CreatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "ProductUnits" ALTER COLUMN "UpdatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "ProductUnits" ALTER COLUMN "CreatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "ProductUnits" ADD "Abbreviation" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Products" ALTER COLUMN "UpdatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Products" ALTER COLUMN "CreatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Products" ADD "Sku" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "ProductIncentives" ALTER COLUMN "UpdatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "ProductIncentives" ALTER COLUMN "EndDate" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "ProductIncentives" ALTER COLUMN "EffectiveDate" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "ProductIncentives" ALTER COLUMN "CreatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "ProductGroups" ALTER COLUMN "UpdatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "ProductGroups" ALTER COLUMN "CreatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "ProductGroups" ADD "NameMl" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "PricingAuditLogs" ALTER COLUMN "UpdatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "PricingAuditLogs" ALTER COLUMN "CreatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Outstandings" ALTER COLUMN "UpdatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Outstandings" ALTER COLUMN "SettledAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Outstandings" ALTER COLUMN "CreatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Orders" ALTER COLUMN "UpdatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Orders" ALTER COLUMN "SubmittedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Orders" ALTER COLUMN "OrderDate" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Orders" ALTER COLUMN "ModifiedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Orders" ALTER COLUMN "CreatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Orders" ALTER COLUMN "ClosedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "OrderItems" ALTER COLUMN "UpdatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "OrderItems" ALTER COLUMN "CreatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "DailyClosures" ALTER COLUMN "UpdatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "DailyClosures" ALTER COLUMN "CreatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "DailyClosures" ALTER COLUMN "ClosureDate" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "DailyClosures" ALTER COLUMN "ClosedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Customers" ALTER COLUMN "UpdatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "Customers" ALTER COLUMN "CreatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "BasePrices" ALTER COLUMN "UpdatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "BasePrices" ALTER COLUMN "EffectiveDate" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    ALTER TABLE "BasePrices" ALTER COLUMN "CreatedAt" TYPE timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260516135807_AddMissingColumns_Sku_NameMl_Abbreviation', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516172924_AddRouteExecutionAndCustomerVisit') THEN
    CREATE TABLE "RouteExecutions" (
        "Id" uuid NOT NULL,
        "RouteId" uuid NOT NULL,
        "SalesmanId" uuid NOT NULL,
        "ExecutionDate" timestamp without time zone NOT NULL,
        "Status" integer NOT NULL,
        "StartedAt" timestamp without time zone,
        "CompletedAt" timestamp without time zone,
        "CreatedAt" timestamp without time zone NOT NULL,
        "UpdatedAt" timestamp without time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_RouteExecutions" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_RouteExecutions_Routes_RouteId" FOREIGN KEY ("RouteId") REFERENCES "Routes" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_RouteExecutions_Users_SalesmanId" FOREIGN KEY ("SalesmanId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516172924_AddRouteExecutionAndCustomerVisit') THEN
    CREATE TABLE "CustomerVisits" (
        "Id" uuid NOT NULL,
        "RouteExecutionId" uuid NOT NULL,
        "CustomerId" uuid NOT NULL,
        "SequenceOrder" integer NOT NULL,
        "Status" integer NOT NULL,
        "OrderId" uuid,
        "VisitedAt" timestamp without time zone,
        "SkipReason" character varying(500),
        "CreatedAt" timestamp without time zone NOT NULL,
        "UpdatedAt" timestamp without time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_CustomerVisits" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_CustomerVisits_Customers_CustomerId" FOREIGN KEY ("CustomerId") REFERENCES "Customers" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_CustomerVisits_Orders_OrderId" FOREIGN KEY ("OrderId") REFERENCES "Orders" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_CustomerVisits_RouteExecutions_RouteExecutionId" FOREIGN KEY ("RouteExecutionId") REFERENCES "RouteExecutions" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516172924_AddRouteExecutionAndCustomerVisit') THEN
    CREATE INDEX "IX_CustomerVisits_CustomerId" ON "CustomerVisits" ("CustomerId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516172924_AddRouteExecutionAndCustomerVisit') THEN
    CREATE INDEX "IX_CustomerVisits_OrderId" ON "CustomerVisits" ("OrderId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516172924_AddRouteExecutionAndCustomerVisit') THEN
    CREATE INDEX "IX_CustomerVisits_RouteExecutionId" ON "CustomerVisits" ("RouteExecutionId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516172924_AddRouteExecutionAndCustomerVisit') THEN
    CREATE INDEX "IX_CustomerVisits_RouteExecutionId_SequenceOrder" ON "CustomerVisits" ("RouteExecutionId", "SequenceOrder");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516172924_AddRouteExecutionAndCustomerVisit') THEN
    CREATE INDEX "IX_RouteExecutions_RouteId_ExecutionDate" ON "RouteExecutions" ("RouteId", "ExecutionDate");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516172924_AddRouteExecutionAndCustomerVisit') THEN
    CREATE INDEX "IX_RouteExecutions_SalesmanId" ON "RouteExecutions" ("SalesmanId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516172924_AddRouteExecutionAndCustomerVisit') THEN
    CREATE INDEX "IX_RouteExecutions_Status" ON "RouteExecutions" ("Status");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516172924_AddRouteExecutionAndCustomerVisit') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260516172924_AddRouteExecutionAndCustomerVisit', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516183328_AddOrderVisitLink') THEN
    ALTER TABLE "Orders" ADD "CustomerVisitId" uuid;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516183328_AddOrderVisitLink') THEN
    CREATE INDEX "IX_Orders_CustomerVisitId" ON "Orders" ("CustomerVisitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516183328_AddOrderVisitLink') THEN
    ALTER TABLE "Orders" ADD CONSTRAINT "FK_Orders_CustomerVisits_CustomerVisitId" FOREIGN KEY ("CustomerVisitId") REFERENCES "CustomerVisits" ("Id") ON DELETE RESTRICT;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260516183328_AddOrderVisitLink') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260516183328_AddOrderVisitLink', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260518102737_AddPinFieldsToUsers') THEN
    ALTER TABLE "Users" ADD "PinFailCount" integer NOT NULL DEFAULT 0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260518102737_AddPinFieldsToUsers') THEN
    ALTER TABLE "Users" ADD "PinHash" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260518102737_AddPinFieldsToUsers') THEN
    ALTER TABLE "Users" ADD "PinLockedUntil" timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260518102737_AddPinFieldsToUsers') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260518102737_AddPinFieldsToUsers', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260519052954_AddUnitTypesToOrderItems') THEN
    ALTER TABLE "OrderItems" ADD "QuantityBags" integer;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260519052954_AddUnitTypesToOrderItems') THEN
    ALTER TABLE "OrderItems" ADD "QuantityBoxes" integer;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260519052954_AddUnitTypesToOrderItems') THEN
    ALTER TABLE "OrderItems" ADD "QuantityTins" integer;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260519052954_AddUnitTypesToOrderItems') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260519052954_AddUnitTypesToOrderItems', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260519175139_AddPackingStatusAndRouteAssignments') THEN
    ALTER TABLE "Orders" ADD "PackedAt" timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260519175139_AddPackingStatusAndRouteAssignments') THEN
    ALTER TABLE "Orders" ADD "PackedByUserId" uuid;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260519175139_AddPackingStatusAndRouteAssignments') THEN
    ALTER TABLE "Orders" ADD "PackingStatus" integer NOT NULL DEFAULT 0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260519175139_AddPackingStatusAndRouteAssignments') THEN
    CREATE TABLE "RouteAssignments" (
        "Id" uuid NOT NULL,
        "RouteId" uuid NOT NULL,
        "SalesmanId" uuid NOT NULL,
        "AssignmentDate" timestamp without time zone NOT NULL,
        "Notes" character varying(500),
        "IsOverride" boolean NOT NULL DEFAULT TRUE,
        "CreatedAt" timestamp without time zone NOT NULL,
        "UpdatedAt" timestamp without time zone,
        "IsDeleted" boolean NOT NULL DEFAULT FALSE,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_RouteAssignments" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_RouteAssignments_Routes_RouteId" FOREIGN KEY ("RouteId") REFERENCES "Routes" ("Id") ON DELETE CASCADE,
        CONSTRAINT "FK_RouteAssignments_Users_SalesmanId" FOREIGN KEY ("SalesmanId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260519175139_AddPackingStatusAndRouteAssignments') THEN
    CREATE UNIQUE INDEX "IX_RouteAssignments_RouteId_AssignmentDate" ON "RouteAssignments" ("RouteId", "AssignmentDate") WHERE "IsDeleted" = false;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260519175139_AddPackingStatusAndRouteAssignments') THEN
    CREATE INDEX "IX_RouteAssignments_SalesmanId" ON "RouteAssignments" ("SalesmanId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260519175139_AddPackingStatusAndRouteAssignments') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260519175139_AddPackingStatusAndRouteAssignments', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260519190914_AddLoadingPriorityToProductUnits') THEN
    ALTER TABLE "ProductUnits" ADD "LoadingPriority" integer NOT NULL DEFAULT 0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260519190914_AddLoadingPriorityToProductUnits') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260519190914_AddLoadingPriorityToProductUnits', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260522144441_AddEnhancedUnitFields') THEN
    ALTER TABLE "ProductUnits" ADD "BaseUnitName" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260522144441_AddEnhancedUnitFields') THEN
    ALTER TABLE "ProductUnits" ADD "BaseUnitValue" numeric;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260522144441_AddEnhancedUnitFields') THEN
    ALTER TABLE "ProductUnits" ADD "MeasurementType" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260522144441_AddEnhancedUnitFields') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260522144441_AddEnhancedUnitFields', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260525072719_AddExecutionTypeToRouteExecutions') THEN
    ALTER TABLE "RouteExecutions" ADD "ExecutionType" integer NOT NULL DEFAULT 0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260525072719_AddExecutionTypeToRouteExecutions') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260525072719_AddExecutionTypeToRouteExecutions', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260526051747_AddOrderStatusValues') THEN
    ALTER TABLE "Orders" ADD "ApprovedAt" timestamp without time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260526051747_AddOrderStatusValues') THEN
    ALTER TABLE "Orders" ADD "ApprovedBy" uuid;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260526051747_AddOrderStatusValues') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260526051747_AddOrderStatusValues', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260527073557_UpdateProductSchemaAndAddUnitPrices') THEN
    ALTER TABLE "Products" DROP CONSTRAINT "FK_Products_ProductUnits_ProductUnitId";
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260527073557_UpdateProductSchemaAndAddUnitPrices') THEN
    ALTER TABLE "Products" RENAME COLUMN "ProductUnitId" TO "DefaultUnitId";
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260527073557_UpdateProductSchemaAndAddUnitPrices') THEN
    ALTER INDEX "IX_Products_ProductUnitId" RENAME TO "IX_Products_DefaultUnitId";
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260527073557_UpdateProductSchemaAndAddUnitPrices') THEN
    ALTER TABLE "Products" ADD "ClosingStock" numeric NOT NULL DEFAULT 0.0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260527073557_UpdateProductSchemaAndAddUnitPrices') THEN
    ALTER TABLE "Products" ADD "HSNCode" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260527073557_UpdateProductSchemaAndAddUnitPrices') THEN
    ALTER TABLE "Products" ADD "ItemCode" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260527073557_UpdateProductSchemaAndAddUnitPrices') THEN
    ALTER TABLE "Products" ADD "MaxOrderQty" numeric;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260527073557_UpdateProductSchemaAndAddUnitPrices') THEN
    ALTER TABLE "Products" ADD "MinOrderQty" numeric;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260527073557_UpdateProductSchemaAndAddUnitPrices') THEN
    ALTER TABLE "Products" ADD "Supplier" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260527073557_UpdateProductSchemaAndAddUnitPrices') THEN
    CREATE TABLE "ProductUnitPrices" (
        "Id" uuid NOT NULL,
        "ProductId" uuid NOT NULL,
        "ProductUnitId" uuid NOT NULL,
        "UnitSize" numeric(18,3) NOT NULL,
        "UnitSizeLabel" text,
        "SalePrice" numeric(18,2) NOT NULL,
        "SalePrice2" numeric(18,2) NOT NULL,
        "SalePrice3" numeric(18,2) NOT NULL,
        "SalePrice4" numeric(18,2) NOT NULL,
        "PurchaseRate" numeric(18,2) NOT NULL,
        "LandingCost" numeric(18,2) NOT NULL,
        "MRP" numeric(18,2) NOT NULL,
        "MOP" numeric(18,2) NOT NULL,
        "Discount1" numeric(18,2) NOT NULL,
        "Discount2" numeric(18,2) NOT NULL,
        "Discount3" numeric(18,2) NOT NULL,
        "Discount4" numeric(18,2) NOT NULL,
        "VAT" numeric(18,2) NOT NULL,
        "FloodCost" numeric(18,2) NOT NULL,
        "IsDefault" boolean NOT NULL,
        "IsActive" boolean NOT NULL,
        "CreatedAt" timestamp without time zone NOT NULL,
        "UpdatedAt" timestamp without time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_ProductUnitPrices" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_ProductUnitPrices_ProductUnits_ProductUnitId" FOREIGN KEY ("ProductUnitId") REFERENCES "ProductUnits" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_ProductUnitPrices_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260527073557_UpdateProductSchemaAndAddUnitPrices') THEN
    CREATE INDEX "IX_ProductUnitPrices_IsDefault" ON "ProductUnitPrices" ("IsDefault");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260527073557_UpdateProductSchemaAndAddUnitPrices') THEN
    CREATE INDEX "IX_ProductUnitPrices_ProductId_ProductUnitId" ON "ProductUnitPrices" ("ProductId", "ProductUnitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260527073557_UpdateProductSchemaAndAddUnitPrices') THEN
    CREATE INDEX "IX_ProductUnitPrices_ProductUnitId" ON "ProductUnitPrices" ("ProductUnitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260527073557_UpdateProductSchemaAndAddUnitPrices') THEN
    ALTER TABLE "Products" ADD CONSTRAINT "FK_Products_ProductUnits_DefaultUnitId" FOREIGN KEY ("DefaultUnitId") REFERENCES "ProductUnits" ("Id") ON DELETE RESTRICT;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260527073557_UpdateProductSchemaAndAddUnitPrices') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260527073557_UpdateProductSchemaAndAddUnitPrices', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260616145815_AddOrderNumberSequence') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260616145815_AddOrderNumberSequence', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260619065404_AddUserSessions') THEN
    ALTER TABLE "Users" ADD "UserName" character varying(50);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260619065404_AddUserSessions') THEN
    CREATE TABLE "UserSessions" (
        "Id" uuid NOT NULL,
        "UserId" uuid NOT NULL,
        "LoginAt" timestamp without time zone NOT NULL,
        "LogoutAt" timestamp without time zone,
        "LoginMethod" text NOT NULL,
        "DeviceHint" text,
        "CreatedAt" timestamp without time zone NOT NULL,
        "UpdatedAt" timestamp without time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_UserSessions" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_UserSessions_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260619065404_AddUserSessions') THEN
    CREATE UNIQUE INDEX "IX_Users_UserName" ON "Users" ("UserName") WHERE "UserName" IS NOT NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260619065404_AddUserSessions') THEN
    CREATE INDEX "IX_UserSessions_UserId" ON "UserSessions" ("UserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260619065404_AddUserSessions') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260619065404_AddUserSessions', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260622074910_AddSizeGroupEntity') THEN
    ALTER TABLE "ProductUnits" ADD "UQC" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260622074910_AddSizeGroupEntity') THEN
    ALTER TABLE "Products" ADD "SizeGroupId" uuid;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260622074910_AddSizeGroupEntity') THEN
    CREATE TABLE "SizeGroups" (
        "Id" uuid NOT NULL,
        "Name" character varying(100) NOT NULL,
        "NameMl" character varying(200),
        "Description" character varying(500),
        "IsActive" boolean NOT NULL,
        "CreatedAt" timestamp without time zone NOT NULL,
        "UpdatedAt" timestamp without time zone,
        "IsDeleted" boolean NOT NULL,
        "CreatedBy" text,
        "UpdatedBy" text,
        CONSTRAINT "PK_SizeGroups" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260622074910_AddSizeGroupEntity') THEN
    CREATE INDEX "IX_Products_SizeGroupId" ON "Products" ("SizeGroupId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260622074910_AddSizeGroupEntity') THEN
    ALTER TABLE "Products" ADD CONSTRAINT "FK_Products_SizeGroups_SizeGroupId" FOREIGN KEY ("SizeGroupId") REFERENCES "SizeGroups" ("Id") ON DELETE RESTRICT;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260622074910_AddSizeGroupEntity') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260622074910_AddSizeGroupEntity', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260711123025_AddPinRequiresUpdateToUsers') THEN
    ALTER TABLE "Users" ADD "PinRequiresUpdate" boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260711123025_AddPinRequiresUpdateToUsers') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260711123025_AddPinRequiresUpdateToUsers', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260713085925_AddUnitSizeAndIncentiveToProduct') THEN
    ALTER TABLE "Products" ADD "Incentive" numeric;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260713085925_AddUnitSizeAndIncentiveToProduct') THEN
    ALTER TABLE "Products" ADD "UnitSize" numeric;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260713085925_AddUnitSizeAndIncentiveToProduct') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260713085925_AddUnitSizeAndIncentiveToProduct', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260715034834_AddRouteIdToDailyClosure') THEN
    ALTER TABLE "DailyClosures" ADD "RouteId" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260715034834_AddRouteIdToDailyClosure') THEN
    ALTER TABLE "DailyClosures" ADD "RouteName" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260715034834_AddRouteIdToDailyClosure') THEN
    CREATE INDEX "IX_DailyClosures_ClosureDate_RouteId" ON "DailyClosures" ("ClosureDate", "RouteId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260715034834_AddRouteIdToDailyClosure') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260715034834_AddRouteIdToDailyClosure', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260715095909_AddClosedByRouteClosureToOrder') THEN
    ALTER TABLE "Orders" ADD "ClosedByRouteClosure" boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260715095909_AddClosedByRouteClosureToOrder') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260715095909_AddClosedByRouteClosureToOrder', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260723071459_AddSortOrderToSizeGroups') THEN
    ALTER TABLE "SizeGroups" ADD "SortOrder" integer NOT NULL DEFAULT 0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260723071459_AddSortOrderToSizeGroups') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260723071459_AddSortOrderToSizeGroups', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260723072649_SeedSizeGroupSortOrder') THEN
    UPDATE "SizeGroups" SET "SortOrder" = -1;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260723072649_SeedSizeGroupSortOrder') THEN

                    UPDATE "SizeGroups" SET "SortOrder" = 1 WHERE UPPER("Name") = '50 KG BAG';
                    UPDATE "SizeGroups" SET "SortOrder" = 2 WHERE UPPER("Name") = '30 KG BAG';
                    UPDATE "SizeGroups" SET "SortOrder" = 3 WHERE UPPER("Name") = '26 KG BAG';
                    UPDATE "SizeGroups" SET "SortOrder" = 4 WHERE UPPER("Name") = '20 KG BAG';
                    UPDATE "SizeGroups" SET "SortOrder" = 5 WHERE UPPER("Name") = '20 LTR CASE';
                    UPDATE "SizeGroups" SET "SortOrder" = 6 WHERE UPPER("Name") = '10 LTR CASE';
                    UPDATE "SizeGroups" SET "SortOrder" = 7 WHERE UPPER("Name") = '15 LTR TIN';
                    UPDATE "SizeGroups" SET "SortOrder" = 8 WHERE UPPER("Name") = '5 LTR CAN';
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260723072649_SeedSizeGroupSortOrder') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260723072649_SeedSizeGroupSortOrder', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260723103014_AddNameSnapshotToOrderItems') THEN
    ALTER TABLE "OrderItems" ADD "ProductNameAtTime" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260723103014_AddNameSnapshotToOrderItems') THEN
    ALTER TABLE "OrderItems" ADD "ProductNameMalayalamAtTime" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260723103014_AddNameSnapshotToOrderItems') THEN
    ALTER TABLE "OrderItems" ADD "SizeGroupNameAtTime" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260723103014_AddNameSnapshotToOrderItems') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260723103014_AddNameSnapshotToOrderItems', '8.0.0');
    END IF;
END $EF$;
COMMIT;

