CREATE TABLE IF NOT EXISTS `plans` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `monthly_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `yearly_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `max_users` INTEGER NOT NULL DEFAULT 1,
  `max_branches` INTEGER NOT NULL DEFAULT 1,
  `max_clients` INTEGER NOT NULL DEFAULT 50,
  `features_json` JSON NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `companies` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `rnc` VARCHAR(32) NULL,
  `logo` TEXT NULL,
  `status` ENUM('ACTIVE','RESTRICTED','SUSPENDED','TRIAL','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `plan_id` VARCHAR(64) NOT NULL,
  `billing_cycle` ENUM('MONTHLY','YEARLY') NOT NULL DEFAULT 'MONTHLY',
  `expires_at` DATE NULL,
  `billing_day` INTEGER NOT NULL DEFAULT 1,
  `subscription_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `config_json` JSON NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_companies_plan` (`plan_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `branches` (
  `id` VARCHAR(64) NOT NULL,
  `company_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `address` TEXT NOT NULL,
  `phone` VARCHAR(32) NULL,
  `logo` TEXT NULL,
  `manager_name` VARCHAR(160) NULL,
  `monthly_goal` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_branches_company` (`company_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL,
  `company_id` VARCHAR(64) NOT NULL,
  `branch_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `username` VARCHAR(80) NOT NULL,
  `email` VARCHAR(180) NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('Super Admin','Administrador','Supervisor','Cobrador') NOT NULL,
  `avatar` VARCHAR(12) NULL,
  `photo` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `phone` VARCHAR(32) NULL,
  `permissions_json` JSON NULL,
  `last_login_at` TIMESTAMP(0) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `users_username_key` (`username`),
  INDEX `idx_users_company_branch` (`company_id`, `branch_id`),
  INDEX `idx_users_company` (`company_id`),
  INDEX `idx_users_branch` (`branch_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(64) NOT NULL,
  `company_id` VARCHAR(64) NOT NULL,
  `branch_id` VARCHAR(64) NULL,
  `actor_user_id` VARCHAR(64) NULL,
  `action` VARCHAR(120) NOT NULL,
  `entity_type` VARCHAR(80) NOT NULL,
  `entity_id` VARCHAR(64) NULL,
  `metadata_json` JSON NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_audit_company_created` (`company_id`, `created_at`),
  INDEX `idx_audit_company` (`company_id`),
  INDEX `idx_audit_actor_user` (`actor_user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
