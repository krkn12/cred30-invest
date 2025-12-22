import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';
import { PoolClient } from 'pg';
import { executeInTransaction, createTransaction } from '../../../domain/services/transaction.service';
import { z } from 'zod';
import { calculateTotalToPay, PaymentMethod } from '../../../shared/utils/financial.utils';
import { createPixPayment, createCardPayment } from '../../../infrastructure/gateways/mercadopago.service';
import { updateScore } from '../../../application/services/score.service';
import { VERIFIED_BADGE_PRICE, SCORE_BOOST_PRICE, SCORE_BOOST_POINTS } from '../../../shared/constants/business.constants';

const monetizationRoutes = new Hono();

const PRO_UPGRADE_FEE = 29.90;

const upgradeProSchema = z.object({
    method: z.enum(['balance', 'pix', 'card']).default('balance'),
    token: z.string().optional(),
    issuer_id: z.union([z.string(), z.number()]).optional(),
    installments: z.number().optional(),
    payment_method_id: z.string().optional(),
});

/**
 * Recompensa por Video (Rewarded Ads)
 */
monetizationRoutes.post('/reward-video', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);

        // Configurações de recompensa (Sustentabilidade: Adsterra/CPM real)
        const REWARD_AMOUNT = 0.002; // R$ 0,002 por vídeo (Sustentável para CPM de R$ 2,00)
        const REWARD_SCORE = 5; // Aumentado para +5 pontos de Score (Incentiva o limite de crédito)
        const COOLDOWN_MINUTES = 10; // Reduzido para 10 min para permitir mais engajamento

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
        const body = await c.req.json();
        const { method, token, issuer_id, installments, payment_method_id } = upgradeProSchema.parse(body);

        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);

        // 1. Verificar se já é PRO
        const userCheck = await pool.query('SELECT membership_type, balance, email, name FROM users WHERE id = $1', [user.id]);
        if (userCheck.rows[0].membership_type === 'PRO') {
            return c.json({ success: false, message: 'Você já é um membro PRO!' }, 400);
        }

        // 2. Calcular valores com taxas
        const payMethod = method as PaymentMethod;
        const { total: finalAmount, fee } = calculateTotalToPay(PRO_UPGRADE_FEE, payMethod);

        if (payMethod === 'balance') {
            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                if (parseFloat(userCheck.rows[0].balance) < PRO_UPGRADE_FEE) {
                    throw new Error('Saldo insuficiente para o upgrade PRO.');
                }

                // Cobrar taxa
                await client.query('UPDATE users SET balance = balance - $1, membership_type = $2 WHERE id = $3', [PRO_UPGRADE_FEE, 'PRO', user.id]);

                // Distribuir lucros (85% para cotistas / 15% Operacional)
                const feeForProfit = PRO_UPGRADE_FEE * 0.85;
                const feeForOperational = PRO_UPGRADE_FEE * 0.15;

                await client.query(
                    'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
                    [feeForOperational, feeForProfit]
                );

                // Registrar transação
                await createTransaction(
                    client,
                    user.id,
                    'MEMBERSHIP_UPGRADE',
                    -PRO_UPGRADE_FEE,
                    'Upgrade para Plano Cred30 PRO (Saldo)',
                    'APPROVED'
                );

                return { success: true };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);
            return c.json({ success: true, message: 'Parabéns! Agora você é um MEMBRO PRO!' });
        }

        // 3. Pagamento Externo (PIX ou CARTÃO)
        let paymentData: any;

        if (payMethod === 'pix') {
            paymentData = await createPixPayment({
                amount: finalAmount,
                description: `Upgrade PRO - ${userCheck.rows[0].name.split(' ')[0]}`,
                email: userCheck.rows[0].email,
                external_reference: user.id.toString()
            });
        } else {
            if (!token) return c.json({ success: false, message: 'Token do cartão é obrigatório' }, 400);
            paymentData = await createCardPayment({
                amount: finalAmount,
                token,
                description: `Upgrade PRO`,
                email: userCheck.rows[0].email,
                external_reference: user.id.toString(),
                installments: installments || 1,
                payment_method_id,
                issuer_id: issuer_id ? Number(issuer_id) : undefined
            });
        }

        // 4. Criar transação pendente
        const transResult = await executeInTransaction(pool, async (client: PoolClient) => {
            const trans = await createTransaction(
                client,
                user.id,
                'MEMBERSHIP_UPGRADE',
                -PRO_UPGRADE_FEE,
                `Upgrade PRO via ${payMethod.toUpperCase()}`,
                'PENDING',
                {
                    external_id: paymentData.id,
                    payment_method: payMethod,
                    is_upgrade: true
                }
            );
            return trans;
        });

        return c.json({
            success: true,
            message: payMethod === 'pix' ? 'QR Code gerado com sucesso!' : 'Pagamento processado!',
            data: {
                paymentId: paymentData.id,
                transactionId: transResult.data?.transactionId,
                pixData: payMethod === 'pix' ? {
                    qr_code: paymentData.qr_code,
                    qr_code_base64: paymentData.qr_code_base64
                } : null
            }
        });

    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

/**
 * Comprar Selo de Verificado (Confiança + Score)
 */
monetizationRoutes.post('/buy-verified-badge', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            // Verificar se já possui
            const userRes = await client.query('SELECT is_verified, balance FROM users WHERE id = $1', [user.id]);
            if (userRes.rows[0].is_verified) {
                throw new Error('Você já possui o Selo de Verificado!');
            }

            if (parseFloat(userRes.rows[0].balance) < VERIFIED_BADGE_PRICE) {
                throw new Error(`Saldo insuficiente. Necessário R$ ${VERIFIED_BADGE_PRICE.toFixed(2)}.`);
            }

            // Cobrar
            await client.query('UPDATE users SET balance = balance - $1, is_verified = TRUE WHERE id = $2', [VERIFIED_BADGE_PRICE, user.id]);

            // Dar Score Bônus pela Confiança (+100)
            await updateScore(client, user.id, 100, 'Compra de Selo de Verificado (Confiança)');

            // Distribuir Lucro (100% Margem) -> 85% Profit Pool / 15% Operacional
            const feeForProfit = VERIFIED_BADGE_PRICE * 0.85;
            const feeForOperational = VERIFIED_BADGE_PRICE * 0.15;
            await client.query(
                'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
                [feeForOperational, feeForProfit]
            );

            // Registrar Transação
            await createTransaction(
                client,
                user.id,
                'PREMIUM_PURCHASE',
                -VERIFIED_BADGE_PRICE,
                'Compra de Selo de Verificado',
                'APPROVED'
            );

            return { success: true };
        });

        if (!result.success) return c.json({ success: false, message: result.error }, 400);
        return c.json({ success: true, message: 'Selo de Verificado Adquirido! Sua confiança aumentou.' });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

/**
 * Comprar Pacote de Score (Boost)
 */
monetizationRoutes.post('/buy-score-boost', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            const userRes = await client.query('SELECT balance FROM users WHERE id = $1', [user.id]);

            if (parseFloat(userRes.rows[0].balance) < SCORE_BOOST_PRICE) {
                throw new Error(`Saldo insuficiente. Necessário R$ ${SCORE_BOOST_PRICE.toFixed(2)}.`);
            }

            // Cobrar
            await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [SCORE_BOOST_PRICE, user.id]);

            // Dar Boost
            await updateScore(client, user.id, SCORE_BOOST_POINTS, 'Compra de Pacote Score Boost');

            // Distribuir Lucro -> 85% Profit Pool / 15% Operacional
            const feeForProfit = SCORE_BOOST_PRICE * 0.85;
            const feeForOperational = SCORE_BOOST_PRICE * 0.15;
            await client.query(
                'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
                [feeForOperational, feeForProfit]
            );

            // Registrar Transação
            await createTransaction(
                client,
                user.id,
                'PREMIUM_PURCHASE',
                -SCORE_BOOST_PRICE,
                'Compra de Pacote Score Boost (+100)',
                'APPROVED'
            );

            return { success: true };
        });

        if (!result.success) return c.json({ success: false, message: result.error }, 400);
        return c.json({ success: true, message: `Boost Ativado! +${SCORE_BOOST_POINTS} pontos adicionados ao seu Score.` });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

export { monetizationRoutes };
