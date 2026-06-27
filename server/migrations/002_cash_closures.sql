CREATE TABLE IF NOT EXISTS cash_closures (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  business_date DATE NOT NULL,
  theoretical_amount DECIMAL(12,2) NOT NULL,
  counted_amount DECIMAL(12,2) NOT NULL,
  difference_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(40) NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_cash_closure_company_branch_date (company_id, branch_id, business_date),
  INDEX idx_cash_closure_company_branch_created (company_id, branch_id, created_at),
  INDEX idx_cash_closure_user (user_id)
);
