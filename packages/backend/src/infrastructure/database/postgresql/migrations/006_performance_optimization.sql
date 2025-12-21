-- Migração para Otimização de Performance
-- Adiciona índices estratégicos e corrige tipos de dados para maior eficiência

-- 1. Índices para Fila de Pagamentos (Admin e Automação)
CREATE INDEX IF NOT EXISTS idx_transactions_payout_pending ON transactions(payout_status) WHERE payout_status = 'PENDING_PAYMENT';
CREATE INDEX IF NOT EXISTS idx_loans_payout_pending ON loans(payout_status) WHERE payout_status = 'PENDING_PAYMENT';

-- 2. Índices para Distribuição de Lucros (Elegibilidade)
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_idx ON transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_loans_user_status_active ON loans(user_id, status) WHERE status IN ('APPROVED', 'PAYMENT_PENDING');

-- 3. Índice para Ranking de Prioridade (Desembolso Automático)
CREATE INDEX IF NOT EXISTS idx_users_score_desc ON users(score DESC);

-- 4. Otimização de tipos para grandes volumes
-- Garantir que system_config suporte trilhões (apenas por segurança se crescer muito)
ALTER TABLE system_config ALTER COLUMN system_balance TYPE DECIMAL(20,2);
ALTER TABLE system_config ALTER COLUMN profit_pool TYPE DECIMAL(20,2);
ALTER TABLE system_config ALTER COLUMN total_tax_reserve TYPE DECIMAL(20,2);
ALTER TABLE system_config ALTER COLUMN total_operational_reserve TYPE DECIMAL(20,2);
ALTER TABLE system_config ALTER COLUMN total_owner_profit TYPE DECIMAL(20,2);
ALTER TABLE system_config ALTER COLUMN total_gateway_costs TYPE DECIMAL(20,2);

-- 5. Estatística para o Planner
ANALYZE users;
ANALYZE transactions;
ANALYZE loans;
ANALYZE quotas;
