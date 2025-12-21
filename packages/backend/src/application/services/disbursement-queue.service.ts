
import { Pool, PoolClient } from 'pg';
import { calculateUserLoanLimit } from './credit-analysis.service';
import { executeInTransaction, processLoanApproval } from '../../domain/services/transaction.service';

/**
 * Serviço de Fila de Desembolso
 * Processa solicitações de apoio mútuo pendentes baseando-se na liquidez real e prioridade (Cotas > Score)
 */
export const processDisbursementQueue = async (pool: Pool): Promise<{ processed: number; errors: number }> => {
    let processed = 0;
    let errors = 0;

    try {
        console.log('🕒 [DISBURSEMENT] Iniciando processamento da fila de prioridade...');

        // 1. Buscar todos os empréstimos pendentes com a prioridade (Cotas > Score > Data)
        // Usamos uma query similar à do admin para garantir consistência
        const query = `
            SELECT l.id, l.amount, l.user_id,
                   (SELECT COUNT(*) FROM quotas q WHERE q.user_id = l.user_id AND q.status = 'ACTIVE') as user_quotas,
                   u.score as user_score
            FROM loans l
            INNER JOIN users u ON l.user_id = u.id
            WHERE l.status = 'PENDING'
            ORDER BY user_quotas DESC, user_score DESC, l.created_at ASC
        `;

        const result = await pool.query(query);
        const pendingLoans = result.rows;

        // 2. Buscar estatísticas globais do sistema UMA VEZ antes do loop
        const systemStatsRes = await pool.query(`
            SELECT 
                (SELECT COUNT(*)::int FROM quotas WHERE status = 'ACTIVE') as quotas_count,
                (SELECT COALESCE(SUM(amount), 0)::float FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')) as total_loaned
        `);

        const systemQuotasCount = systemStatsRes.rows[0].quotas_count;
        let systemTotalLoaned = systemStatsRes.rows[0].total_loaned;
        const grossCash = systemQuotasCount * 50; // QUOTA_PRICE = 50
        const liquidityReserve = grossCash * 0.30;

        // 3. Processar cada solicitação conforme a liquidez disponível
        for (const loan of pendingLoans) {
            try {
                // Cálculo de liquidez em memória para evitar queries repetitivas
                const operationalCash = grossCash - systemTotalLoaned - liquidityReserve;

                // Buscar dados específicos do usuário (Limite pessoal)
                // Nota: calculateUserLoanLimit ainda faz suas próprias queries, 
                // mas agora o sistema tem uma trava de memória externa mais rápida.
                const availableLimit = await calculateUserLoanLimit(pool, loan.user_id);

                // Buscar dívidas ativas atuais para este usuário
                const activeLoansResult = await pool.query(
                    "SELECT COALESCE(SUM(amount), 0) as total FROM loans WHERE user_id = $1 AND status IN ('APPROVED', 'PAYMENT_PENDING')",
                    [loan.user_id]
                );
                const currentDebt = parseFloat(activeLoansResult.rows[0].total);
                const realAvailablePersonal = availableLimit - currentDebt;

                // O limite real é o menor entre o pessoal e o operacional do sistema
                const realAvailable = Math.min(realAvailablePersonal, operationalCash);

                // Se o sistema tem caixa e o usuário tem limite pessoal para cobrir ESTE pedido
                if (parseFloat(loan.amount) <= realAvailable && realAvailable > 0) {
                    console.log(`✅ [DISBURSEMENT] Liquidez confirmada para Loan ${loan.id} (User: ${loan.user_id}). Processando aprovação automática...`);

                    const approvalResult = await executeInTransaction(pool, async (client: PoolClient) => {
                        return await processLoanApproval(client, loan.id, 'APPROVE');
                    });

                    if (approvalResult.success) {
                        processed++;
                        // Atualizar liquidez em memória para o próximo item da fila
                        systemTotalLoaned += parseFloat(loan.amount);
                    } else {
                        console.error(`❌ [DISBURSEMENT] Erro ao processar aprovação do Loan ${loan.id}:`, approvalResult.error);
                        errors++;
                    }
                } else {
                    console.log(`⏳ [DISBURSEMENT] Pulando Loan ${loan.id}: Liquidez insuficiente (Operacional: R$ ${operationalCash.toFixed(2)}, Pessoal: R$ ${realAvailablePersonal.toFixed(2)}).`);
                }
            } catch (err) {
                console.error(`❌ [DISBURSEMENT] Erro crítico no item ${loan.id} da fila:`, err);
                errors++;
            }
        }


        console.log(`🏁 [DISBURSEMENT] Processamento finalizado. Aprovados: ${processed}, Erros/Pulados: ${errors}`);
        return { processed, errors };
    } catch (error) {
        console.error('❌ [DISBURSEMENT] Erro fatal ao buscar fila de desembolso:', error);
        return { processed: 0, errors: 1 };
    }
};
