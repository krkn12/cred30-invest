-- Garante que vesting_period_ms suporte valores maiores que integer (2.1 bilhões)
-- 30 dias em milissegundos é ~2.59 bilhões
ALTER TABLE system_config ALTER COLUMN vesting_period_ms TYPE BIGINT;
