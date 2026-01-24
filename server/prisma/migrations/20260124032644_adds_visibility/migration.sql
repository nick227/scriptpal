-- AlterTable
ALTER TABLE `scripts` ADD COLUMN `visibility` ENUM('private', 'public') NOT NULL DEFAULT 'private';
