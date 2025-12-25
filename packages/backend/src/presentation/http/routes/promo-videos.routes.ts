import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { createPixPayment, createCardPayment } from '../../../infrastructure/gateways/asaas.service';
import {
    ASAAS_PIX_FIXED_FEE,
    ASAAS_CARD_FEE_PERCENT,
    ASAAS_CARD_FIXED_FEE
} from '../../../shared/constants/business.constants';

// Constantes de divisão (3 partes)
// Total: 100% do valor pago pelo influenciador
const VIEWER_SHARE = 0.60;       // 60% para quem assiste
const QUOTA_HOLDERS_SHARE = 0.25; // 25% para quem tem cotas (profit_pool)
const SERVICE_FEE_SHARE = 0.15;  // 15% taxa de serviço (system_balance)

// Funções para calcular valor com taxa (cliente paga a taxa do gateway)
const calculatePixTotal = (budget: number) => budget + ASAAS_PIX_FIXED_FEE;
const calculateCardTotal = (budget: number) => {
    // Fórmula: valorFinal = (budget + taxaFixa) / (1 - taxaPercentual)
    return (budget + ASAAS_CARD_FIXED_FEE) / (1 - ASAAS_CARD_FEE_PERCENT);
};

const promoVideosRoutes = new Hono();

// Middleware de autenticação
promoVideosRoutes.use('/*', authMiddleware);

// Schema de validação para criar vídeo promocional
const createVideoSchema = z.object({
    title: z.string().min(5).max(200),
    description: z.string().max(1000).optional(),
    videoUrl: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    platform: z.enum(['YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'KWAI', 'OTHER']).default('YOUTUBE'),
    durationSeconds: z.number().min(10).max(3600).default(60),
    pricePerView: z.number().min(0.01).max(10).default(0.05), // R$ 0,01 a R$ 10,00
    minWatchSeconds: z.number().min(5).max(300).default(30), // 5s a 5min
    budget: z.number().min(5), // Mínimo R$ 5,00 de orçamento
    targetViews: z.number().min(10).default(1000),
    dailyLimit: z.number().min(1).max(10000).default(100),
    paymentMethod: z.enum(['BALANCE', 'PIX', 'CARD']).default('BALANCE'),
    cardData: z.object({
        holderName: z.string(),
        number: z.string(),
        expiryMonth: z.string(),
        expiryYear: z.string(),
        ccv: z.string(),
        cpf: z.string(),
    }).optional(),
});

// Listar vídeos disponíveis para assistir (Feed)
promoVideosRoutes.get('/feed', async (c) => {
    try {
        const userPayload = c.get('user');
        const pool = getDbPool(c);

        // Buscar vídeos ativos que o usuário ainda não assistiu
        const result = await pool.query(`
            SELECT pv.*, u.name as promoter_name,
                   (SELECT COUNT(*) FROM promo_video_views pvv WHERE pvv.video_id = pv.id AND pvv.completed = TRUE) as completed_views
            FROM promo_videos pv
            JOIN users u ON pv.user_id = u.id
            WHERE pv.is_active = TRUE 
              AND pv.status = 'ACTIVE'
              AND pv.budget > pv.spent
              AND pv.user_id != $1  -- Não mostra próprios vídeos
              AND NOT EXISTS (
                  SELECT 1 FROM promo_video_views pvv 
                  WHERE pvv.video_id = pv.id AND pvv.viewer_id = $1
              )
              AND (pv.max_views IS NULL OR pv.total_views < pv.max_views)
              AND (pv.expires_at IS NULL OR pv.expires_at > NOW())
            ORDER BY pv.price_per_view DESC, pv.created_at DESC
            LIMIT 20
        `, [userPayload.id]);

        return c.json({
            success: true,
            data: result.rows.map(v => ({
                id: v.id,
                title: v.title,
                description: v.description,
                videoUrl: v.video_url,
                thumbnailUrl: v.thumbnail_url,
                platform: v.platform,
                durationSeconds: v.duration_seconds,
                pricePerView: parseFloat(v.price_per_view),
                minWatchSeconds: v.min_watch_seconds,
                promoterName: v.promoter_name,
                totalViews: v.total_views,
                targetViews: v.target_views,
                viewerEarning: parseFloat(v.price_per_view) * VIEWER_SHARE, // O que o viewer ganha (60%)
            }))
        });
    } catch (error) {
        console.error('Erro ao buscar feed de vídeos:', error);
        return c.json({ success: false, message: 'Erro ao buscar vídeos' }, 500);
    }
});

// Criar campanha de vídeo promocional
promoVideosRoutes.post('/create', async (c) => {
    try {
        const userPayload = c.get('user');
        const body = await c.req.json();
        const data = createVideoSchema.parse(body);
        const pool = getDbPool(c);

        // Buscar dados do usuário
        const userResult = await pool.query(
            'SELECT id, name, email, cpf, balance FROM users WHERE id = $1',
            [userPayload.id]
        );

        if (userResult.rows.length === 0) {
            return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
        }

        const user = userResult.rows[0];
        const userBalance = parseFloat(user.balance);

        // Processar pagamento baseado no método
        if (data.paymentMethod === 'BALANCE') {
            // Pagamento com saldo
            if (userBalance < data.budget) {
                return c.json({
                    success: false,
                    message: `Saldo insuficiente. Você tem R$ ${userBalance.toFixed(2)} mas precisa de R$ ${data.budget.toFixed(2)}`
                }, 400);
            }

            // Debitar saldo do usuário
            await pool.query(
                'UPDATE users SET balance = balance - $1 WHERE id = $2',
                [data.budget, userPayload.id]
            );

            // Criar o vídeo promocional
            const result = await pool.query(`
                INSERT INTO promo_videos (
                    user_id, title, description, video_url, thumbnail_url, platform,
                    duration_seconds, price_per_view, min_watch_seconds, budget,
                    target_views, daily_limit, status, is_active, is_approved
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACTIVE', TRUE, TRUE)
                RETURNING *
            `, [
                userPayload.id, data.title, data.description || null, data.videoUrl,
                data.thumbnailUrl || null, data.platform, data.durationSeconds,
                data.pricePerView, data.minWatchSeconds, data.budget,
                data.targetViews, data.dailyLimit
            ]);

            // Registrar transação
            await pool.query(`
                INSERT INTO transactions (user_id, type, amount, description, status)
                VALUES ($1, 'PROMO_VIDEO_BUDGET', $2, $3, 'COMPLETED')
            `, [userPayload.id, -data.budget, `Orçamento para promoção: ${data.title}`]);

            const estimatedViews = Math.floor(data.budget / data.pricePerView);

            return c.json({
                success: true,
                message: 'Campanha de vídeo criada com sucesso!',
                data: {
                    id: result.rows[0].id,
                    title: data.title,
                    budget: data.budget,
                    pricePerView: data.pricePerView,
                    estimatedViews,
                    minWatchSeconds: data.minWatchSeconds,
                }
            }, 201);

        } else if (data.paymentMethod === 'PIX') {
            // Pagamento com PIX - Criar cobrança e aguardar
            // Cliente paga a taxa do Asaas (R$ 0,99)
            const pixTotal = calculatePixTotal(data.budget);

            const paymentData = await createPixPayment({
                amount: pixTotal, // Valor com taxa
                description: `Campanha Cred Views: ${data.title} (Orçamento: R$ ${data.budget.toFixed(2)} + Taxa PIX)`,
                external_reference: `PROMO_VIDEO_${userPayload.id}_${Date.now()}`,
                email: user.email,
                name: user.name,
                cpf: user.cpf,
            });

            // Criar vídeo com status PENDING (aguardando pagamento)
            const result = await pool.query(`
                INSERT INTO promo_videos (
                    user_id, title, description, video_url, thumbnail_url, platform,
                    duration_seconds, price_per_view, min_watch_seconds, budget,
                    target_views, daily_limit, status, is_active, is_approved
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING', FALSE, FALSE)
                RETURNING *
            `, [
                userPayload.id, data.title, data.description || null, data.videoUrl,
                data.thumbnailUrl || null, data.platform, data.durationSeconds,
                data.pricePerView, data.minWatchSeconds, data.budget,
                data.targetViews, data.dailyLimit
            ]);

            // Registrar transação como pendente
            await pool.query(`
                INSERT INTO transactions (user_id, type, amount, description, status, external_payment_id)
                VALUES ($1, 'PROMO_VIDEO_BUDGET', $2, $3, 'PENDING', $4)
            `, [userPayload.id, -data.budget, `Orçamento para promoção: ${data.title}`, paymentData.id]);

            return c.json({
                success: true,
                message: 'Cobrança PIX gerada! Pague para ativar a campanha.',
                data: {
                    id: result.rows[0].id,
                    paymentId: paymentData.id,
                    pixCopiaECola: paymentData.pixCopiaECola,
                    pixQrCodeBase64: paymentData.qr_code_base64,
                    expiresAt: paymentData.expirationDate,
                }
            });

        } else if (data.paymentMethod === 'CARD') {
            // Pagamento com cartão
            if (!data.cardData) {
                return c.json({ success: false, message: 'Dados do cartão são obrigatórios' }, 400);
            }

            // Cliente paga a taxa do Asaas (2.99% + R$ 0,49)
            const cardTotal = calculateCardTotal(data.budget);

            const paymentData = await createCardPayment({
                amount: cardTotal, // Valor com taxa
                description: `Campanha Cred Views: ${data.title} (Orçamento: R$ ${data.budget.toFixed(2)} + Taxa Cartão)`,
                external_reference: `PROMO_VIDEO_${userPayload.id}_${Date.now()}`,
                email: user.email,
                name: user.name,
                cpf: user.cpf,
                creditCard: {
                    holderName: data.cardData.holderName,
                    number: data.cardData.number,
                    expiryMonth: data.cardData.expiryMonth,
                    expiryYear: data.cardData.expiryYear,
                    ccv: data.cardData.ccv,
                },
                creditCardHolderInfo: {
                    name: data.cardData.holderName,
                    email: user.email,
                    cpfCnpj: data.cardData.cpf,
                    postalCode: '00000000',
                    addressNumber: '0',
                    phone: '00000000000',
                },
            });

            if (paymentData.status === 'CONFIRMED' || paymentData.status === 'RECEIVED') {
                // Pagamento aprovado, criar campanha ativa
                const result = await pool.query(`
                    INSERT INTO promo_videos (
                        user_id, title, description, video_url, thumbnail_url, platform,
                        duration_seconds, price_per_view, min_watch_seconds, budget,
                        target_views, daily_limit, status, is_active, is_approved
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACTIVE', TRUE, TRUE)
                    RETURNING *
                `, [
                    userPayload.id, data.title, data.description || null, data.videoUrl,
                    data.thumbnailUrl || null, data.platform, data.durationSeconds,
                    data.pricePerView, data.minWatchSeconds, data.budget,
                    data.targetViews, data.dailyLimit
                ]);

                await pool.query(`
                    INSERT INTO transactions (user_id, type, amount, description, status, external_payment_id)
                    VALUES ($1, 'PROMO_VIDEO_BUDGET', $2, $3, 'COMPLETED', $4)
                `, [userPayload.id, -data.budget, `Orçamento para promoção: ${data.title}`, paymentData.id]);

                return c.json({
                    success: true,
                    message: 'Pagamento aprovado! Campanha ativada.',
                    data: { id: result.rows[0].id }
                });
            } else {
                return c.json({
                    success: false,
                    message: 'Pagamento não aprovado. Verifique os dados do cartão.'
                }, 400);
            }
        }

        return c.json({ success: false, message: 'Método de pagamento inválido' }, 400);

    } catch (error) {
        console.error('Erro ao criar campanha de vídeo:', error);
        if (error instanceof z.ZodError) {
            return c.json({ success: false, message: error.errors[0].message }, 400);
        }
        return c.json({ success: false, message: 'Erro ao criar campanha' }, 500);
    }
});

// Registrar início de view
promoVideosRoutes.post('/:videoId/start-view', async (c) => {
    try {
        const userPayload = c.get('user');
        const videoId = c.req.param('videoId');
        const pool = getDbPool(c);

        // Verificar se o vídeo existe e está ativo
        const videoResult = await pool.query(
            'SELECT * FROM promo_videos WHERE id = $1 AND is_active = TRUE AND status = $2',
            [videoId, 'ACTIVE']
        );

        if (videoResult.rows.length === 0) {
            return c.json({ success: false, message: 'Vídeo não disponível' }, 404);
        }

        const video = videoResult.rows[0];

        // Verificar se não é o próprio dono (converter para número para comparação)
        if (Number(video.user_id) === Number(userPayload.id)) {
            return c.json({ success: false, message: 'Você não pode assistir seu próprio vídeo promocional' }, 400);
        }

        // Verificar se já assistiu
        const existingView = await pool.query(
            'SELECT id FROM promo_video_views WHERE video_id = $1 AND viewer_id = $2',
            [videoId, userPayload.id]
        );

        if (existingView.rows.length > 0) {
            return c.json({ success: false, message: 'Você já assistiu este vídeo' }, 400);
        }

        // Verificar orçamento
        if (parseFloat(video.budget) <= parseFloat(video.spent)) {
            return c.json({ success: false, message: 'Orçamento da campanha esgotado' }, 400);
        }

        // Coletar informações anti-fraude
        const ipAddress = c.req.header('x-forwarded-for') || '127.0.0.1';
        const userAgent = c.req.header('user-agent') || 'Unknown';

        // Registrar início da view
        const viewResult = await pool.query(`
            INSERT INTO promo_video_views (video_id, viewer_id, ip_address, user_agent)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [videoId, userPayload.id, ipAddress, userAgent]);

        return c.json({
            success: true,
            message: 'View iniciada',
            data: {
                viewId: viewResult.rows[0].id,
                minWatchSeconds: video.min_watch_seconds,
                pricePerView: parseFloat(video.price_per_view),
                viewerEarning: parseFloat(video.price_per_view) * VIEWER_SHARE,
            }
        });

    } catch (error) {
        console.error('Erro ao iniciar view:', error);
        return c.json({ success: false, message: 'Erro ao registrar view' }, 500);
    }
});

// Completar view e receber pagamento
promoVideosRoutes.post('/:videoId/complete-view', async (c) => {
    try {
        const userPayload = c.get('user');
        const videoId = c.req.param('videoId');
        const body = await c.req.json();
        const watchTimeSeconds = body.watchTimeSeconds || 0;
        const pool = getDbPool(c);

        // Buscar a view existente
        const viewResult = await pool.query(`
            SELECT pvv.*, pv.price_per_view, pv.min_watch_seconds, pv.user_id as promoter_id,
                   pv.budget, pv.spent
            FROM promo_video_views pvv
            JOIN promo_videos pv ON pvv.video_id = pv.id
            WHERE pvv.video_id = $1 AND pvv.viewer_id = $2 AND pvv.completed = FALSE
        `, [videoId, userPayload.id]);

        if (viewResult.rows.length === 0) {
            return c.json({ success: false, message: 'View não encontrada ou já completada' }, 404);
        }

        const view = viewResult.rows[0];
        const minWatch = view.min_watch_seconds;
        const pricePerView = parseFloat(view.price_per_view);
        const budget = parseFloat(view.budget);
        const spent = parseFloat(view.spent);

        // Verificar se assistiu tempo mínimo
        if (watchTimeSeconds < minWatch) {
            return c.json({
                success: false,
                message: `Você precisa assistir no mínimo ${minWatch} segundos. Você assistiu ${watchTimeSeconds} segundos.`
            }, 400);
        }

        // Verificar orçamento
        if (budget <= spent + pricePerView) {
            // Marcar campanha como completada
            await pool.query(
                'UPDATE promo_videos SET status = $1, is_active = FALSE, completed_at = NOW() WHERE id = $2',
                ['COMPLETED', videoId]
            );
            return c.json({ success: false, message: 'Orçamento da campanha esgotado' }, 400);
        }

        // Calcular pagamentos (divisão em 3 partes)
        const viewerEarning = pricePerView * VIEWER_SHARE;           // 60% para quem assiste
        const quotaHoldersShare = pricePerView * QUOTA_HOLDERS_SHARE; // 25% para quem tem cotas
        const serviceFee = pricePerView * SERVICE_FEE_SHARE;         // 15% taxa de serviço

        // Atualizar view como completada
        await pool.query(`
            UPDATE promo_video_views 
            SET completed = TRUE, watch_time_seconds = $1, earned = $2, 
                finished_at = NOW(), paid_at = NOW()
            WHERE video_id = $3 AND viewer_id = $4
        `, [watchTimeSeconds, viewerEarning, videoId, userPayload.id]);

        // Atualizar métricas do vídeo
        await pool.query(`
            UPDATE promo_videos 
            SET total_views = total_views + 1, 
                unique_viewers = unique_viewers + 1,
                total_watch_time = total_watch_time + $1,
                spent = spent + $2
            WHERE id = $3
        `, [watchTimeSeconds, pricePerView, videoId]);

        // 1. Creditar saldo do viewer (60%)
        await pool.query(
            'UPDATE users SET balance = balance + $1 WHERE id = $2',
            [viewerEarning, userPayload.id]
        );

        // 2. Creditar profit_pool para quem tem cotas (25%) + system_balance para serviço (15%)
        // profit_pool = dividendos para quota holders
        // system_balance = fundo operacional / empréstimos
        await pool.query(
            'UPDATE system_config SET profit_pool = profit_pool + $1, system_balance = system_balance + $2',
            [quotaHoldersShare, serviceFee]
        );

        // Registrar transação do viewer
        await pool.query(`
            INSERT INTO transactions (user_id, type, amount, description, status)
            VALUES ($1, 'VIDEO_VIEW_EARNING', $2, 'Ganho por assistir vídeo promocional', 'COMPLETED')
        `, [userPayload.id, viewerEarning]);

        // Verificar se campanha atingiu limite
        const updatedVideo = await pool.query(
            'SELECT budget, spent, max_views, total_views FROM promo_videos WHERE id = $1',
            [videoId]
        );

        if (updatedVideo.rows.length > 0) {
            const v = updatedVideo.rows[0];
            if (parseFloat(v.budget) <= parseFloat(v.spent) ||
                (v.max_views && v.total_views >= v.max_views)) {
                await pool.query(
                    'UPDATE promo_videos SET status = $1, is_active = FALSE, completed_at = NOW() WHERE id = $2',
                    ['COMPLETED', videoId]
                );
            }
        }

        return c.json({
            success: true,
            message: `Você ganhou R$ ${viewerEarning.toFixed(2)} por assistir este vídeo!`,
            data: {
                earned: viewerEarning,
                watchTimeSeconds,
            }
        });

    } catch (error) {
        console.error('Erro ao completar view:', error);
        return c.json({ success: false, message: 'Erro ao processar pagamento' }, 500);
    }
});

// Listar minhas campanhas
promoVideosRoutes.get('/my-campaigns', async (c) => {
    try {
        const userPayload = c.get('user');
        const pool = getDbPool(c);

        const result = await pool.query(`
            SELECT * FROM promo_videos 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `, [userPayload.id]);

        return c.json({
            success: true,
            data: result.rows.map(v => ({
                id: v.id,
                title: v.title,
                videoUrl: v.video_url,
                platform: v.platform,
                pricePerView: parseFloat(v.price_per_view),
                budget: parseFloat(v.budget),
                spent: parseFloat(v.spent),
                remaining: parseFloat(v.budget) - parseFloat(v.spent),
                totalViews: v.total_views,
                targetViews: v.target_views,
                status: v.status,
                isActive: v.is_active,
                createdAt: v.created_at,
            }))
        });

    } catch (error) {
        console.error('Erro ao listar campanhas:', error);
        return c.json({ success: false, message: 'Erro ao listar campanhas' }, 500);
    }
});

// Pausar/Retomar campanha
promoVideosRoutes.post('/:videoId/toggle', async (c) => {
    try {
        const userPayload = c.get('user');
        const videoId = c.req.param('videoId');
        const pool = getDbPool(c);

        const result = await pool.query(
            'SELECT * FROM promo_videos WHERE id = $1 AND user_id = $2',
            [videoId, userPayload.id]
        );

        if (result.rows.length === 0) {
            return c.json({ success: false, message: 'Campanha não encontrada' }, 404);
        }

        const video = result.rows[0];
        const newStatus = video.is_active ? 'PAUSED' : 'ACTIVE';
        const newActive = !video.is_active;

        await pool.query(
            'UPDATE promo_videos SET is_active = $1, status = $2 WHERE id = $3',
            [newActive, newStatus, videoId]
        );

        return c.json({
            success: true,
            message: newActive ? 'Campanha retomada!' : 'Campanha pausada!',
            data: { isActive: newActive, status: newStatus }
        });

    } catch (error) {
        console.error('Erro ao alternar campanha:', error);
        return c.json({ success: false, message: 'Erro ao alternar campanha' }, 500);
    }
});

// Histórico de ganhos com vídeos
promoVideosRoutes.get('/my-earnings', async (c) => {
    try {
        const userPayload = c.get('user');
        const pool = getDbPool(c);

        const result = await pool.query(`
            SELECT pvv.*, pv.title, pv.video_url, pv.platform
            FROM promo_video_views pvv
            JOIN promo_videos pv ON pvv.video_id = pv.id
            WHERE pvv.viewer_id = $1 AND pvv.completed = TRUE
            ORDER BY pvv.finished_at DESC
            LIMIT 50
        `, [userPayload.id]);

        const totalEarned = result.rows.reduce((sum, v) => sum + parseFloat(v.earned || 0), 0);

        return c.json({
            success: true,
            data: {
                totalEarned,
                videosWatched: result.rows.length,
                history: result.rows.map(v => ({
                    title: v.title,
                    platform: v.platform,
                    earned: parseFloat(v.earned),
                    watchTime: v.watch_time_seconds,
                    finishedAt: v.finished_at,
                }))
            }
        });

    } catch (error) {
        console.error('Erro ao buscar ganhos:', error);
        return c.json({ success: false, message: 'Erro ao buscar ganhos' }, 500);
    }
});

export { promoVideosRoutes };
