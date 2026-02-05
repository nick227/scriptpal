-- Drop the single-role uniqueness so gallery can keep multiple assets
ALTER TABLE `media_attachments` DROP INDEX `media_attachments_ownerType_ownerId_role_key`;

-- Enforce uniqueness per asset while allowing multiple attachments for the same role
ALTER TABLE `media_attachments`
  ADD UNIQUE INDEX `media_attachments_ownerType_ownerId_role_asset_key` (`ownerType`, `ownerId`, `role`, `assetId`);
