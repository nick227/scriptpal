-- Rename outlines table to locations (preserve data when present)
SET @has_outlines := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'outlines'
);

SET @rename_sql := IF(@has_outlines > 0, 'RENAME TABLE `outlines` TO `locations`', 'SELECT 1');
PREPARE stmt FROM @rename_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure locations table exists for fresh databases
CREATE TABLE IF NOT EXISTS `locations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scriptId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` LONGTEXT NULL,
    `notes` LONGTEXT NULL,
    `tags` JSON NOT NULL,
    `sortIndex` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `locations_scriptId_idx`(`scriptId`),
    INDEX `locations_sortIndex_idx`(`sortIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @has_location_fk := (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'locations'
    AND constraint_name = 'locations_scriptId_fkey'
);

SET @fk_sql := IF(
  @has_location_fk > 0,
  'SELECT 1',
  'ALTER TABLE `locations` ADD CONSTRAINT `locations_scriptId_fkey` FOREIGN KEY (`scriptId`) REFERENCES `scripts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE'
);
PREPARE fk_stmt FROM @fk_sql;
EXECUTE fk_stmt;
DEALLOCATE PREPARE fk_stmt;
