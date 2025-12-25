-- Migration: 010_terms_acceptance.sql
-- Tabela para registrar aceite de termos dos usuários (blindagem jurídica)

CREATE TABLE IF NOT EXISTS terms_acceptance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    terms_version VARCHAR(20) NOT NULL DEFAULT '2.0',
    privacy_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    ip_address VARCHAR(45), -- IPv4 ou IPv6
    user_agent TEXT,
    accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Declarações explícitas
    accepted_age_requirement BOOLEAN NOT NULL DEFAULT true, -- Declara ter 18+
    accepted_risk_disclosure BOOLEAN NOT NULL DEFAULT true, -- Ciência de risco de perda
    accepted_terms BOOLEAN NOT NULL DEFAULT true,
    accepted_privacy BOOLEAN NOT NULL DEFAULT true,
    
    UNIQUE(user_id, terms_version, privacy_version)
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_user_id ON terms_acceptance(user_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_date ON terms_acceptance(accepted_at DESC);

-- Comentários
COMMENT ON TABLE terms_acceptance IS 'Registro de aceite de termos para blindagem jurídica';
COMMENT ON COLUMN terms_acceptance.terms_version IS 'Versão dos Termos de Uso aceitos';
COMMENT ON COLUMN terms_acceptance.privacy_version IS 'Versão da Política de Privacidade aceita';
COMMENT ON COLUMN terms_acceptance.accepted_age_requirement IS 'Usuário declarou ter 18 anos ou mais';
COMMENT ON COLUMN terms_acceptance.accepted_risk_disclosure IS 'Usuário declarou ciência dos riscos de perda financeira';
