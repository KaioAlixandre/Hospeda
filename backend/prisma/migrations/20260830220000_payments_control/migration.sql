UPDATE `Payment` SET `method` = 'CASH' WHERE `method` = 'TRANSFER';

ALTER TABLE `Payment`
  MODIFY COLUMN `method` ENUM('PIX', 'CARD', 'CASH') NOT NULL,
  ADD COLUMN `status` ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN `cancelledAt` DATETIME(3) NULL,
  ADD COLUMN `refundedAt` DATETIME(3) NULL,
  ADD COLUMN `refundOfId` VARCHAR(191) NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  MODIFY COLUMN `paidAt` DATETIME(3) NULL;

UPDATE `Payment` SET `paidAt` = COALESCE(`paidAt`, `createdAt`) WHERE `status` = 'CONFIRMED';

CREATE INDEX `Payment_status_idx` ON `Payment`(`status`);
CREATE INDEX `Payment_refundOfId_idx` ON `Payment`(`refundOfId`);

ALTER TABLE `Payment`
  ADD CONSTRAINT `Payment_refundOfId_fkey`
  FOREIGN KEY (`refundOfId`) REFERENCES `Payment`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
