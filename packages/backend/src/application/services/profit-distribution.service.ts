
import { Pool, PoolClient } from 'pg';

const DIVIDEND_USER_SHARE = 0.85; // 85% para usuários

export const distributeProfits = async (pool: Pool | PoolClient): Promise<any> => {
    try {
        // Buscar configuração do sistema
        const configResult = await pool.query('SELECT * FROM system_config LIMIT 1');
        const config = configResult.rows[0];

        if (!config || parseFloat(config.profit_pool) <= 0) {
            return { success: false, message: 'Não há lucros acumulados para distribuir' };
        }

        // Contar cotas ativas
        const totalQuotasResult = await pool.query("SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE'");
        const totalQuotas = parseInt(totalQuotasResult.rows[0].count);

        if (totalQuotas === 0) {
            // Se não há cotas, todo o lucro vai para o caixa operacional
            const profitToTransfer = parseFloat(config.profit_pool);

            if (profitToTransfer > 0) {
                await pool.query(
                    'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = 0',
                    [profitToTransfer]
                );

                return {
                    success: true,
                    message: `Não há cotas ativas. Lucro de R$ ${profitToTransfer.toFixed(2)} transferido para o Caixa Operacional.`,
                    data: { transferredToBalance: profitToTransfer }
                };
            }

            return { success: false, message: 'Não há cotas ativas e sem lucro para distribuir.' };
        }

        const profit = parseFloat(config.profit_pool);
        const totalForUsers = profit * DIVIDEND_USER_SHARE;
        const totalForMaintenance = profit - totalForUsers;
        const dividendPerQuota = totalForUsers / totalQuotas;

        // Distribuir para usuários - OTIMIZADO
        // Buscar APENAS usuários que têm cotas, já com a contagem
        const usersWithQuotasResult = await pool.query(
            `SELECT user_id, COUNT(*) as quota_count 
       FROM quotas 
       WHERE status = 'ACTIVE' 
       GROUP BY user_id`
        );

        const usersWithQuotas = usersWithQuotasResult.rows;
        let distributedTotal = 0;

        console.log('DEBUG - Iniciando distribuição automática de dividendos:', {
            totalProfit: profit,
            totalForUsers,
            totalQuotas,
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
                        `Dividendos (85% do Lucro): R$ ${dividendPerQuota.toFixed(4)}/cota (${quotaCount} cotas)`
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

        return {
            success: true,
            message: 'Distribuição de lucros realizada com sucesso!',
            data: {
                totalProfit: profit,
                distributed: distributedTotal,
                maintenance: finalMaintenance,
                perQuota: dividendPerQuota,
                totalQuotas,
                usersBenefited: usersWithQuotas.length
            },
        };
    } catch (error) {
        console.error('Erro ao distribuir dividendos automaticamente:', error);
        throw error;
    }
};
