
import { Pool, PoolClient } from 'pg';
import { executeInTransaction } from '../../domain/services/transaction.service';

/**
 * Serviço de Liquidação Automática
 * Varre o sistema em busca de empréstimos atrasados e executa a garantia das cotas
 */
export const runAutoLiquidation = async (pool: Pool): Promise<{ success: boolean; liquidatedCount: number }> => {
    try {
        // 1. Buscar empréstimos que estão atrasados há mais de 5 dias
        const overdueLoansRes = await pool.query(`
            SELECT id, user_id, total_repayment, amount as principal
            FROM loans 
            WHERE status = 'APPROVED' 
            AND due_date < NOW() - INTERVAL '5 days'
        `);

        const overdueLoans = overdueLoansRes.rows;
        let liquidatedCount = 0;

        for (const loan of overdueLoans) {
            await executeInTransaction(pool, async (client: PoolClient) => {
                // a. Calcular dívida restante
                const paidRes = await client.query(
                    'SELECT COALESCE(SUM(amount), 0) as total FROM loan_installments WHERE loan_id = $1',
                    [loan.id]
                );
                const debtAmount = parseFloat(loan.total_repayment) - parseFloat(paidRes.rows[0].total);

                if (debtAmount <= 0) return;

                // b. Buscar cotas ativas do usuário
                const quotasRes = await client.query(
                    'SELECT id, current_value FROM quotas WHERE user_id = $1 AND status = $2 FOR UPDATE',
                    [loan.user_id, 'ACTIVE']
                );
                const userQuotas = quotasRes.rows;

                let totalQuotasValue = 0;
                const quotasToLiquidate = [];

                for (const q of userQuotas) {
                    if (totalQuotasValue < debtAmount) {
                        totalQuotasValue += parseFloat(q.current_value);
                        quotasToLiquidate.push(q.id);
                    }
                }

                if (quotasToLiquidate.length > 0) {
                    // c. Liquidar as cotas
                    await client.query('DELETE FROM quotas WHERE id = ANY($1)', [quotasToLiquidate]);

                    // d. Devolver valor ao caixa do sistema (principal)
                    await client.query(
                        'UPDATE system_config SET system_balance = system_balance + $1',
                        [totalQuotasValue]
                    );

                    // e. Atualizar status do empréstimo
                    // Se as cotas cobriram tudo, PAID. Se não, continua OVERDUE mas com registro de liquidação.
                    const isFullyCleared = totalQuotasValue >= debtAmount;
                    const newStatus = isFullyCleared ? 'PAID' : 'OVERDUE';

                    await client.query(
                        'UPDATE loans SET status = $1, metadata = metadata || $2 WHERE id = $3',
                        [
                            newStatus,
                            JSON.stringify({
                                auto_liquidated: true,
                                liquidated_amount: totalQuotasValue,
                                liquidation_date: new Date().toISOString()
                            }),
                            loan.id
                        ]
                    );

                    // f. Penalidade Máxima no Score
                    await client.query(
                        'UPDATE users SET score = 0 WHERE id = $1',
                        [loan.user_id]
                    );

                    // g. Registrar transação de liquidação
                    await client.query(
                        `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
                         VALUES ($1, 'SYSTEM_LIQUIDATION', $2, $3, 'APPROVED', $4)`,
                        [
                            loan.user_id,
                            totalQuotasValue,
                            `AUTO-LIQUIDAÇÃO: Garantia de ${quotasToLiquidate.length} cota(s) executada por atraso.`,
                            JSON.stringify({ loanId: loan.id, quotasCount: quotasToLiquidate.length })
                        ]
                    );

                    liquidatedCount++;
                    console.log(`[AUTO-LIQUIDATION] Empréstimo ${loan.id} liquidado (Total: R$ ${totalQuotasValue})`);
                }
            });
        }

        return { success: true, liquidatedCount };
    } catch (error) {
        console.error('Erro na liquidação automática:', error);
        return { success: false, liquidatedCount: 0 };
    }
};
