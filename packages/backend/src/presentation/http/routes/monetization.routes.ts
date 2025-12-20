import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';
import { PoolClient } from 'pg';
import { executeInTransaction, createTransaction } from '../../../domain/services/transaction.service';

const monetizationRoutes = new Hono();

/**
 * Recompensa por Video (Rewarded Ads)
 */
monetizationRoutes.post('/reward-video', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);

        // Configurações de recompensa
        const REWARD_AMOUNT = 0.05; // R$ 0,05 por vídeo
        const REWARD_SCORE = 2; // +2 pontos de Score
        const COOLDOWN_MINUTES = 30; // 1 vídeo a cada 30 min

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            // 1. Verificar cooldown
            const userRes = await client.query('SELECT last_reward_at, score, balance FROM users WHERE id = $1', [user.id]);
            const lastReward = userRes.rows[0].last_reward_at;

            if (lastReward) {
                const diff = (Date.now() - new Date(lastReward).getTime()) / (1000 * 60);
                if (diff < COOLDOWN_MINUTES) {
                    throw new Error(`Aguarde mais ${Math.ceil(COOLDOWN_MINUTES - diff)} minutos para o próximo vídeo.`);
                }
            }

            // 2. Dar a recompensa
            await client.query(
                'UPDATE users SET balance = balance + $1, score = score + $2, last_reward_at = NOW() WHERE id = $3',
                [REWARD_AMOUNT, REWARD_SCORE, user.id]
            );

            // 3. Registrar transação
            await createTransaction(
                client,
                user.id,
                'AD_REWARD',
                REWARD_AMOUNT,
                'Recompensa: Vídeo Premiado Assistido',
                'APPROVED'
            );

            return { success: true };
        });

        if (!result.success) return c.json({ success: false, message: result.error }, 400);
        return c.json({ success: true, message: `Bônus recebido! + R$ ${REWARD_AMOUNT.toFixed(2)} e +${REWARD_SCORE} Score.` });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

/**
 * Assinatura Cred30 PRO
 */
monetizationRoutes.post('/upgrade-pro', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const PRO_FEE = 29.90; // Mensalidade PRO

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            const userRes = await client.query('SELECT balance, membership_type FROM users WHERE id = $1', [user.id]);
            if (userRes.rows[0].membership_type === 'PRO') throw new Error('Você já é um membro PRO!');
            if (parseFloat(userRes.rows[0].balance) < PRO_FEE) throw new Error('Saldo insuficiente para o upgrade PRO.');

            // 1. Cobrar taxa
            await client.query('UPDATE users SET balance = balance - $1, membership_type = $2 WHERE id = $3', [PRO_FEE, 'PRO', user.id]);

            // 2. Distribuir lucros (50% dividendos)
            const feeForProfit = PRO_FEE * 0.5;
            const feeForOperational = PRO_FEE * 0.5;

            await client.query(
                'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
                [feeForOperational, feeForProfit]
            );

            // 3. Registrar transação
            await createTransaction(
                client,
                user.id,
                'MEMBERSHIP_UPGRADE',
                -PRO_FEE,
                'Upgrade para Plano Cred30 PRO',
                'APPROVED'
            );

            return { success: true };
        });

        if (!result.success) return c.json({ success: false, message: result.error }, 400);
        return c.json({ success: true, message: 'Parabéns! Agora você é um MEMBRO PRO com taxas reduzidas e prioridade.' });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

export { monetizationRoutes };
