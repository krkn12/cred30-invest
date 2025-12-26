import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, securityLockMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { createPixPayment, createCardPayment } from '../../../infrastructure/gateways/asaas.service';
import { executeInTransaction } from '../../../domain/services/transaction.service';
import {
    ASAAS_PIX_FIXED_FEE,
    ASAAS_CARD_FEE_PERCENT,
    ASAAS_CARD_FIXED_FEE
} from '../../../shared/constants/business.constants';

// Constantes de divisão (3 partes)
const VIEWER_SHARE = 0.60;       // 60% para quem assiste
const QUOTA_HOLDERS_SHARE = 0.25; // 25% para quem tem cotas (profit_pool)
const SERVICE_FEE_SHARE = 0.15;  // 15% taxa de serviço (system_balance)

// Funções para calcular valor com taxa (cliente paga a taxa do gateway)
const calculatePixTotal = (budget: number) => budget + ASAAS_PIX_FIXED_FEE;
const calculateCardTotal = (budget: number) => {
    return (budget + ASAAS_CARD_FIXED_FEE) / (1 - ASAAS_CARD_FEE_PERCENT);
};

const promoVideosRoutes = new Hono();

promoVideosRoutes.use('/create', securityLockMiddleware);
promoVideosRoutes.use('/*', authMiddleware);

// Tags disponíveis para categorização
const VIDEO_TAGS = ['ENTRETENIMENTO', 'MUSICA', 'EDUCACAO', 'GAMES', 'LIFESTYLE', 'TECNOLOGIA', 'NEGOCIOS', 'SAUDE', 'HUMOR', 'OUTROS'] as const;

// Schema de validação
const createVideoSchema = z.object({
    title: z.string().min(5).max(200),
    description: z.string().max(1000).optional(),
    videoUrl: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    platform: z.enum(['YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'KWAI', 'OTHER']).default('YOUTUBE'),
    tag: z.enum(VIDEO_TAGS).default('OUTROS'),
    durationSeconds: z.number().min(60).max(3600).default(60), // Mínimo 1 minuto
    minWatchSeconds: z.number().min(20).max(300).default(20), // Mínimo 20 segundos para ganhar
    budget: z.number().min(5, 'O orçamento mínimo é R$ 5,00'),
    pricePerView: z.number().min(0.05).default(0.05),
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

// Listar tags disponíveis
promoVideosRoutes.get('/tags', async (c) => {
    return c.json({ success: true, data: VIDEO_TAGS });
});

// Listar vídeos disponíveis para assistir (Feed)
promoVideosRoutes.get('/feed', async (c) => {
    try {
        const userPayload = c.get('user');
        const pool = getDbPool(c);
        const tag = c.req.query('tag'); // Filtro opcional por tag

        const result = await pool.query(`
            SELECT pv.*, u.name as promoter_name,
                   COALESCE(stats.completed_count, 0) as completed_views,
                   (pv.user_id = $1) as is_owner,
                   ROW_NUMBER() OVER (ORDER BY pv.total_views DESC, pv.price_per_view DESC) as ranking
            FROM promo_videos pv
            JOIN users u ON pv.user_id = u.id
            LEFT JOIN (
                SELECT video_id, COUNT(*) as completed_count 
                FROM promo_video_views 
                WHERE completed = TRUE 
                GROUP BY video_id
            ) stats ON stats.video_id = pv.id
            WHERE pv.is_active = TRUE 
              AND pv.status = 'ACTIVE'
              AND pv.budget > pv.spent
              AND NOT EXISTS (
                  SELECT 1 FROM promo_video_views pvv 
                  WHERE pvv.video_id = pv.id AND pvv.viewer_id = $1
              )
              ${tag ? 'AND pv.tag = $2' : ''}
            ORDER BY pv.price_per_view DESC, pv.total_views DESC, pv.created_at DESC
            LIMIT 50
        `, tag ? [userPayload.id, tag] : [userPayload.id]);

        return c.json({
            success: true,
            data: result.rows.map((v, index) => ({
                id: v.id,
                title: v.title,
                description: v.description,
                videoUrl: v.video_url,
                thumbnailUrl: v.thumbnail_url,
                platform: v.platform,
                tag: v.tag || 'OUTROS',
                durationSeconds: v.duration_seconds,
                pricePerView: parseFloat(v.price_per_view),
                minWatchSeconds: v.min_watch_seconds || 20,
                promoterName: v.promoter_name,
                totalViews: parseInt(v.total_views) || 0,
                completedViews: parseInt(v.completed_views) || 0,
                targetViews: v.target_views,
                viewerEarning: v.is_owner ? 0 : parseFloat(v.price_per_view) * VIEWER_SHARE,
                isOwner: v.is_owner,
                ranking: parseInt(v.ranking) || index + 1,
            }))
        });
    } catch (error) {
        console.error('[PROMO-VIDEOS] Erro ao buscar feed:', error);
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

        const grossPPV = data.pricePerView;
        const targetViews = Math.floor((data.budget / grossPPV) * 1.02); // 2% bonus views
        const viewerPool = data.budget * VIEWER_SHARE;

        const userResult = await pool.query('SELECT name, email, cpf, balance FROM users WHERE id = $1', [userPayload.id]);
        const user = userResult.rows[0];

        if (data.paymentMethod === 'BALANCE') {
            const userBalance = parseFloat(user.balance);
            if (userBalance < data.budget) return c.json({ success: false, message: 'Saldo insuficiente.' }, 400);

            const result = await executeInTransaction(pool, async (client) => {
                await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [data.budget, userPayload.id]);

                const quotaShare = data.budget * QUOTA_HOLDERS_SHARE;
                const systemShare = data.budget * SERVICE_FEE_SHARE;
                await client.query(
                    'UPDATE system_config SET profit_pool = profit_pool + $1, system_balance = system_balance + $2',
                    [quotaShare, systemShare]
                );

                const videoResult = await client.query(`
                    INSERT INTO promo_videos (
                        user_id, title, description, video_url, thumbnail_url, platform, tag,
                        duration_seconds, price_per_view, min_watch_seconds, budget, spent, 
                        target_views, status, is_active, is_approved
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, 'ACTIVE', TRUE, TRUE)
                    RETURNING id
                `, [
                    userPayload.id, data.title, data.description || null, data.videoUrl,
                    data.thumbnailUrl || null, data.platform, data.tag || 'OUTROS', data.durationSeconds,
                    grossPPV, data.minWatchSeconds || 20, viewerPool, targetViews
                ]);

                await client.query(`
                    INSERT INTO transactions (user_id, type, amount, description, status)
                    VALUES ($1, 'PROMO_VIDEO_BUDGET', $2, $3, 'COMPLETED')
                `, [userPayload.id, -data.budget, `Campanha: ${data.title} (${targetViews} views)`]);

                return { videoId: videoResult.rows[0].id };
            });

            return c.json({
                success: true,
                message: `Campanha ativa! Alcance: ${targetViews} views.`,
                data: { targetViews, viewerEarning: grossPPV * VIEWER_SHARE }
            });
        }

        if (data.paymentMethod === 'PIX') {
            const pixTotal = calculatePixTotal(data.budget);
            const paymentData = await createPixPayment({
                amount: pixTotal,
                description: `Promoção: ${data.title}`,
                external_reference: `PROMO_${userPayload.id}_${Date.now()}`,
                email: user.email,
                name: user.name,
                cpf: user.cpf,
            });

            await pool.query(`
                INSERT INTO promo_videos (
                    user_id, title, description, video_url, thumbnail_url, platform, tag,
                    duration_seconds, price_per_view, min_watch_seconds, budget, spent, target_views, status, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, 'PENDING', FALSE)
            `, [userPayload.id, data.title, data.description, data.videoUrl, data.thumbnailUrl, data.platform, data.tag || 'OUTROS', data.durationSeconds, grossPPV, data.minWatchSeconds || 20, viewerPool, targetViews]);

            return c.json({ success: true, message: 'PIX gerado!', data: paymentData });
        }

        if (data.paymentMethod === 'CARD' && data.cardData) {
            const cardTotal = calculateCardTotal(data.budget);
            const paymentData = await createCardPayment({
                amount: cardTotal,
                description: `Promoção: ${data.title}`,
                external_reference: `PROMO_${userPayload.id}_${Date.now()}`,
                email: user.email,
                name: user.name,
                cpf: user.cpf,
                creditCard: data.cardData,
                creditCardHolderInfo: {
                    name: data.cardData.holderName,
                    email: user.email,
                    cpfCnpj: data.cardData.cpf,
                    postalCode: '00000000',
                    addressNumber: '0',
                    phone: '00000000000',
                }
            });

            if (paymentData.status === 'CONFIRMED' || paymentData.status === 'RECEIVED') {
                // Ativar imediatamente se aprovado
                await pool.query(`
                    INSERT INTO promo_videos (
                        user_id, title, description, video_url, thumbnail_url, platform, tag,
                        duration_seconds, price_per_view, min_watch_seconds, budget, spent, target_views, status, is_active, is_approved
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, 'ACTIVE', TRUE, TRUE)
                `, [userPayload.id, data.title, data.description, data.videoUrl, data.thumbnailUrl, data.platform, data.tag || 'OUTROS', data.durationSeconds, grossPPV, data.minWatchSeconds || 20, viewerPool, targetViews]);

                return c.json({ success: true, message: 'Pago e ativado!' });
            }
            return c.json({ success: false, message: 'Cartão recusado.' }, 400);
        }

        return c.json({ success: false, message: 'Opção inválida' }, 400);
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Registrar início de view
promoVideosRoutes.post('/:videoId/start-view', async (c) => {
    try {
        const userPayload = c.get('user');
        const videoId = c.req.param('videoId');
        const pool = getDbPool(c);

        const videoResult = await pool.query(
            'SELECT * FROM promo_videos WHERE id = $1 AND is_active = TRUE AND status = $2',
            [videoId, 'ACTIVE']
        );

        if (videoResult.rows.length === 0) return c.json({ success: false, message: 'Vídeo não disponível' }, 404);
        const video = videoResult.rows[0];

        const isOwner = Number(video.user_id) === Number(userPayload.id);

        // Se é o dono, permite ver mas não ganha nada
        if (isOwner) {
            return c.json({
                success: true,
                data: {
                    viewId: null, // Sem ID de view
                    minWatchSeconds: video.min_watch_seconds,
                    viewerEarning: 0,
                    isOwner: true,
                }
            });
        }

        const existingView = await pool.query(
            'SELECT id FROM promo_video_views WHERE video_id = $1 AND viewer_id = $2',
            [videoId, userPayload.id]
        );
        if (existingView.rows.length > 0) return c.json({ success: false, message: 'Já assistiu' }, 400);

        if (parseFloat(video.budget) <= parseFloat(video.spent)) return c.json({ success: false, message: 'Esgotado' }, 400);

        const ipAddress = c.req.header('x-forwarded-for') || '127.0.0.1';
        const userAgent = c.req.header('user-agent') || 'Unknown';

        const viewResult = await pool.query(`
            INSERT INTO promo_video_views (video_id, viewer_id, ip_address, user_agent)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [videoId, userPayload.id, ipAddress, userAgent]);

        return c.json({
            success: true,
            data: {
                viewId: viewResult.rows[0].id,
                minWatchSeconds: video.min_watch_seconds,
                viewerEarning: parseFloat(video.price_per_view) * VIEWER_SHARE,
                isOwner: false,
            }
        });
    } catch (error) {
        return c.json({ success: false, message: 'Erro ao iniciar' }, 500);
    }
});

// Completar view e receber pagamento
promoVideosRoutes.post('/:videoId/complete-view', async (c) => {
    try {
        const userPayload = c.get('user');
        const videoId = c.req.param('videoId');
        const body = await c.req.json();
        const watchTime = body.watchTimeSeconds || 0;
        const pool = getDbPool(c);

        const viewResult = await pool.query(`
            SELECT pvv.*, pv.price_per_view, pv.min_watch_seconds, pv.budget, pv.spent
            FROM promo_video_views pvv
            JOIN promo_videos pv ON pvv.video_id = pv.id
            WHERE pvv.video_id = $1 AND pvv.viewer_id = $2 AND pvv.completed = FALSE
        `, [videoId, userPayload.id]);

        if (viewResult.rows.length === 0) return c.json({ success: false, message: 'Não encontrado' }, 404);

        const view = viewResult.rows[0];
        const viewerEarning = parseFloat(view.price_per_view) * VIEWER_SHARE;

        if (watchTime < view.min_watch_seconds) return c.json({ success: false, message: 'Tempo insuficiente' }, 400);

        await executeInTransaction(pool, async (client) => {
            await client.query(`
                UPDATE promo_video_views SET completed = TRUE, watch_time_seconds = $1, earned = $2, finished_at = NOW()
                WHERE video_id = $3 AND viewer_id = $4
            `, [watchTime, viewerEarning, videoId, userPayload.id]);

            await client.query(`
                UPDATE promo_videos SET total_views = total_views + 1, spent = spent + $1 WHERE id = $2
            `, [viewerEarning, videoId]);

            await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [viewerEarning, userPayload.id]);
        });

        return c.json({ success: true, message: `Ganhou R$ ${viewerEarning.toFixed(2)}!` });
    } catch (error) {
        return c.json({ success: false, message: 'Erro ao processar' }, 500);
    }
});

// Minhas campanhas (com ranking global)
promoVideosRoutes.get('/my-campaigns', async (c) => {
    try {
        const userPayload = c.get('user');
        const pool = getDbPool(c);

        const result = await pool.query(`
            WITH ranked AS (
                SELECT id, ROW_NUMBER() OVER (ORDER BY total_views DESC, price_per_view DESC) as global_rank
                FROM promo_videos WHERE is_active = TRUE AND status = 'ACTIVE'
            )
            SELECT pv.*, 
                   COALESCE(r.global_rank, 0) as ranking,
                   (SELECT COUNT(*) FROM promo_video_views pvv WHERE pvv.video_id = pv.id AND pvv.completed = TRUE) as completed_views
            FROM promo_videos pv
            LEFT JOIN ranked r ON pv.id = r.id
            WHERE pv.user_id = $1 
            ORDER BY pv.created_at DESC
        `, [userPayload.id]);

        return c.json({
            success: true,
            data: result.rows.map(v => ({
                id: v.id,
                title: v.title,
                videoUrl: v.video_url,
                platform: v.platform,
                tag: v.tag || 'OUTROS',
                pricePerView: parseFloat(v.price_per_view),
                minWatchSeconds: v.min_watch_seconds || 20,
                budget: parseFloat(v.budget),
                spent: parseFloat(v.spent),
                remaining: parseFloat(v.budget) - parseFloat(v.spent),
                totalViews: parseInt(v.total_views) || 0,
                completedViews: parseInt(v.completed_views) || 0,
                targetViews: v.target_views,
                status: v.status,
                isActive: v.is_active,
                ranking: parseInt(v.ranking) || null,
                createdAt: v.created_at,
            }))
        });
    } catch (error) {
        console.error('[PROMO-VIDEOS] Erro ao buscar campanhas:', error);
        return c.json({ success: false, message: 'Erro ao buscar campanhas' }, 500);
    }
});

// Meus ganhos assistindo vídeos
promoVideosRoutes.get('/my-earnings', async (c) => {
    try {
        const userPayload = c.get('user');
        const pool = getDbPool(c);

        const result = await pool.query(`
            SELECT 
                COALESCE(SUM(earned), 0) as total_earned,
                COUNT(*) FILTER (WHERE completed = TRUE) as videos_watched
            FROM promo_video_views
            WHERE viewer_id = $1
        `, [userPayload.id]);

        const { total_earned, videos_watched } = result.rows[0];

        return c.json({
            success: true,
            data: {
                totalEarned: parseFloat(total_earned) || 0,
                videosWatched: parseInt(videos_watched) || 0
            }
        });
    } catch (error) {
        console.error('[PROMO-VIDEOS] Erro ao buscar ganhos:', error);
        return c.json({ success: false, message: 'Erro ao buscar ganhos' }, 500);
    }
});

export { promoVideosRoutes };
