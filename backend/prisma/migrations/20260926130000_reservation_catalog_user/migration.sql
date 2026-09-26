-- AlterTable
ALTER TABLE `Reservation` ADD COLUMN `catalogUserId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Reservation_catalogUserId_idx` ON `Reservation`(`catalogUserId`);

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_catalogUserId_fkey` FOREIGN KEY (`catalogUserId`) REFERENCES `CatalogUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
