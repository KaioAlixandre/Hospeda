ALTER TABLE `Guest`
  CHANGE COLUMN `document` `cpf` VARCHAR(191) NOT NULL,
  ADD COLUMN `street` VARCHAR(191) NULL,
  ADD COLUMN `number` VARCHAR(191) NULL,
  ADD COLUMN `complement` VARCHAR(191) NULL,
  ADD COLUMN `neighborhood` VARCHAR(191) NULL,
  ADD COLUMN `city` VARCHAR(191) NULL,
  ADD COLUMN `state` VARCHAR(2) NULL,
  ADD COLUMN `zipCode` VARCHAR(191) NULL;

CREATE INDEX `Guest_phone_idx` ON `Guest`(`phone`);
CREATE INDEX `Guest_name_idx` ON `Guest`(`name`);
