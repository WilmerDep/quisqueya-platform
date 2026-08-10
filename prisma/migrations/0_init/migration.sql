-- CreateTable
CREATE TABLE `plans` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `monthly_price` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `yearly_price` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `max_users` INTEGER NOT NULL DEFAULT 1,
    `max_branches` INTEGER NOT NULL DEFAULT 1,
    `max_clients` INTEGER NOT NULL DEFAULT 50,
    `features_json` JSON NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `companies` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `rnc` VARCHAR(32) NULL,
    `logo` TEXT NULL,
    `status` ENUM('ACTIVE', 'RESTRICTED', 'SUSPENDED', 'TRIAL', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `plan_id` VARCHAR(64) NOT NULL,
    `billing_cycle` ENUM('MONTHLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY',
    `expires_at` DATE NULL,
    `billing_day` INTEGER NOT NULL DEFAULT 1,
    `subscription_price` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `config_json` JSON NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_companies_plan`(`plan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branches` (
    `id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `address` TEXT NOT NULL,
    `phone` VARCHAR(32) NULL,
    `logo` TEXT NULL,
    `manager_name` VARCHAR(160) NULL,
    `monthly_goal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_branches_company`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `branch_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `username` VARCHAR(80) NOT NULL,
    `email` VARCHAR(180) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('Super Admin', 'Administrador', 'Supervisor', 'Cobrador') NOT NULL,
    `avatar` VARCHAR(12) NULL,
    `photo` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `phone` VARCHAR(32) NULL,
    `permissions_json` JSON NULL,
    `last_login_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `users_username_key`(`username`),
    INDEX `idx_users_company_branch`(`company_id`, `branch_id`),
    INDEX `idx_users_company`(`company_id`),
    INDEX `idx_users_branch`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clients` (
    `id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `branch_id` VARCHAR(64) NOT NULL,
    `first_name` VARCHAR(120) NOT NULL,
    `last_name` VARCHAR(120) NOT NULL,
    `nickname` VARCHAR(120) NULL,
    `cedula` VARCHAR(32) NOT NULL,
    `phone` VARCHAR(32) NOT NULL,
    `address` TEXT NOT NULL,
    `assigned_user_id` VARCHAR(64) NOT NULL,
    `credit_rating` ENUM('BUENA', 'REGULAR', 'MALA') NULL DEFAULT 'BUENA',
    `is_blocked` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('Pendiente', 'Aprobado', 'Rechazado') NOT NULL DEFAULT 'Pendiente',
    `photo` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_clients_company_branch`(`company_id`, `branch_id`),
    INDEX `idx_clients_company`(`company_id`),
    INDEX `idx_clients_assigned_user`(`assigned_user_id`),
    INDEX `idx_clients_branch`(`branch_id`),
    UNIQUE INDEX `uniq_client_company_cedula`(`company_id`, `cedula`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loans` (
    `id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `branch_id` VARCHAR(64) NOT NULL,
    `client_id` VARCHAR(64) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `interest_rate` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `frequency` ENUM('Diario', 'Semanal', 'Quincenal', 'Mensual') NOT NULL,
    `duration` INTEGER NOT NULL,
    `start_date` DATE NOT NULL,
    `total_to_pay` DECIMAL(12, 2) NOT NULL,
    `balance` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('Activo', 'Saldado', 'En Mora', 'Cancelado') NOT NULL DEFAULT 'Activo',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_loans_company_branch`(`company_id`, `branch_id`),
    INDEX `idx_loans_company`(`company_id`),
    INDEX `idx_loans_client`(`client_id`),
    INDEX `idx_loans_branch`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `installments` (
    `id` VARCHAR(64) NOT NULL,
    `loan_id` VARCHAR(64) NOT NULL,
    `number` INTEGER NOT NULL,
    `due_date` DATE NOT NULL,
    `expected_amount` DECIMAL(12, 2) NOT NULL,
    `paid_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` ENUM('PENDIENTE', 'PAGADO', 'PARCIAL', 'VENCIDO') NOT NULL DEFAULT 'PENDIENTE',
    `paid_at` TIMESTAMP(0) NULL,

    INDEX `idx_installments_loan_due`(`loan_id`, `due_date`),
    INDEX `idx_installments_loan`(`loan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `branch_id` VARCHAR(64) NOT NULL,
    `loan_id` VARCHAR(64) NOT NULL,
    `installment_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `mora_paid` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_payments_company_created`(`company_id`, `created_at`),
    INDEX `idx_payments_company`(`company_id`),
    INDEX `idx_payments_branch`(`branch_id`),
    INDEX `idx_payments_loan`(`loan_id`),
    INDEX `idx_payments_installment`(`installment_id`),
    INDEX `idx_payments_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_voids` (
    `id` VARCHAR(64) NOT NULL,
    `payment_id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `actor_user_id` VARCHAR(64) NOT NULL,
    `reason` TEXT NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uniq_void_payment`(`payment_id`),
    INDEX `idx_payment_voids_company`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collection_routes` (
    `id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `branch_id` VARCHAR(64) NOT NULL,
    `collector_id` VARCHAR(64) NOT NULL,
    `date` DATE NOT NULL,
    `status` ENUM('Abierta', 'En Curso', 'Cerrada') NOT NULL DEFAULT 'Abierta',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_routes_company_branch_date`(`company_id`, `branch_id`, `date`),
    INDEX `idx_routes_company`(`company_id`),
    INDEX `idx_routes_branch`(`branch_id`),
    INDEX `idx_routes_collector`(`collector_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `route_items` (
    `id` VARCHAR(64) NOT NULL,
    `route_id` VARCHAR(64) NOT NULL,
    `loan_id` VARCHAR(64) NOT NULL,
    `installment_id` VARCHAR(64) NULL,
    `client_id` VARCHAR(64) NOT NULL,
    `client_name` VARCHAR(240) NOT NULL,
    `address` TEXT NOT NULL,
    `amount_to_collect` DECIMAL(12, 2) NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `visit_status` ENUM('PENDING', 'VISITED', 'PAID', 'PROMISED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `visit_result` VARCHAR(40) NULL,
    `notes` TEXT NULL,

    INDEX `idx_route_items_route`(`route_id`),
    INDEX `idx_route_items_loan`(`loan_id`),
    INDEX `idx_route_items_installment`(`installment_id`),
    INDEX `idx_route_items_client`(`client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `visit_logs` (
    `id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `client_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `result` VARCHAR(80) NOT NULL,
    `note` TEXT NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_visit_logs_company_client`(`company_id`, `client_id`),
    INDEX `idx_visit_logs_client`(`client_id`),
    INDEX `idx_visit_logs_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_promises` (
    `id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `client_id` VARCHAR(64) NOT NULL,
    `loan_id` VARCHAR(64) NOT NULL,
    `date` DATE NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'PENDIENTE',
    `note` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_payment_promises_company_client`(`company_id`, `client_id`),
    INDEX `idx_payment_promises_client`(`client_id`),
    INDEX `idx_payment_promises_loan`(`loan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_movements` (
    `id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `branch_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `type` ENUM('IN', 'OUT') NOT NULL,
    `category` VARCHAR(40) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `note` TEXT NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_cash_company_branch_created`(`company_id`, `branch_id`, `created_at`),
    INDEX `idx_cash_company`(`company_id`),
    INDEX `idx_cash_branch`(`branch_id`),
    INDEX `idx_cash_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_closures` (
    `id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `branch_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `business_date` DATE NOT NULL,
    `theoretical_amount` DECIMAL(12, 2) NOT NULL,
    `counted_amount` DECIMAL(12, 2) NOT NULL,
    `difference_amount` DECIMAL(12, 2) NOT NULL,
    `status` VARCHAR(40) NOT NULL,
    `note` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_cash_closure_company_branch_created`(`company_id`, `branch_id`, `created_at`),
    INDEX `idx_cash_closure_user`(`user_id`),
    UNIQUE INDEX `uniq_cash_closure_company_branch_date`(`company_id`, `branch_id`, `business_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `report_exports` (
    `id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `branch_id` VARCHAR(64) NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `report_name` VARCHAR(180) NOT NULL,
    `report_type` VARCHAR(40) NOT NULL,
    `format` VARCHAR(16) NOT NULL,
    `range_label` VARCHAR(120) NOT NULL,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `branch_name` VARCHAR(160) NULL,
    `collector_id` VARCHAR(64) NULL,
    `collector_name` VARCHAR(180) NULL,
    `file_size_label` VARCHAR(40) NULL,
    `filters_json` JSON NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_report_exports_company_created`(`company_id`, `created_at`),
    INDEX `idx_report_exports_company`(`company_id`),
    INDEX `idx_report_exports_branch`(`branch_id`),
    INDEX `idx_report_exports_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `report_schedules` (
    `id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `branch_id` VARCHAR(64) NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `report_type` VARCHAR(40) NOT NULL,
    `format` VARCHAR(16) NOT NULL,
    `frequency` VARCHAR(24) NOT NULL,
    `delivery_hour` VARCHAR(16) NOT NULL,
    `target_label` VARCHAR(180) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_report_schedules_company_created`(`company_id`, `created_at`),
    INDEX `idx_report_schedules_branch`(`branch_id`),
    INDEX `idx_report_schedules_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `report_templates` (
    `id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `report_type` VARCHAR(255) NOT NULL,
    `status` VARCHAR(24) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `sections_json` JSON NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_report_templates_company_created`(`company_id`, `created_at`),
    INDEX `idx_report_templates_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `branch_id` VARCHAR(64) NULL,
    `actor_user_id` VARCHAR(64) NULL,
    `action` VARCHAR(120) NOT NULL,
    `entity_type` VARCHAR(80) NOT NULL,
    `entity_id` VARCHAR(64) NULL,
    `metadata_json` JSON NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_audit_company_created`(`company_id`, `created_at`),
    INDEX `idx_audit_company`(`company_id`),
    INDEX `idx_audit_actor_user`(`actor_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_queue` (
    `id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `branch_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `client_action_id` VARCHAR(120) NOT NULL,
    `action_type` VARCHAR(80) NOT NULL,
    `payload_json` JSON NOT NULL,
    `status` ENUM('PENDING', 'APPLIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `error_message` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_sync_company`(`company_id`),
    INDEX `idx_sync_user_status`(`user_id`, `status`),
    UNIQUE INDEX `uniq_sync_client_action`(`company_id`, `client_action_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `route_tracking_points` (
    `id` VARCHAR(64) NOT NULL,
    `route_id` VARCHAR(64) NOT NULL,
    `collector_id` VARCHAR(64) NOT NULL,
    `latitude` DECIMAL(10, 7) NOT NULL,
    `longitude` DECIMAL(10, 7) NOT NULL,
    `accuracy` DECIMAL(5, 2) NOT NULL,
    `speed` DECIMAL(5, 2) NOT NULL,
    `heading` DECIMAL(5, 2) NOT NULL,
    `battery` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_tracking_route`(`route_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
