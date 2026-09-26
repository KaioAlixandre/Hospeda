-- AlterTable
ALTER TABLE `Hotel`
    ADD COLUMN `coverPhotoUrl` VARCHAR(191) NULL,
    ADD COLUMN `galleryPhotos` JSON NULL,
    ADD COLUMN `checkInTime` VARCHAR(191) NULL,
    ADD COLUMN `checkOutTime` VARCHAR(191) NULL,
    ADD COLUMN `brandColor` VARCHAR(191) NULL;
