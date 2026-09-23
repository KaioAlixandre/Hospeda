-- CreateTable
CREATE TABLE `PlanEvent` (
    `id` VARCHAR(191) NOT NULL,
    `hotelId` VARCHAR(191) NOT NULL,
    `fromPlan` ENUM('SIMPLES', 'PRO', 'PLUS') NULL,
    `toPlan` ENUM('SIMPLES', 'PRO', 'PLUS') NOT NULL,
    `fromStatus` ENUM('ACTIVE', 'PAST_DUE', 'CANCELLED') NULL,
    `toStatus` ENUM('ACTIVE', 'PAST_DUE', 'CANCELLED') NOT NULL,
    `paidUntil` DATE NULL,
    `note` TEXT NULL,
    `actor` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PlanEvent_hotelId_idx`(`hotelId`),
    INDEX `PlanEvent_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Hotel`
    ADD COLUMN `plan` ENUM('SIMPLES', 'PRO', 'PLUS') NOT NULL DEFAULT 'SIMPLES',
    ADD COLUMN `planStatus` ENUM('ACTIVE', 'PAST_DUE', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `planPaidUntil` DATE NULL,
    ADD COLUMN `planNotes` TEXT NULL,
    ADD COLUMN `slug` VARCHAR(191) NULL,
    ADD COLUMN `catalogEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `catalogHeadline` TEXT NULL,
    ADD COLUMN `catalogRules` TEXT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Hotel_slug_key` ON `Hotel`(`slug`);

-- AddForeignKey
ALTER TABLE `PlanEvent` ADD CONSTRAINT `PlanEvent_hotelId_fkey` FOREIGN KEY (`hotelId`) REFERENCES `Hotel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
