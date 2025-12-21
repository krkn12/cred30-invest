
import { Pool, PoolClient } from 'pg';
import { QUOTA_PRICE, VIP_LEVELS } from '../../shared/constants/business.constants';

/**
 * Serviço de Análise de Crédito (Estilo Nubank)
 * Calcula limites dinâmicos baseados no comportamento do usuário E na disponibilidade do caixa
 */
export const calculateUserLoanLimit = async (pool: Pool | PoolClient, userId: string): Promise<number> => {
    try {
        // 1, 2 e 3. Dados consolidados do usuário (Score, Cotas e Histórico)
        // Redução de 3 queries para 1
        const userDataRes = await pool.query(`
            SELECT 
                u.score, u.created_at,
                (SELECT COALESCE(SUM(current_value), 0) FROM quotas WHERE user_id = $1 AND status = 'ACTIVE') as total_quotas_value,
                (SELECT COUNT(*) FROM loans WHERE user_id = $1) as total_requests,
                (SELECT COUNT(*) FROM loans WHERE user_id = $1 AND status = 'PAID') as paid_loans,
                (SELECT COUNT(*) FROM loans WHERE user_id = $1 AND status = 'APPROVED' AND due_date < NOW()) as overdue_loans
            FROM users u
            WHERE u.id = $1
        `, [userId]);

        if (userDataRes.rows.length === 0) return 0;
        const userData = userDataRes.rows[0];

        const user = { score: userData.score, created_at: userData.created_at };
        const totalQuotasValue = parseFloat(userData.total_quotas_value);
        const hasOverdue = parseInt(userData.overdue_loans) > 0;
        const paidCount = parseInt(userData.paid_loans);

        // 4. CAIXA OPERACIONAL DISPONÍVEL (Consolidado)
        // Redução de 2 queries para 1
        const systemStatsRes = await pool.query(`
            SELECT 
                (SELECT COUNT(*)::int FROM quotas WHERE status = 'ACTIVE') as quotas_count,
                (SELECT COALESCE(SUM(amount), 0)::float FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')) as total_loaned
        `);

        const systemQuotasCount = systemStatsRes.rows[0].quotas_count;
        const systemTotalLoaned = systemStatsRes.rows[0].total_loaned;


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

        // A. Limite Base por Score (Multiplicador Dinâmico por Confiança)
        let scoreMultiplier = 2; // Base conservadora
        if (user.score >= 700) scoreMultiplier = 5;
        else if (user.score >= 500) scoreMultiplier = 3.5;

        const scoreLimit = (user.score || 0) * scoreMultiplier;

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
