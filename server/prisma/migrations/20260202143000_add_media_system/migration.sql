-- CreateTable
CREATE TABLE `media_assets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `type` ENUM('image', 'video') NOT NULL,
    `status` ENUM('processing', 'ready', 'failed') NOT NULL DEFAULT 'processing',
    `visibility` ENUM('private', 'shared', 'public') NOT NULL DEFAULT 'private',
    `source` ENUM('upload', 'ai') NOT NULL,
    `title` VARCHAR(191) NULL,
    `description` LONGTEXT NULL,
    `tags` JSON NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `durationMs` INTEGER NULL,
    `storageProvider` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `checksum` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `media_assets_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `media_assets_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media_variants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetId` INTEGER NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `format` VARCHAR(191) NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `sizeBytes` INTEGER NULL,
    `provider` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `media_variants_assetId_idx`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media_attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `ownerType` ENUM('script', 'scene', 'character', 'location', 'theme') NOT NULL,
    `ownerId` INTEGER NOT NULL,
    `role` ENUM('cover', 'inline', 'gallery', 'reference') NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `meta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `media_attachments_ownerType_ownerId_idx`(`ownerType`, `ownerId`),
    INDEX `media_attachments_assetId_idx`(`assetId`),
    INDEX `media_attachments_userId_idx`(`userId`),
    UNIQUE INDEX `media_attachments_ownerType_ownerId_role_key`(`ownerType`, `ownerId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media_generation_jobs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `type` ENUM('image', 'video') NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `prompt` LONGTEXT NOT NULL,
    `negativePrompt` LONGTEXT NULL,
    `params` JSON NULL,
    `provider` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `error` LONGTEXT NULL,
    `resultAssetId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `media_generation_jobs_userId_idx`(`userId`),
    INDEX `media_generation_jobs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `media_assets` ADD CONSTRAINT `media_assets_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media_variants` ADD CONSTRAINT `media_variants_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `media_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media_attachments` ADD CONSTRAINT `media_attachments_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `media_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
