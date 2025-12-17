import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';
import { executeInTransaction, updateUserBalance, createTransaction } from '../../../domain/services/transaction.service';

const gamesRoutes = new Hono();

// Configuração do Caça-Níquel
const SLOT_COST = 0.05; // R$ 0,05 (20 rodadas = R$ 1,00)
const POINTS_TO_REAL = 1000; // 1000 pontos = R$ 1,00

// Tabela de Prêmios (Símbolos e Pesos)
const SYMBOLS = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣'];
// Pesos para probabilidade (quanto maior, mais chance de cair)
// 7️⃣ é o mais raro
const PROBABILITIES = {
    '🍒': 40,
    '🍋': 30,
    '🍇': 15,
    '🔔': 10,
    '💎': 4,
    '7️⃣': 1
};

// Pontos por combinação (3 iguais)
const PAYOUTS: Record<string, number> = {
    '🍒': 50,   // 50 pts = R$ 0,05 (Recupera metade)
    '🍋': 100,  // 100 pts = R$ 0,10 (Empata)
    '🍇': 200,  // 200 pts = R$ 0,20 (Dobra)
    '🔔': 500,  // 500 pts = R$ 0,50 (5x)
    '💎': 1000, // 1000 pts = R$ 1,00 (10x)
    '7️⃣': 10000 // 10000 pts = R$ 10,00 (Jackpot 100x)
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

            if (currentBalance < SLOT_COST) {
                throw new Error('Saldo insuficiente para jogar.');
            }

            // 2. Cobrar a aposta do usuário
            await updateUserBalance(client, user.id, SLOT_COST, 'debit');

            // 3. Gerar resultado o jogo
            const reel1 = getRandomSymbol();
            const reel2 = getRandomSymbol();
            const reel3 = getRandomSymbol();

            const isWin = reel1 === reel2 && reel2 === reel3;
            let pointsWon = 0;
            let moneyWon = 0;

            if (isWin) {
                pointsWon = PAYOUTS[reel1];
                moneyWon = pointsWon / POINTS_TO_REAL;
            }

            // 4. Lógica Financeira
            if (isWin) {
                // GANHO: Sai do Caixa Operacional -> Vai para Usuário
                await updateUserBalance(client, user.id, moneyWon, 'credit');

                // Deduzir do sistema
                await client.query('UPDATE system_config SET system_balance = system_balance - $1', [moneyWon]);

                // Registrar transação de Ganho
                await createTransaction(
                    client,
                    user.id,
                    'GAME_WIN',
                    moneyWon,
                    `Prêmio Caça-Níquel: ${reel1}${reel2}${reel3}`,
                    'APPROVED'
                );

            } else {
                // PERDA: Distribuição 85% Caixa / 15% Cotas
                const toSystem = SLOT_COST * 0.85;
                const toProfitPool = SLOT_COST * 0.15;

                await client.query(
                    'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
                    [toSystem, toProfitPool]
                );
            }

            // Registrar transação da Aposta (para histórico de atividade)
            // Importante para a regra "quem jogou ganha dividendo"
            await createTransaction(
                client,
                user.id,
                'GAME_BET',
                SLOT_COST,
                `Aposta Caça-Níquel`,
                'APPROVED'
            );

            return {
                reels: [reel1, reel2, reel3],
                isWin,
                pointsWon,
                moneyWon,
                newBalance: isWin ? currentBalance - SLOT_COST + moneyWon : currentBalance - SLOT_COST
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
