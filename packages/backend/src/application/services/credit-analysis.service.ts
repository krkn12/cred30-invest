
import { Pool, PoolClient } from 'pg';
import { QUOTA_PRICE, VIP_LEVELS } from '../../shared/constants/business.constants';

/**
 * Serviço de Análise de Crédito (Estilo Nubank)
 * Calcula limites dinâmicos baseados no comportamento do usuário E na disponibilidade do caixa
 */
export const calculateUserLoanLimit = async (pool: Pool | PoolClient, userId: string): Promise<number> => {
    try {
        // 1. Dados base do usuário (Score e Tempo de conta)
        const userRes = await pool.query(
            'SELECT score, created_at FROM users WHERE id = $1',
            [userId]
        );
        if (userRes.rows.length === 0) return 0;
        const user = userRes.rows[0];

        // 2. Patrimônio no sistema (Cotas ATIVAS)
        const quotasRes = await pool.query(
            "SELECT COALESCE(SUM(current_value), 0) as total FROM quotas WHERE user_id = $1 AND status = 'ACTIVE'",
            [userId]
        );
        const totalQuotasValue = parseFloat(quotasRes.rows[0].total);

        // 3. Histórico de Pagamentos
        const loansRes = await pool.query(
            `SELECT 
                COUNT(*) as total_requests,
                COUNT(*) FILTER (WHERE status = 'PAID') as paid_loans,
                COUNT(*) FILTER (WHERE status = 'APPROVED' AND due_date < NOW()) as overdue_loans
             FROM loans WHERE user_id = $1`,
            [userId]
        );
        const stats = loansRes.rows[0];
        const hasOverdue = parseInt(stats.overdue_loans) > 0;
        const paidCount = parseInt(stats.paid_loans);

        // 4. CAIXA OPERACIONAL DISPONÍVEL (Nova Trava)
        // Caixa Bruto = (Total de Cotas ATIVAS * QUOTA_PRICE)
        // Emprestado = (Total Emprestado Ativo)
        // Reserva Liquidez = 30% do Caixa Bruto (Sempre mantido para saques de cotas)
        const systemQuotasRes = await pool.query(
            "SELECT COUNT(*) as count FROM quotas WHERE status = 'ACTIVE'"
        );
        const systemActiveLoansRes = await pool.query(
            "SELECT COALESCE(SUM(amount), 0) as total FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')"
        );
        const systemQuotasCount = parseInt(systemQuotasRes.rows[0].count);
        const systemTotalLoaned = parseFloat(systemActiveLoansRes.rows[0].total);

        const grossCash = systemQuotasCount * QUOTA_PRICE;
        const liquidityReserve = grossCash * 0.30; // 30% de reserva para saques
        const operationalCash = grossCash - systemTotalLoaned - liquidityReserve;

        // --- LÓGICA DE CÁLCULO (ESTILO NUBANK) ---

        // Se tiver dívida atrasada, limite é ZERO
        if (hasOverdue) return 0;

        // TRAVA: Só empresta para quem tem cotas ATIVAS no sistema
        if (totalQuotasValue <= 0) {
            console.log(`DEBUG - Limite zero para usuário ${userId}: Sem cotas ativas.`);
            return 0;
        }

        // A. Limite Base por Score
        const scoreLimit = (user.score || 0) * 5;

        // B. Alavancagem por Cotas Dinâmica (VIP)
        let quotaMultiplier = VIP_LEVELS.BRONZE.multiplier;
        const qCount = totalQuotasValue / QUOTA_PRICE;

        if (qCount >= 100) quotaMultiplier = VIP_LEVELS.FOUNDER.multiplier;
        else if (qCount >= 50) quotaMultiplier = VIP_LEVELS.OURO.multiplier;
        else if (qCount >= 10) quotaMultiplier = VIP_LEVELS.PRATA.multiplier;

        const assetsLimit = totalQuotasValue * quotaMultiplier;

        // C. Bônus por Fidelidade
        const fidelityBonus = 1 + (paidCount * 0.20);

        // D. Cálculo do Limite Pessoal
        let personalLimit = (50 + scoreLimit + assetsLimit) * fidelityBonus;

        // E. Travas de Segurança (Anti-Fraude)
        if (user.score < 100 && personalLimit > 300) {
            personalLimit = 300;
        }

        const ABSOLUTE_MAX = 50000;
        if (personalLimit > ABSOLUTE_MAX) personalLimit = ABSOLUTE_MAX;

        // F. TRAVA CRÍTICA: O limite final é o MENOR entre:
        //    - O limite pessoal do usuário
        //    - O dinheiro disponível no caixa operacional do sistema (respeitando a reserva de 30%)
        const finalLimit = Math.min(Math.floor(personalLimit), Math.max(0, operationalCash));

        console.log('DEBUG - Análise de Crédito:', {
            userId,
            scoreLimit,
            assetsLimit,
            fidelityBonus,
            personalLimit,
            operationalCash,
            finalLimit
        });

        return finalLimit;
    } catch (error) {
        console.error('Erro na análise de crédito:', error);
        return 0; // Retorna zero em caso de erro (segurança)
    }
};
