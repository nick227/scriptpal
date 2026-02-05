-- Add publicId column for deterministic public routing
ALTER TABLE `scripts`
  ADD COLUMN `publicId` VARCHAR(32) NULL AFTER `slug`;

-- Backfill existing public scripts with generated IDs
UPDATE `scripts`
SET `publicId` = REPLACE(UUID(), '-', '')
WHERE `visibility` = 'public' AND `publicId` IS NULL;

-- Enforce uniqueness on publicId
CREATE UNIQUE INDEX `scripts_public_id_key` ON `scripts` (`publicId`);
