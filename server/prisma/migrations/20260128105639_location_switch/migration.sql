-- DropForeignKey
ALTER TABLE `locations` DROP FOREIGN KEY `locations_scriptId_fkey`;

-- CreateTable
CREATE TABLE `characters` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scriptId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` LONGTEXT NULL,
    `notes` LONGTEXT NULL,
    `tags` JSON NOT NULL,
    `sortIndex` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `characters_scriptId_idx`(`scriptId`),
    INDEX `characters_sortIndex_idx`(`sortIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `themes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scriptId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` LONGTEXT NULL,
    `notes` LONGTEXT NULL,
    `tags` JSON NOT NULL,
    `sortIndex` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `themes_scriptId_idx`(`scriptId`),
    INDEX `themes_sortIndex_idx`(`sortIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `characters` ADD CONSTRAINT `characters_scriptId_fkey` FOREIGN KEY (`scriptId`) REFERENCES `scripts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `locations` ADD CONSTRAINT `locations_scriptId_fkey` FOREIGN KEY (`scriptId`) REFERENCES `scripts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `themes` ADD CONSTRAINT `themes_scriptId_fkey` FOREIGN KEY (`scriptId`) REFERENCES `scripts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
