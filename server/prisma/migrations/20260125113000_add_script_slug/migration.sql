-- Add slug column for clean URLs
ALTER TABLE `scripts`
  ADD COLUMN `slug` VARCHAR(80) NULL;

-- Index for slug lookups
CREATE INDEX `scripts_slug_idx` ON `scripts` (`slug`);

-- Per-user slug uniqueness
CREATE UNIQUE INDEX `scripts_user_id_slug_key` ON `scripts` (`userId`, `slug`);
