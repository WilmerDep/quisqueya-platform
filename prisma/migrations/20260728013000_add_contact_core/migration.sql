CREATE TABLE `contacts` (
  `id` VARCHAR(64) NOT NULL,
  `company_id` VARCHAR(64) NOT NULL,
  `owner_user_id` VARCHAR(64) NULL,
  `first_name` VARCHAR(120) NOT NULL,
  `last_name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(180) NULL,
  `phone` VARCHAR(40) NULL,
  `whatsapp` VARCHAR(40) NULL,
  `country_code` VARCHAR(8) NULL,
  `preferred_language` VARCHAR(16) NULL,
  `source` VARCHAR(120) NULL,
  `notes` TEXT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `provenance_json` JSON NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL,

  INDEX `idx_contacts_company_status`(`company_id`, `status`),
  INDEX `idx_contacts_company_owner`(`company_id`, `owner_user_id`),
  INDEX `idx_contacts_company_email`(`company_id`, `email`),
  INDEX `idx_contacts_company_phone`(`company_id`, `phone`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
