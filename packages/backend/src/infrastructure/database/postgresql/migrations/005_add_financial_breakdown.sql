-- Migration to add financial breakdown columns to system_config
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS total_tax_reserve DECIMAL(15,2) DEFAULT 0;
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS total_operational_reserve DECIMAL(15,2) DEFAULT 0;
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS total_owner_profit DECIMAL(15,2) DEFAULT 0;
