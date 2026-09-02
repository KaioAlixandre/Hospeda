-- CreateTable
CREATE TABLE `Hotel` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `ownerName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Hotel_phone_key`(`phone`),
    INDEX `Hotel_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed hotel padrão para dados existentes (senha: hospeda123)
INSERT INTO `Hotel` (`id`, `name`, `ownerName`, `phone`, `passwordHash`, `createdAt`, `updatedAt`)
VALUES (
  'hotel_default_legacy',
  'Hotel padrão',
  'Proprietário',
  '00000000000',
  '$2b$10$.nucPXbiGTxkxOyQaTq9E.3O7OVW20U770RqBNe/68BNnuhMhY4Mi',
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
);

-- RoomType
ALTER TABLE `RoomType` ADD COLUMN `hotelId` VARCHAR(191) NULL;
UPDATE `RoomType` SET `hotelId` = 'hotel_default_legacy' WHERE `hotelId` IS NULL;
ALTER TABLE `RoomType` MODIFY COLUMN `hotelId` VARCHAR(191) NOT NULL;
ALTER TABLE `RoomType` DROP INDEX `RoomType_name_key`;
CREATE UNIQUE INDEX `RoomType_hotelId_name_key` ON `RoomType`(`hotelId`, `name`);
CREATE INDEX `RoomType_hotelId_idx` ON `RoomType`(`hotelId`);
ALTER TABLE `RoomType` ADD CONSTRAINT `RoomType_hotelId_fkey` FOREIGN KEY (`hotelId`) REFERENCES `Hotel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Room
ALTER TABLE `Room` ADD COLUMN `hotelId` VARCHAR(191) NULL;
UPDATE `Room` SET `hotelId` = 'hotel_default_legacy' WHERE `hotelId` IS NULL;
ALTER TABLE `Room` MODIFY COLUMN `hotelId` VARCHAR(191) NOT NULL;
ALTER TABLE `Room` DROP INDEX `Room_number_key`;
CREATE UNIQUE INDEX `Room_hotelId_number_key` ON `Room`(`hotelId`, `number`);
CREATE INDEX `Room_hotelId_idx` ON `Room`(`hotelId`);
ALTER TABLE `Room` ADD CONSTRAINT `Room_hotelId_fkey` FOREIGN KEY (`hotelId`) REFERENCES `Hotel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Guest (índice antigo pode ser Guest_cpf_key ou Guest_document_key)
ALTER TABLE `Guest` ADD COLUMN `hotelId` VARCHAR(191) NULL;
UPDATE `Guest` SET `hotelId` = 'hotel_default_legacy' WHERE `hotelId` IS NULL;
ALTER TABLE `Guest` MODIFY COLUMN `hotelId` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `Guest_hotelId_cpf_key` ON `Guest`(`hotelId`, `cpf`);
CREATE INDEX `Guest_hotelId_idx` ON `Guest`(`hotelId`);
ALTER TABLE `Guest` ADD CONSTRAINT `Guest_hotelId_fkey` FOREIGN KEY (`hotelId`) REFERENCES `Hotel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Reservation
ALTER TABLE `Reservation` ADD COLUMN `hotelId` VARCHAR(191) NULL;
UPDATE `Reservation` SET `hotelId` = 'hotel_default_legacy' WHERE `hotelId` IS NULL;
ALTER TABLE `Reservation` MODIFY COLUMN `hotelId` VARCHAR(191) NOT NULL;
CREATE INDEX `Reservation_hotelId_idx` ON `Reservation`(`hotelId`);
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_hotelId_fkey` FOREIGN KEY (`hotelId`) REFERENCES `Hotel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Zelador
ALTER TABLE `Zelador` ADD COLUMN `hotelId` VARCHAR(191) NULL;
UPDATE `Zelador` SET `hotelId` = 'hotel_default_legacy' WHERE `hotelId` IS NULL;
ALTER TABLE `Zelador` MODIFY COLUMN `hotelId` VARCHAR(191) NOT NULL;
CREATE INDEX `Zelador_hotelId_idx` ON `Zelador`(`hotelId`);
ALTER TABLE `Zelador` ADD CONSTRAINT `Zelador_hotelId_fkey` FOREIGN KEY (`hotelId`) REFERENCES `Hotel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
