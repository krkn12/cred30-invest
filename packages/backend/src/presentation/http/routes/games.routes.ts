import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';
import { executeInTransaction, updateUserBalance, createTransaction } from '../../../domain/services/transaction.service';
import { updateScore, SCORE_REWARDS } from '../../../application/services/score.service';

const gamesRoutes = new Hono();

// Configuração do Caça-Níquel
// Símbolos: Candy (Bala), Ball (Bola), Bike, Phone (Celular), TV, Car (Carro)
const SYMBOLS = ['🍬', '⚽', '🚲', '📱', '📺', '🚗'];
const BATCH_COST = 0.05; // R$ 0,05 por pacote
const SPINS_PER_BATCH = 20; // 20 rodadas por pacote
const POINTS_TO_REAL = 1000; // 1000 pontos = R$ 1,00

// Probabilidades (Pesos)
const PROBABILITIES = {
    '🍬': 45, // Muito Comum
    '⚽': 30, // Comum
    '🚲': 15, // Incomum
    '📱': 7,  // Raro
    '📺': 2.5,// Muito Raro
    '🚗': 0.5 // Jackpot
};

// Pontos por combinação (3 iguais)
const PAYOUTS: Record<string, number> = {
    '🍬': 10,   // R$ 0,010 (Recupera 20% do pacote)
    '⚽': 20,   // R$ 0,020 (40% do pacote)
    '🚲': 50,   // R$ 0,050 (Paga o pacote)
    '📱': 200,  // R$ 0,200 (Lucro 4x)
    '📺': 1000, // R$ 1,000 (Lucro 20x)
    '🚗': 10000 // R$ 10,000 (Jackpot)
};

const getRandomSymbol = () => {
    const totalWeight = Object.values(PROBABILITIES).reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (const symbol of SYMBOLS) {
        random -= PROBABILITIES[symbol as keyof typeof PROBABILITIES];
        if (random <= 0) return symbol;
    }
    return SYMBOLS[0];
};

gamesRoutes.post('/slot/spin', authMiddleware, async (c) => {
    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    try {
        const result = await executeInTransaction(pool, async (client) => {
            // 1. Verificar saldo
            const userRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [user.id]);
            const currentBalance = parseFloat(userRes.rows[0].balance);

            if (currentBalance < BATCH_COST) {
                throw new Error(`Saldo insuficiente. Necessário R$ ${BATCH_COST.toFixed(2)} para 20 rodadas.`);
            }

            // 2. Cobrar o pacote do usuário
            // Importante: A aposta SEMPRE é revenue do sistema (85/15), e os prêmios são despesas.
            await updateUserBalance(client, user.id, BATCH_COST, 'debit');

            // Distribuir a receita da aposta (85% para cotistas / 15% Operacional)
            const toProfitPool = BATCH_COST * 0.85;
            const toOperational = BATCH_COST * 0.15;

            await client.query(
                'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
                [toOperational, toProfitPool]
            );

            // 3. Executar Lote de Giros (20x)
            let totalPointsWon = 0;
            let totalMoneyWon = 0;
            const results = [];
            let winCount = 0;

            for (let i = 0; i < SPINS_PER_BATCH; i++) {
                const reel1 = getRandomSymbol();
                const reel2 = getRandomSymbol();
                const reel3 = getRandomSymbol();

                const isWin = reel1 === reel2 && reel2 === reel3;
                let points = 0;

                if (isWin) {
                    points = PAYOUTS[reel1];
                    winCount++;
                }

                totalPointsWon += points;
                results.push({ reels: [reel1, reel2, reel3], isWin, points });
            }

            totalMoneyWon = totalPointsWon / POINTS_TO_REAL;

            // 4. Pagar Prêmios (Se houver)
            if (totalMoneyWon > 0) {
                // Sai do Caixa Operacional -> Vai para Usuário
                await updateUserBalance(client, user.id, totalMoneyWon, 'credit');

                // Deduzir do sistema
                await client.query('UPDATE system_config SET system_balance = system_balance - $1', [totalMoneyWon]);

                // Registrar transação de Ganho (Agrupada)
                await createTransaction(
                    client,
                    user.id,
                    'GAME_WIN',
                    totalMoneyWon,
                    `Prêmio Caça-Níquel (20 rodadas): ${winCount} acertos`,
                    'APPROVED'
                );
            }

            // Registrar transação da Aposta (Para histórico e elegibilidade de dividendos)
            await createTransaction(
                client,
                user.id,
                'GAME_BET',
                BATCH_COST,
                `Pacote 20 Rodadas`,
                'APPROVED'
            );

            // 5. Atualizar Score por participação
            await updateScore(client, user.id, SCORE_REWARDS.GAME_PARTICIPATION, 'Participação no Caça-Níquel');

            return {
                batchResults: results,
                totalMoneyWon,
                totalPointsWon,
                winCount,
                newBalance: currentBalance - BATCH_COST + totalMoneyWon
            };
        });

        if (!result.success) {
            return c.json({ success: false, message: result.error }, 400);
        }

        return c.json({ success: true, data: result.data });

    } catch (error) {
        console.error('Erro no jogo:', error);
        return c.json({ success: false, message: 'Erro interno' }, 500);
    }
});

export { gamesRoutes };
