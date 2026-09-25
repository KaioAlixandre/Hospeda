-- CreateTable
CREATE TABLE `ChargeCategory` (
    `id` VARCHAR(191) NOT NULL,
    `hotelId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `group` ENUM('CONSUMPTION', 'SERVICE', 'DISCOUNT') NOT NULL,
    `icon` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChargeCategory_hotelId_idx`(`hotelId`),
    UNIQUE INDEX `ChargeCategory_hotelId_name_key`(`hotelId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `hotelId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Product_hotelId_idx`(`hotelId`),
    INDEX `Product_categoryId_idx`(`categoryId`),
    INDEX `Product_active_idx`(`active`),
    UNIQUE INDEX `Product_hotelId_name_key`(`hotelId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `FolioCharge`
    ADD COLUMN `categoryId` VARCHAR(191) NULL,
    ADD COLUMN `productId` VARCHAR(191) NULL,
    ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `unitPrice` DECIMAL(10, 2) NULL;

-- CreateIndex
CREATE INDEX `FolioCharge_categoryId_idx` ON `FolioCharge`(`categoryId`);

-- CreateIndex
CREATE INDEX `FolioCharge_productId_idx` ON `FolioCharge`(`productId`);

-- AddForeignKey
ALTER TABLE `ChargeCategory` ADD CONSTRAINT `ChargeCategory_hotelId_fkey` FOREIGN KEY (`hotelId`) REFERENCES `Hotel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_hotelId_fkey` FOREIGN KEY (`hotelId`) REFERENCES `Hotel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ChargeCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FolioCharge` ADD CONSTRAINT `FolioCharge_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ChargeCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FolioCharge` ADD CONSTRAINT `FolioCharge_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
