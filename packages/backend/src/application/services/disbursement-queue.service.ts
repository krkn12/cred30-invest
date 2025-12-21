
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

        if (pendingLoans.length === 0) {
            return { processed: 0, errors: 0 };
        }

        // 2. Processar cada solicitação conforme a liquidez disponível
        for (const loan of pendingLoans) {
            try {
                // Verificar liquidez atual do sistema para este empréstimo específico
                const availableLimit = await calculateUserLoanLimit(pool, loan.user_id);

                // Buscar dívidas ativas atuais para este usuário
                const activeLoansResult = await pool.query(
                    "SELECT COALESCE(SUM(amount), 0) as total FROM loans WHERE user_id = $1 AND status IN ('APPROVED', 'PAYMENT_PENDING')",
                    [loan.user_id]
                );
                const currentDebt = parseFloat(activeLoansResult.rows[0].total);
                const realAvailable = availableLimit - currentDebt;

                // Se o sistema tem caixa e o usuário tem limite pessoal para cobrir ESTE pedido
                if (parseFloat(loan.amount) <= realAvailable) {
                    console.log(`✅ [DISBURSEMENT] Liquidez confirmada para Loan ${loan.id} (User: ${loan.user_id}). Processando aprovação automática...`);

                    const approvalResult = await executeInTransaction(pool, async (client: PoolClient) => {
                        return await processLoanApproval(client, loan.id, 'APPROVE');
                    });

                    if (approvalResult.success) {
                        processed++;
                    } else {
                        console.error(`❌ [DISBURSEMENT] Erro ao processar aprovação do Loan ${loan.id}:`, approvalResult.error);
                        errors++;
                    }
                } else {
                    console.log(`⏳ [DISBURSEMENT] Pulando Loan ${loan.id}: Liquidez insuficiente no caixa para esta prioridade no momento.`);
                    // Como a fila é por prioridade, se este não cabe, os abaixo (com menos cotas/score) 
                    // podem caber se forem valores menores, ou o sistema decide parar aqui para não quebrar a ordem.
                    // Vamos continuar tentando os próximos, pois um usuário VIP pode ter pedido 10k e não ter caixa, 
                    // mas um usuário Bronze pediu 50 reais e tem caixa.
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
