-- AlterTable
ALTER TABLE `users`
  ADD COLUMN `username` VARCHAR(191) NULL,
  ADD COLUMN `usernameNormalized` VARCHAR(191) NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `deletedAt` DATETIME(3) NULL,
  ADD COLUMN `deleteReason` LONGTEXT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_username_key` ON `users`(`username`);

-- CreateIndex
CREATE UNIQUE INDEX `users_usernameNormalized_key` ON `users`(`usernameNormalized`);
