import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, createTransaction } from '../../../domain/services/transaction.service';
import { PoolClient } from 'pg';

export const earnRoutes = new Hono();

/**
 * Recompensa do Baú Diário (Chest Reward)
 * O usuário assiste anúncio e ganha pequena recompensa
 */
earnRoutes.post('/chest-reward', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);
        const body = await c.req.json();
        const { amount } = body;

        // Validar valor (máximo R$ 0,05 por baú para ser sustentável)
        const rewardAmount = Math.min(parseFloat(amount) || 0.01, 0.05);

        if (rewardAmount <= 0) {
            return c.json({ success: false, message: 'Valor inválido' }, 400);
        }

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            // Verificar cooldown (1 hora entre baús)
            const userRes = await client.query(
                `SELECT last_reward_at, balance FROM users WHERE id = $1`,
                [user.id]
            );

            const lastReward = userRes.rows[0]?.last_reward_at;
            const now = new Date();
            const cooldownMs = 60 * 60 * 1000; // 1 hora

            if (lastReward && (now.getTime() - new Date(lastReward).getTime()) < cooldownMs) {
                const remaining = Math.ceil((cooldownMs - (now.getTime() - new Date(lastReward).getTime())) / 60000);
                throw new Error(`Aguarde ${remaining} minutos para abrir outro baú`);
            }

            // Creditar recompensa
            await client.query(
                `UPDATE users SET balance = balance + $1, last_reward_at = CURRENT_TIMESTAMP WHERE id = $2`,
                [rewardAmount, user.id]
            );

            // Registrar transação
            await createTransaction(
                client,
                user.id,
                'BONUS',
                rewardAmount,
                `Baú de Fidelidade Aberto`,
                'APPROVED'
            );

            return { success: true };
        });

        if (!result.success) {
            return c.json({ success: false, message: result.error }, 400);
        }

        return c.json({
            success: true,
            message: `Você recebeu R$ ${rewardAmount.toFixed(2)} do Baú de Fidelidade!`
        });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

/**
 * Recompensa por assistir vídeo promocional
 */
earnRoutes.post('/video-reward', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);
        const body = await c.req.json();
        const { videoId } = body;

        const REWARD_AMOUNT = 0.002; // R$ 0,002 por vídeo

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            // Creditar recompensa
            await client.query(
                `UPDATE users SET balance = balance + $1 WHERE id = $2`,
                [REWARD_AMOUNT, user.id]
            );

            // Registrar transação
            await createTransaction(
                client,
                user.id,
                'BONUS',
                REWARD_AMOUNT,
                `Recompensa por vídeo assistido`,
                'APPROVED'
            );

            return { success: true };
        });

        if (!result.success) {
            return c.json({ success: false, message: result.error }, 400);
        }

        return c.json({ success: true, message: `Bônus de R$ ${REWARD_AMOUNT.toFixed(3)} recebido!` });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});
