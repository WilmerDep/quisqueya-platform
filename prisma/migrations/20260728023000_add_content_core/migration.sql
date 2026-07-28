CREATE TABLE `media_assets` (
  `id` VARCHAR(64) NOT NULL,
  `source_provider` ENUM('WORDPRESS', 'MANUAL', 'SYSTEM') NOT NULL DEFAULT 'MANUAL',
  `source_id` VARCHAR(120) NULL,
  `source_url` TEXT NULL,
  `storage_key` VARCHAR(500) NOT NULL,
  `public_url` TEXT NOT NULL,
  `file_name` VARCHAR(255) NULL,
  `mime_type` VARCHAR(120) NULL,
  `alt_text` TEXT NULL,
  `caption` TEXT NULL,
  `width` INTEGER NULL,
  `height` INTEGER NULL,
  `size_bytes` BIGINT NULL,
  `checksum` VARCHAR(128) NULL,
  `provenance_json` JSON NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL,
  UNIQUE INDEX `media_assets_storage_key_key`(`storage_key`),
  UNIQUE INDEX `uniq_media_source`(`source_provider`, `source_id`),
  INDEX `idx_media_source_provider`(`source_provider`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `destinations` (
  `id` VARCHAR(64) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `name` VARCHAR(220) NOT NULL,
  `description` LONGTEXT NULL,
  `featured_media_id` VARCHAR(64) NULL,
  `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'PUBLISHED',
  `source_provider` ENUM('WORDPRESS', 'MANUAL', 'SYSTEM') NOT NULL DEFAULT 'MANUAL',
  `source_id` VARCHAR(120) NULL,
  `source_url` TEXT NULL,
  `source_modified_at` TIMESTAMP(0) NULL,
  `provenance_json` JSON NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL,
  UNIQUE INDEX `destinations_slug_key`(`slug`),
  UNIQUE INDEX `uniq_destination_source`(`source_provider`, `source_id`),
  INDEX `idx_destinations_status`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `experiences` (
  `id` VARCHAR(64) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `excerpt` TEXT NULL,
  `description` LONGTEXT NULL,
  `duration` VARCHAR(120) NULL,
  `category_label` VARCHAR(180) NULL,
  `featured_media_id` VARCHAR(64) NULL,
  `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'PUBLISHED',
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `source_provider` ENUM('WORDPRESS', 'MANUAL', 'SYSTEM') NOT NULL DEFAULT 'MANUAL',
  `source_id` VARCHAR(120) NULL,
  `source_url` TEXT NULL,
  `source_modified_at` TIMESTAMP(0) NULL,
  `provenance_json` JSON NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL,
  UNIQUE INDEX `experiences_slug_key`(`slug`),
  UNIQUE INDEX `uniq_experience_source`(`source_provider`, `source_id`),
  INDEX `idx_experiences_status_order`(`status`, `sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `experience_destinations` (
  `experience_id` VARCHAR(64) NOT NULL,
  `destination_id` VARCHAR(64) NOT NULL,
  `is_primary` BOOLEAN NOT NULL DEFAULT false,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  INDEX `idx_experience_destinations_destination`(`destination_id`),
  PRIMARY KEY (`experience_id`, `destination_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `taxonomy_terms` (
  `id` VARCHAR(64) NOT NULL,
  `taxonomy` VARCHAR(120) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `name` VARCHAR(220) NOT NULL,
  `description` TEXT NULL,
  `source_provider` ENUM('WORDPRESS', 'MANUAL', 'SYSTEM') NOT NULL DEFAULT 'MANUAL',
  `source_id` VARCHAR(120) NULL,
  `provenance_json` JSON NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL,
  UNIQUE INDEX `uniq_taxonomy_slug`(`taxonomy`, `slug`),
  UNIQUE INDEX `uniq_taxonomy_source`(`source_provider`, `taxonomy`, `source_id`),
  INDEX `idx_taxonomy_terms_taxonomy`(`taxonomy`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `experience_taxonomy_terms` (
  `experience_id` VARCHAR(64) NOT NULL,
  `term_id` VARCHAR(64) NOT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  INDEX `idx_experience_taxonomy_term`(`term_id`),
  PRIMARY KEY (`experience_id`, `term_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `content_pages` (
  `id` VARCHAR(64) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `excerpt` TEXT NULL,
  `content` LONGTEXT NULL,
  `featured_media_id` VARCHAR(64) NULL,
  `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'PUBLISHED',
  `source_provider` ENUM('WORDPRESS', 'MANUAL', 'SYSTEM') NOT NULL DEFAULT 'MANUAL',
  `source_id` VARCHAR(120) NULL,
  `source_url` TEXT NULL,
  `source_modified_at` TIMESTAMP(0) NULL,
  `provenance_json` JSON NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL,
  UNIQUE INDEX `content_pages_slug_key`(`slug`),
  UNIQUE INDEX `uniq_content_page_source`(`source_provider`, `source_id`),
  INDEX `idx_content_pages_status`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
