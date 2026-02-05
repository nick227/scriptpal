-- Create script slug history table
CREATE TABLE `script_slugs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `scriptId` INT NOT NULL,
  `slug` VARCHAR(80) NOT NULL,
  `isCanonical` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `script_slugs_user_id_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`),
  CONSTRAINT `script_slugs_script_id_fkey` FOREIGN KEY (`scriptId`) REFERENCES `scripts`(`id`)
) ENGINE=InnoDB;

-- Unique slug per user
CREATE UNIQUE INDEX `script_slugs_user_id_slug_key` ON `script_slugs` (`userId`, `slug`);

-- Lookups by slug and canonical flag
CREATE INDEX `script_slugs_slug_idx` ON `script_slugs` (`slug`);
CREATE INDEX `script_slugs_script_id_is_canonical_idx` ON `script_slugs` (`scriptId`, `isCanonical`);

-- Backfill canonical slugs
INSERT INTO `script_slugs` (`userId`, `scriptId`, `slug`, `isCanonical`)
SELECT `userId`, `id`, `slug`, TRUE
FROM `scripts`
WHERE `slug` IS NOT NULL;
