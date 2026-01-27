-- CreateTable
CREATE TABLE `scenes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scriptId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` LONGTEXT NULL,
    `notes` LONGTEXT NULL,
    `tags` JSON NOT NULL,
    `sortIndex` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `scenes_scriptId_idx`(`scriptId`),
    INDEX `scenes_sortIndex_idx`(`sortIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `scenes` ADD CONSTRAINT `scenes_scriptId_fkey` FOREIGN KEY (`scriptId`) REFERENCES `scripts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
