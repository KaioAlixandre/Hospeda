-- AlterTable
ALTER TABLE `Reservation` ADD COLUMN `roomSelection` JSON NOT NULL DEFAULT ('[]');
