CREATE TABLE IF NOT EXISTS plans (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  monthly_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  yearly_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  max_users INT NOT NULL DEFAULT 1,
  max_branches INT NOT NULL DEFAULT 1,
  max_clients INT NOT NULL DEFAULT 50,
  features_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS companies (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  rnc VARCHAR(32) NULL,
  logo TEXT NULL,
  status ENUM('ACTIVE','RESTRICTED','SUSPENDED','TRIAL','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  plan_id VARCHAR(64) NOT NULL,
  billing_cycle ENUM('MONTHLY','YEARLY') NOT NULL DEFAULT 'MONTHLY',
  expires_at DATE NULL,
  billing_day INT NOT NULL DEFAULT 1,
  subscription_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  config_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS branches (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  name VARCHAR(160) NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(32) NULL,
  logo TEXT NULL,
  manager_name VARCHAR(160) NULL,
  monthly_goal DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_branches_company (company_id)
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  name VARCHAR(180) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(180) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Super Admin','Administrador','Supervisor','Cobrador') NOT NULL,
  avatar VARCHAR(12) NULL,
  photo TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  phone VARCHAR(32) NULL,
  permissions_json JSON NULL,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_company_branch (company_id, branch_id)
);

CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  nickname VARCHAR(120) NULL,
  cedula VARCHAR(32) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  address TEXT NOT NULL,
  assigned_user_id VARCHAR(64) NOT NULL,
  credit_rating ENUM('BUENA','REGULAR','MALA') NULL DEFAULT 'BUENA',
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('Pendiente','Aprobado','Rechazado') NOT NULL DEFAULT 'Pendiente',
  photo TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_client_company_cedula (company_id, cedula),
  INDEX idx_clients_company_branch (company_id, branch_id)
);

CREATE TABLE IF NOT EXISTS loans (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  interest_rate DECIMAL(8,2) NOT NULL DEFAULT 0,
  frequency ENUM('Diario','Semanal','Quincenal','Mensual') NOT NULL,
  duration INT NOT NULL,
  start_date DATE NOT NULL,
  total_to_pay DECIMAL(12,2) NOT NULL,
  balance DECIMAL(12,2) NOT NULL,
  status ENUM('Activo','Saldado','En Mora','Cancelado') NOT NULL DEFAULT 'Activo',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_loans_company_branch (company_id, branch_id),
  INDEX idx_loans_client (client_id)
);

CREATE TABLE IF NOT EXISTS installments (
  id VARCHAR(64) PRIMARY KEY,
  loan_id VARCHAR(64) NOT NULL,
  number INT NOT NULL,
  due_date DATE NOT NULL,
  expected_amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('PENDIENTE','PAGADO','PARCIAL','VENCIDO') NOT NULL DEFAULT 'PENDIENTE',
  paid_at TIMESTAMP NULL,
  INDEX idx_installments_loan_due (loan_id, due_date)
);

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  loan_id VARCHAR(64) NOT NULL,
  installment_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  mora_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payments_company_created (company_id, created_at)
);

CREATE TABLE IF NOT EXISTS payment_voids (
  id VARCHAR(64) PRIMARY KEY,
  payment_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  actor_user_id VARCHAR(64) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_void_payment (payment_id)
);

CREATE TABLE IF NOT EXISTS collection_routes (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  collector_id VARCHAR(64) NOT NULL,
  date DATE NOT NULL,
  status ENUM('Abierta','En Curso','Cerrada') NOT NULL DEFAULT 'Abierta',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_routes_company_branch_date (company_id, branch_id, date)
);

CREATE TABLE IF NOT EXISTS route_items (
  id VARCHAR(64) PRIMARY KEY,
  route_id VARCHAR(64) NOT NULL,
  loan_id VARCHAR(64) NOT NULL,
  installment_id VARCHAR(64) NULL,
  client_id VARCHAR(64) NOT NULL,
  client_name VARCHAR(240) NOT NULL,
  address TEXT NOT NULL,
  amount_to_collect DECIMAL(12,2) NOT NULL,
  sort_order INT NOT NULL,
  visit_status ENUM('PENDING','VISITED','PAID','PROMISED','FAILED') NOT NULL DEFAULT 'PENDING',
  visit_result VARCHAR(40) NULL,
  notes TEXT NULL
);

CREATE TABLE IF NOT EXISTS visit_logs (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  result VARCHAR(80) NOT NULL,
  note TEXT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_promises (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  loan_id VARCHAR(64) NOT NULL,
  date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('PENDIENTE','CUMPLIDA','INCUMPLIDA') NOT NULL DEFAULT 'PENDIENTE',
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cash_movements (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  type ENUM('IN','OUT') NOT NULL,
  category VARCHAR(40) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cash_company_branch_created (company_id, branch_id, created_at)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NULL,
  actor_user_id VARCHAR(64) NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(64) NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_company_created (company_id, created_at)
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  client_action_id VARCHAR(120) NOT NULL,
  action_type VARCHAR(80) NOT NULL,
  payload_json JSON NOT NULL,
  status ENUM('PENDING','APPLIED','REJECTED') NOT NULL DEFAULT 'PENDING',
  error_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_sync_client_action (company_id, client_action_id),
  INDEX idx_sync_user_status (user_id, status)
);

INSERT IGNORE INTO plans (id, name, monthly_price, yearly_price, max_users, max_branches, max_clients, features_json)
VALUES
  ('p1', 'Basico', 1500, 15000, 3, 1, 50, JSON_ARRAY('MODULE_CASH','MODULE_REPORTS','MODULE_ROUTES','MODULE_WHATSAPP','MODULE_AUDIT')),
  ('p2', 'Profesional', 3500, 35000, 15, 3, 500, JSON_ARRAY('MODULE_CASH','MODULE_REPORTS','MODULE_ROUTES','MODULE_WHATSAPP','MODULE_AUDIT')),
  ('p3', 'Enterprise', 8000, 80000, 100, 20, 5000, JSON_ARRAY('MODULE_CASH','MODULE_REPORTS','MODULE_ROUTES','MODULE_WHATSAPP','MODULE_AUDIT'));

INSERT IGNORE INTO companies (id, name, status, plan_id, billing_cycle, expires_at, billing_day, subscription_price, config_json)
VALUES
  ('SYSTEM', 'Nexus Core Admin', 'ACTIVE', 'p3', 'YEARLY', '2099-12-31', 1, 0, JSON_OBJECT()),
  ('C1', 'PrestaFacil RD', 'ACTIVE', 'p2', 'MONTHLY', '2026-12-31', 5, 3500, JSON_OBJECT());

INSERT IGNORE INTO branches (id, company_id, name, address, manager_name, monthly_goal)
VALUES
  ('SYS_MAIN', 'SYSTEM', 'Nexus Core', 'Sistema', 'Nexus Core', 0),
  ('MAIN', 'C1', 'Sede Principal', 'Santo Domingo, RD', 'Admin Nexus', 500000);

INSERT IGNORE INTO users (id, company_id, branch_id, name, username, email, password_hash, role, avatar, is_active)
VALUES
  ('M1', 'SYSTEM', 'SYS_MAIN', 'Nexus Master', 'master', 'master@prestafacil.local', '$2b$10$e8cty.qhfeyO/yrbIyCiEec0Ei8f.RP0YyU.90jwcN6QJJBVobPda', 'Super Admin', 'NM', TRUE),
  ('U1', 'C1', 'MAIN', 'Admin PrestaFacil', 'admin', 'admin@prestafacil.local', '$2b$10$SVtAwRe0AXSApJUI0fkCru7Y4o26.XYz0qGd6sF5VoiO5mBAONYDe', 'Administrador', 'AP', TRUE);
