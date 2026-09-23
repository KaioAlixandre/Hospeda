-- AlterTable Guest: CPF opcional
ALTER TABLE `Guest` MODIFY `cpf` VARCHAR(191) NULL;

-- AlterTable Reservation: origem e expiração
ALTER TABLE `Reservation`
    ADD COLUMN `source` ENUM('DESK', 'ONLINE') NOT NULL DEFAULT 'DESK',
    ADD COLUMN `expiresAt` DATETIME(3) NULL;

CREATE INDEX `Reservation_expiresAt_idx` ON `Reservation`(`expiresAt`);
