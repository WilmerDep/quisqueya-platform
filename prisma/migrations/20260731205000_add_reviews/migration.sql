CREATE TABLE `reviews` (
  `id` VARCHAR(64) NOT NULL,
  `source` ENUM('GOOGLE', 'MANUAL') NOT NULL DEFAULT 'GOOGLE',
  `external_id` VARCHAR(191) NULL,
  `author_name` VARCHAR(220) NOT NULL,
  `author_avatar_url` TEXT NULL,
  `rating` INTEGER NOT NULL,
  `review_text` LONGTEXT NOT NULL,
  `language` VARCHAR(20) NULL,
  `review_url` TEXT NULL,
  `reviewed_at` TIMESTAMP(0) NULL,
  `status` ENUM('PENDING', 'PUBLISHED', 'HIDDEN', 'ARCHIVED') NOT NULL DEFAULT 'PENDING',
  `featured` BOOLEAN NOT NULL DEFAULT false,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `source_payload` JSON NULL,
  `synced_at` TIMESTAMP(0) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL,

  UNIQUE INDEX `uniq_review_source_external`(`source`, `external_id`),
  INDEX `idx_reviews_publication`(`status`, `featured`, `sort_order`),
  INDEX `idx_reviews_source_date`(`source`, `reviewed_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
