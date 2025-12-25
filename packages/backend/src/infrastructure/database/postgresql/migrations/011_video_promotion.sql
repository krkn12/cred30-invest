-- Migration: 011_video_promotion.sql
-- Sistema de Promoção de Vídeos Pagos (View-to-Earn)
-- CORRIGIDO: users.id é INTEGER, não UUID

-- Tabela de vídeos promocionais
CREATE TABLE IF NOT EXISTS promo_videos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Quem está promovendo
    
    -- Dados do vídeo
    title VARCHAR(200) NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL, -- URL do YouTube/TikTok/etc
    thumbnail_url TEXT, -- Miniatura
    platform VARCHAR(50) DEFAULT 'YOUTUBE', -- YOUTUBE, TIKTOK, INSTAGRAM, OTHER
    duration_seconds INTEGER DEFAULT 60, -- Duração estimada do vídeo
    
    -- Configuração de pagamento
    price_per_view DECIMAL(10,2) NOT NULL DEFAULT 0.05, -- Quanto paga por view (R$ 0,05 padrão)
    min_watch_seconds INTEGER NOT NULL DEFAULT 30, -- Tempo mínimo para contar view (30s padrão)
    budget DECIMAL(10,2) NOT NULL DEFAULT 0, -- Orçamento total depositado
    spent DECIMAL(10,2) NOT NULL DEFAULT 0, -- Quanto já gastou
    
    -- Limites
    max_views INTEGER, -- Limite de views (NULL = ilimitado até acabar budget)
    target_views INTEGER DEFAULT 1000, -- Meta de views
    daily_limit INTEGER DEFAULT 100, -- Limite de views por dia
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, ACTIVE, PAUSED, COMPLETED, CANCELLED
    is_active BOOLEAN DEFAULT FALSE,
    
    -- Métricas
    total_views INTEGER DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    total_watch_time INTEGER DEFAULT 0, -- Em segundos
    
    -- Datas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE, -- Data de expiração da campanha
    
    -- Verificação
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by INTEGER REFERENCES users(id),
    rejection_reason TEXT
);

-- Tabela de views registradas
CREATE TABLE IF NOT EXISTS promo_video_views (
    id SERIAL PRIMARY KEY,
    video_id INTEGER NOT NULL REFERENCES promo_videos(id) ON DELETE CASCADE,
    viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Métricas da view
    watch_time_seconds INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE, -- Se assistiu o tempo mínimo
    
    -- Pagamento
    earned DECIMAL(10,2) DEFAULT 0, -- Quanto o viewer ganhou
    paid_at TIMESTAMP WITH TIME ZONE, -- Quando foi creditado
    
    -- Anti-fraude
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_fingerprint VARCHAR(100),
    
    -- Datas
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraint: mesmo usuário não pode ver o mesmo vídeo mais de uma vez
    UNIQUE(video_id, viewer_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_promo_videos_user ON promo_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_videos_status ON promo_videos(status, is_active);
CREATE INDEX IF NOT EXISTS idx_promo_video_views_video ON promo_video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_promo_video_views_viewer ON promo_video_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_promo_video_views_date ON promo_video_views(started_at DESC);

-- Comentários
COMMENT ON TABLE promo_videos IS 'Vídeos promocionais pagos por views';
COMMENT ON TABLE promo_video_views IS 'Registro de views dos vídeos promocionais';
COMMENT ON COLUMN promo_videos.price_per_view IS 'Valor pago por cada view válida';
COMMENT ON COLUMN promo_videos.min_watch_seconds IS 'Tempo mínimo de visualização para contar como view válida';
COMMENT ON COLUMN promo_video_views.completed IS 'Se o usuário assistiu o tempo mínimo exigido';
