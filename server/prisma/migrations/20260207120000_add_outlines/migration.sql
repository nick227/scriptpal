-- CreateTable
CREATE TABLE `outlines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scriptId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `items` JSON NOT NULL DEFAULT ('[]'),
    `sortIndex` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `outlines_scriptId_idx`(`scriptId`),
    INDEX `outlines_sortIndex_idx`(`sortIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `outlines` ADD CONSTRAINT `outlines_scriptId_fkey` FOREIGN KEY (`scriptId`) REFERENCES `scripts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
