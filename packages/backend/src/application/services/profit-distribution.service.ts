import { Pool, PoolClient } from 'pg';
import { notificationService } from './notification.service';

const DIVIDEND_USER_SHARE = 0.85; // 85% para usuários

export const distributeProfits = async (pool: Pool | PoolClient): Promise<any> => {
    try {
        // Buscar configuração do sistema
        const configResult = await pool.query('SELECT * FROM system_config LIMIT 1');
        const config = configResult.rows[0];

        if (!config || parseFloat(config.profit_pool) <= 0) {
            return { success: false, message: 'Não há lucros acumulados para distribuir' };
        }

        // Contar cotas ativas ELEGÍVEIS (Usuário tem empréstimo OU jogou)
        // Regra: "quem tiver cota e ter feito emprestimo ou jogou e pra ganha nas cotas"

        const eligibleUsersQuery = `
            WITH EligibleUsers AS (
                SELECT DISTINCT u.id 
                FROM users u
                LEFT JOIN loans l ON l.user_id = u.id
                LEFT JOIN transactions t ON t.user_id = u.id
                WHERE l.id IS NOT NULL OR t.type = 'GAME_BET'
            )
            SELECT q.user_id, COUNT(q.id) as quota_count
            FROM quotas q
            JOIN EligibleUsers eu ON q.user_id = eu.id
            WHERE q.status = 'ACTIVE'
            GROUP BY q.user_id
        `;

        const eligibleResult = await pool.query(eligibleUsersQuery);
        const usersWithQuotas = eligibleResult.rows;

        // Calcular total de cotas elegíveis
        const eligibleTotalQuotas = usersWithQuotas.reduce((acc, row) => acc + parseInt(row.quota_count), 0);

        console.log('DEBUG - Cotas elegíveis para dividendo:', eligibleTotalQuotas);

        if (eligibleTotalQuotas === 0) {
            // Se não há cotas elegíveis, todo o lucro vai para o caixa operacional
            const profitToTransfer = parseFloat(config.profit_pool);

            if (profitToTransfer > 0) {
                await pool.query(
                    'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = 0',
                    [profitToTransfer]
                );

                return {
                    success: true,
                    message: `Não há cotistas elegíveis (ativos em empréstimos/jogos). Lucro de R$ ${profitToTransfer.toFixed(2)} revertido para o Caixa Operacional.`,
                    data: { transferredToBalance: profitToTransfer }
                };
            }

            return { success: false, message: 'Não há cotas elegíveis e sem lucro para distribuir.' };
        }

        const profit = parseFloat(config.profit_pool);
        const totalForUsers = profit * DIVIDEND_USER_SHARE;
        const totalForMaintenance = profit - totalForUsers;

        // O valor por cota aumenta, pois o bolo é dividido por menos gente (apenas elegíveis)
        const dividendPerQuota = totalForUsers / eligibleTotalQuotas;

        // Distribuir para usuários - OTIMIZADO
        // Buscar APENAS usuários que têm cotas, já com a contagem
        // A lógica de usersWithQuotas já foi atualizada para pegar apenas elegíveis
        let distributedTotal = 0;

        console.log('DEBUG - Iniciando distribuição automática de dividendos (Elegíveis):', {
            totalProfit: profit,
            totalForUsers,
            eligibleTotalQuotas,
            dividendPerQuota,
            usersCount: usersWithQuotas.length
        });

        for (const user of usersWithQuotas) {
            const quotaCount = parseInt(user.quota_count);
            const userShare = Number((quotaCount * dividendPerQuota).toFixed(2)); // Garantir precisão de 2 casas decimais

            if (userShare > 0) {
                // Atualizar saldo do usuário
                await pool.query(
                    'UPDATE users SET balance = balance + $1 WHERE id = $2',
                    [userShare, user.user_id]
                );

                // Criar transação de dividendo
                await pool.query(
                    `INSERT INTO transactions (user_id, type, amount, description, status)
           VALUES ($1, 'DEPOSIT', $2, $3, 'APPROVED')`,
                    [
                        user.user_id,
                        userShare,
                        `Dividendos (85% do Lucro): R$ ${dividendPerQuota.toFixed(4)}/cota (${quotaCount} cotas) - Elegível`
                    ]
                );

                distributedTotal += userShare;
            }
        }

        // Transferir 15% para manutenção E zerar o profit_pool
        // Ajustar diferença de arredondamento se houver
        const roundingDifference = totalForUsers - distributedTotal;
        const finalMaintenance = totalForMaintenance + roundingDifference;

        await pool.query(
            'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = 0',
            [finalMaintenance]
        );

        console.log('DEBUG - Distribuição automática finalizada:', {
            distributedTotal,
            finalMaintenance,
            roundingDifference
        });

        // Notificar Admin
        await notificationService.notifyProfitDistributed(profit);

        return {
            success: true,
            message: 'Distribuição de lucros realizada com sucesso!',
            data: {
                totalProfit: profit,
                distributed: distributedTotal,
                maintenance: finalMaintenance,
                perQuota: dividendPerQuota,
                eligibleTotalQuotas,
                usersBenefited: usersWithQuotas.length
            },
        };
    } catch (error) {
        console.error('Erro ao distribuir dividendos automaticamente:', error);
        throw error;
    }
};
