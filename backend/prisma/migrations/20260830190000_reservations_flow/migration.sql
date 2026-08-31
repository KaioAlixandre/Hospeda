UPDATE `Reservation` SET `status` = 'CONFIRMED' WHERE `status` = 'CHECKED_IN';
UPDATE `Reservation` SET `status` = 'COMPLETED' WHERE `status` = 'CHECKED_OUT';
UPDATE `Reservation` SET `status` = 'CANCELLED' WHERE `status` = 'NO_SHOW';

ALTER TABLE `Reservation`
  ADD COLUMN `guests` INTEGER NOT NULL DEFAULT 1;

UPDATE `Reservation` SET `guests` = `adults` + `children`;

ALTER TABLE `Reservation`
  DROP COLUMN `adults`,
  DROP COLUMN `children`;

ALTER TABLE `Reservation` MODIFY COLUMN `status` ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'PENDING';
