-- Add publicId column to scripts
ALTER TABLE `scripts`
ADD COLUMN `publicId` VARCHAR(32);
