-- AlterTable
ALTER TABLE `Hotel` ADD COLUMN `messagingInstanceId` VARCHAR(191) NULL,
    ADD COLUMN `messagingToken` VARCHAR(191) NULL,
    ADD COLUMN `messagingClientToken` VARCHAR(191) NULL;
