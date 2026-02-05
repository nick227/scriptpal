-- Add publicId column to scripts
ALTER TABLE `scripts`
ADD COLUMN `publicId` VARCHAR(32);

-- Create script_slugs table
CREATE TABLE `script_slugs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `scriptId` INT NOT NULL,
  `slug` VARCHAR(80) NOT NULL,
  `isCanonical` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `script_slugs_userId_slug_key` (`userId`, `slug`),
  KEY `script_slugs_userId_isCanonical_idx` (`userId`, `isCanonical`),
  KEY `script_slugs_userId_scriptId_idx` (`userId`, `scriptId`)
);
