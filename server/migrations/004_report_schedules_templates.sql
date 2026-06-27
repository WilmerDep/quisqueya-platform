CREATE TABLE IF NOT EXISTS report_schedules (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NULL,
  user_id VARCHAR(64) NOT NULL,
  name VARCHAR(180) NOT NULL,
  report_type VARCHAR(40) NOT NULL,
  format VARCHAR(16) NOT NULL,
  frequency VARCHAR(24) NOT NULL,
  delivery_hour VARCHAR(16) NOT NULL,
  target_label VARCHAR(180) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_report_schedules_company_created (company_id, created_at),
  KEY idx_report_schedules_branch (branch_id),
  KEY idx_report_schedules_user (user_id)
);

CREATE TABLE IF NOT EXISTS report_templates (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  name VARCHAR(180) NOT NULL,
  report_type VARCHAR(40) NOT NULL,
  status VARCHAR(24) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  sections_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_report_templates_company_created (company_id, created_at),
  KEY idx_report_templates_user (user_id)
);
