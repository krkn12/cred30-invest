import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction } from '../../../domain/services/transaction.service';
import { PoolClient } from 'pg';
import { updateScore } from '../../../application/services/score.service';

const educationRoutes = new Hono();

const rewardSchema = z.object({
    points: z.number().positive(),
    lessonId: z.number().optional().default(0), // Para tracking futuro
    securityHash: z.string().optional() // Placeholder para anti-cheat futuro
});

// Taxa de conversão: 1000 pontos = R$ 0.29
const POINTS_TO_CURRENCY_RATE = 0.29 / 1000;
const POINTS_TO_SCORE_RATE = 1 / 1000; // 1 Ponto de Score a cada 1000 pts de estudo

educationRoutes.post('/reward', authMiddleware, async (c) => {
    try {
        const body = await c.req.json();
        const { points, lessonId } = rewardSchema.parse(body);
        const user = c.get('user');
        const pool = getDbPool(c);

        // Calcular valores
        const amountToPay = points * POINTS_TO_CURRENCY_RATE;
        const scoreToAdd = Math.floor(points * POINTS_TO_SCORE_RATE);

        // Validar limites diários (Anti-Cheat Básico)
        // TODO: Implementar Redis ou Tabela de Limites Diários se escalar muito

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            // 1. Verificar Caixa Operacional (Profit Pool) com Lock
            // Usamos Profit Pool para recompensas para não descapitalizar o principal dos investidores
            const systemConfigResult = await client.query(
                'SELECT profit_pool FROM system_config LIMIT 1 FOR UPDATE'
            );

            const currentProfitPool = parseFloat(systemConfigResult.rows[0].profit_pool);

            // A TRAVA: Se não tiver dinheiro no lucro, não paga.
            if (currentProfitPool < amountToPay) {
                throw new Error('LIMIT_REACHED');
            }

            // 2. Debitar do Caixa do Sistema
            await client.query(
                'UPDATE system_config SET profit_pool = profit_pool - $1',
                [amountToPay]
            );

            // 3. Creditar usuário
            await client.query(
                'UPDATE users SET balance = balance + $1 WHERE id = $2',
                [amountToPay, user.id]
            );

            // 4. Atualizar Score (Se aplicável)
            if (scoreToAdd > 0) {
                // Usamos a função de serviço existente ou update direto
                // Como já estamos em transaction, melhor update direto para garantir atomicidade total
                await client.query(
                    'UPDATE users SET score = score + $1 WHERE id = $2',
                    [scoreToAdd, user.id]
                );
            }

            // 5. Registrar Transação
            const txResult = await client.query(
                `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
         VALUES ($1, 'EDUCATION_REWARD', $2, $3, 'COMPLETED', $4)
         RETURNING id`,
                [
                    user.id,
                    amountToPay,
                    `Recompensa Cred30 Academy - Aula #${lessonId}`,
                    JSON.stringify({ points, lessonId, rate: POINTS_TO_CURRENCY_RATE })
                ]
            );

            return {
                transactionId: txResult.rows[0].id,
                amount: amountToPay,
                scoreAdded: scoreToAdd
            };
        });

        return c.json({
            success: true,
            message: 'Recompensa creditada com sucesso!',
            data: result
        });

    } catch (error: any) {
        if (error.message === 'LIMIT_REACHED') {
            return c.json({
                success: false,
                message: 'O Fundo de Recompensas Educacionais atingiu o limite momentâneo. Tente novamente mais tarde quando houver nova distribuição de lucros.'
            }, 429); // Too Many Requests / Backoff
        }

        if (error instanceof z.ZodError) {
            return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
        }

        console.error('Erro ao processar recompensa:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

export { educationRoutes };
