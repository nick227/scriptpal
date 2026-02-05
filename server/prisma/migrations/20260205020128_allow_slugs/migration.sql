-- DropForeignKey
ALTER TABLE `media_assets` DROP FOREIGN KEY `media_assets_userId_fkey`;

-- DropForeignKey
ALTER TABLE `media_attachments` DROP FOREIGN KEY `media_attachments_assetId_fkey`;

-- DropForeignKey
ALTER TABLE `media_variants` DROP FOREIGN KEY `media_variants_assetId_fkey`;

-- CreateIndex
CREATE INDEX `chat_messages_createdAt_idx` ON `chat_messages`(`createdAt`);

-- CreateIndex
CREATE INDEX `chat_messages_userId_scriptId_idx` ON `chat_messages`(`userId`, `scriptId`);

-- CreateIndex
CREATE INDEX `script_versions_scriptId_versionNumber_idx` ON `script_versions`(`scriptId`, `versionNumber`);

-- CreateIndex
CREATE INDEX `sessions_expiresAt_idx` ON `sessions`(`expiresAt`);

-- AddForeignKey
ALTER TABLE `media_assets` ADD CONSTRAINT `media_assets_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media_variants` ADD CONSTRAINT `media_variants_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `media_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media_attachments` ADD CONSTRAINT `media_attachments_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `media_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

