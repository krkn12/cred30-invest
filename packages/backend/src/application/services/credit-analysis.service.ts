
import { Pool, PoolClient } from 'pg';

/**
 * Serviço de Análise de Crédito (Estilo Nubank)
 * Calcula limites dinâmicos baseados no comportamento do usuário
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
        // Isso é o "investimento" do usuário que gera confiança
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

        // --- LÓGICA DE CÁLCULO (ESTILO NUBANK) ---

        // Se tiver dívida atrasada, limite é ZERO
        if (hasOverdue) return 0;

        // A. Limite Base por Score
        // 0 pontos = R$ 50
        // 1000 pontos = R$ 5.000
        const scoreLimit = (user.score || 0) * 5;

        // B. Alavancagem por Cotas (O Nubank ama quem investe)
        // Cada R$ 1 em cotas libera R$ 2 de limite extra
        const quotaMultiplier = 2.0;
        const assetsLimit = totalQuotasValue * quotaMultiplier;

        // C. Bônus por Fidelidade (Pagamentos em dia)
        // A cada empréstimo pago, o limite sobe 20%
        const fidelityBonus = 1 + (paidCount * 0.20);

        // D. Cálculo Final
        let totalLimit = (50 + scoreLimit + assetsLimit) * fidelityBonus;

        // E. Travas de Segurança (Anti-Fraude)
        // Usuário novo (menos de 100 pontos) não passa de R$ 300
        if (user.score < 100 && totalLimit > 300) {
            totalLimit = 300;
        }

        // Teto absoluto para evitar desequilíbrio no pool do sistema (Ex: 50k)
        const ABSOLUTE_MAX = 50000;
        if (totalLimit > ABSOLUTE_MAX) totalLimit = ABSOLUTE_MAX;

        return Math.floor(totalLimit);
    } catch (error) {
        console.error('Erro na análise de crédito:', error);
        return 50; // Retorna limite mínimo em caso de erro
    }
};
