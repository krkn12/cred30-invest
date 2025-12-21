import { Pool, PoolClient } from 'pg';
import {
    DIVIDEND_USER_SHARE,
    MAINTENANCE_TAX_SHARE,
    MAINTENANCE_OPERATIONAL_SHARE,
    MAINTENANCE_OWNER_SHARE
} from '../../shared/constants/business.constants';
import { notificationService } from './notification.service';

export const distributeProfits = async (pool: Pool | PoolClient): Promise<any> => {
    try {
        // Buscar configuração do sistema
        const configResult = await pool.query('SELECT * FROM system_config LIMIT 1');
        const config = configResult.rows[0];

        if (!config || parseFloat(config.profit_pool) <= 0) {
            return { success: false, message: 'Não há resultados acumulados para distribuir' };
        }

        // Contar licenças ativas ELEGÍVEIS (Usuário tem apoio OU jogou)
        // Regra: "quem tiver licença e ter feito apoio ou jogou e pra ganha nas licenças"

        const eligibleUsersQuery = `
            SELECT q.user_id, COUNT(q.id) as quota_count
            FROM quotas q
            WHERE q.status = 'ACTIVE'
            AND (
                EXISTS (SELECT 1 FROM loans l WHERE l.user_id = q.user_id)
                OR 
                EXISTS (
                    SELECT 1 FROM transactions t 
                    WHERE t.user_id = q.user_id 
                    AND t.type IN ('GAME_BET', 'MARKET_BOOST', 'AD_REWARD', 'MEMBERSHIP_UPGRADE', 'MARKET_PURCHASE_CREDIT', 'MARKET_SALE')
                )
            )
            GROUP BY q.user_id
        `;

        const eligibleResult = await pool.query(eligibleUsersQuery);
        const usersWithQuotas = eligibleResult.rows;

        // Calcular total de licenças elegíveis
        const eligibleTotalQuotas = usersWithQuotas.reduce((acc, row) => acc + parseInt(row.quota_count), 0);

        console.log('DEBUG - Licenças elegíveis para bônus:', eligibleTotalQuotas);

        if (eligibleTotalQuotas === 0) {
            // Se não há licenças elegíveis, todo o resultado vai para o caixa operacional
            const profitToTransfer = parseFloat(config.profit_pool);

            if (profitToTransfer > 0) {
                await pool.query(
                    'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = 0',
                    [profitToTransfer]
                );

                return {
                    success: true,
                    message: `Não há licenciados elegíveis (ativos em apoios/jogos). Resultado de R$ ${profitToTransfer.toFixed(2)} revertido para o Caixa Operacional.`,
                    data: { transferredToBalance: profitToTransfer }
                };
            }

            return { success: false, message: 'Não há licenças elegíveis e sem resultados para distribuir.' };
        }

        const profit = parseFloat(config.profit_pool);
        const totalForUsers = profit * DIVIDEND_USER_SHARE;

        // Rateio detalhado da manutenção
        const taxAmount = profit * MAINTENANCE_TAX_SHARE;
        const operationalAmount = profit * MAINTENANCE_OPERATIONAL_SHARE;
        const ownerAmount = profit * MAINTENANCE_OWNER_SHARE;

        const totalForMaintenance = taxAmount + operationalAmount + ownerAmount;

        // O valor por licença aumenta, pois o bolo é dividido por menos gente (apenas elegíveis)
        const dividendPerQuota = totalForUsers / eligibleTotalQuotas;

        // Distribuir para usuários - OTIMIZAÇÃO MASSIVA (Batch Processing)
        console.log('DEBUG - Iniciando distribuição batch para elegíveis...', {
            totalProfit: profit,
            usersCount: usersWithQuotas.length
        });

        // Preparar arrays para o processamento batch no Postgres
        const userIds = usersWithQuotas.map(u => u.user_id);
        const userAmounts = usersWithQuotas.map(u => Number((parseInt(u.quota_count) * dividendPerQuota).toFixed(2)));
        const userDescriptions = usersWithQuotas.map(u =>
            `Bônus Disponível (85% do Resultado): R$ ${dividendPerQuota.toFixed(4)}/licença (${u.quota_count} licenças) - Elegível`
        );

        // Executar atualização em massa e inserção de transações em uma única chamada
        // Usamos UNNEST para transformar os arrays em uma tabela virtual e JOIN para atualizar/inserir
        await pool.query(`
            WITH distribution_data AS (
                SELECT 
                    unnest($1::int[]) as u_id, 
                    unnest($2::decimal[]) as u_amount,
                    unnest($3::text[]) as u_desc
            ),
            update_balances AS (
                UPDATE users u
                SET balance = u.balance + dd.u_amount
                FROM distribution_data dd
                WHERE u.id = dd.u_id
            )
            INSERT INTO transactions (user_id, type, amount, description, status)
            SELECT u_id, 'DEPOSIT', u_amount, u_desc, 'APPROVED'
            FROM distribution_data
            WHERE u_amount > 0;
        `, [userIds, userAmounts, userDescriptions]);

        const distributedTotal = userAmounts.reduce((acc, val) => acc + val, 0);

        // Transferir 15% para manutenção E zerar o profit_pool
        // Ajustar diferença de arredondamento se houver
        const roundingDifference = totalForUsers - distributedTotal;
        const finalMaintenance = totalForMaintenance + roundingDifference;

        await pool.query(
            `UPDATE system_config 
             SET system_balance = system_balance + $1, 
                 total_tax_reserve = total_tax_reserve + $2,
                 total_operational_reserve = total_operational_reserve + $3,
                 total_owner_profit = total_owner_profit + $4,
                 profit_pool = 0`,
            [finalMaintenance, taxAmount, operationalAmount, ownerAmount]
        );

        console.log('DEBUG - Distribuição batch finalizada com sucesso.');

        // Notificar Admin
        notificationService.notifyProfitDistributed(profit).catch(e => console.error('Erro ao notificar admin:', e));

        return {
            success: true,
            message: 'Distribuição de bônus realizada com sucesso!',
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
        console.error('Erro ao distribuir bônus automaticamente:', error);

        throw error;
    }
};
