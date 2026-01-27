-- DropForeignKey
ALTER TABLE `scenes` DROP FOREIGN KEY `scenes_scriptId_fkey`;

-- AlterTable
ALTER TABLE `chat_messages` ALTER COLUMN `prompt_tokens` DROP DEFAULT,
    ALTER COLUMN `completion_tokens` DROP DEFAULT,
    ALTER COLUMN `total_tokens` DROP DEFAULT,
    ALTER COLUMN `cost_usd` DROP DEFAULT;

-- CreateTable
CREATE TABLE `script_comments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scriptId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `authorLabel` VARCHAR(255) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `script_comments_scriptId_idx`(`scriptId`),
    INDEX `script_comments_scriptId_isDeleted_idx`(`scriptId`, `isDeleted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `scenes` ADD CONSTRAINT `scenes_scriptId_fkey` FOREIGN KEY (`scriptId`) REFERENCES `scripts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `script_comments` ADD CONSTRAINT `script_comments_scriptId_fkey` FOREIGN KEY (`scriptId`) REFERENCES `scripts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `script_comments` ADD CONSTRAINT `script_comments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `scripts` RENAME INDEX `scripts_user_id_slug_key` TO `scripts_userId_slug_key`;
