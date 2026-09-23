-- AlterTable
ALTER TABLE `Hotel`
    ADD COLUMN `stripeCustomerId` VARCHAR(191) NULL,
    ADD COLUMN `stripeSubscriptionId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Hotel_stripeCustomerId_key` ON `Hotel`(`stripeCustomerId`);

-- CreateIndex
CREATE UNIQUE INDEX `Hotel_stripeSubscriptionId_key` ON `Hotel`(`stripeSubscriptionId`);
