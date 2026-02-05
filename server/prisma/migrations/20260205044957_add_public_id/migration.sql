-- DropForeignKey
ALTER TABLE `script_slugs` DROP FOREIGN KEY `script_slugs_script_id_fkey` IF EXISTS;

-- DropForeignKey
ALTER TABLE `script_slugs` DROP FOREIGN KEY `script_slugs_user_id_fkey` IF EXISTS;

-- AlterTable
ALTER TABLE `script_slugs` MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateIndex
CREATE INDEX `chat_messages_userId_idx` ON `chat_messages`(`userId`);

-- AddForeignKey
ALTER TABLE `script_slugs` ADD CONSTRAINT `script_slugs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `script_slugs` ADD CONSTRAINT `script_slugs_scriptId_fkey` FOREIGN KEY (`scriptId`) REFERENCES `scripts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `chat_messages` RENAME INDEX `chat_messages_scriptId_fkey` TO `chat_messages_scriptId_idx`;

-- RenameIndex
ALTER TABLE `media_attachments` RENAME INDEX `media_attachments_ownerType_ownerId_role_asset_key` TO `media_attachments_ownerType_ownerId_role_assetId_key`;

-- RenameIndex
ALTER TABLE `script_slugs` RENAME INDEX `script_slugs_script_id_is_canonical_idx` TO `script_slugs_scriptId_isCanonical_idx`;

-- RenameIndex
ALTER TABLE `script_slugs` RENAME INDEX `script_slugs_user_id_slug_key` TO `script_slugs_userId_slug_key`;

-- RenameIndex
ALTER TABLE `scripts` RENAME INDEX `scripts_public_id_key` TO `scripts_publicId_key`;
