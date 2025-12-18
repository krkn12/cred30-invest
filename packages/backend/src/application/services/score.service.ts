import { Pool, PoolClient } from 'pg';

/**
 * Atualiza o score de crédito do usuário
 * @param pool Conexão com o banco
 * @param userId ID do usuário
 * @param points Pontos a adicionar (positivo) ou remover (negativo)
 * @param reason Motivo da atualização
 */
export const updateScore = async (
    pool: Pool | PoolClient,
    userId: string | number,
    points: number,
    reason: string
) => {
    try {
        // Garantir que o score não seja negativo (opcional, mas recomendado)
        await pool.query(
            'UPDATE users SET score = GREATEST(0, score + $1) WHERE id = $2',
            [points, userId]
        );

        console.log(`[Score] Usuário ${userId}: ${points > 0 ? '+' : ''}${points} pontos. Motivo: ${reason}`);

        // No futuro: Registrar histórico de score em uma tabela separada
    } catch (error) {
        console.error('Erro ao atualizar score:', error);
    }
};

// Constantes de Pontuação
export const SCORE_REWARDS = {
    QUOTA_PURCHASE: 10,       // Por cota comprada
    LOAN_PAYMENT_ON_TIME: 25, // Por parcela paga em dia
    GAME_PARTICIPATION: 2,    // Por lote de giros/participação
    RELIABLE_MEMBER: 50,      // Bônus mensal para membros sem pendências (pode ser usado em scheduler)
};

export const SCORE_PENALTIES = {
    LATENESS: -50,            // Por atraso no pagamento
    LOAN_REJECTION: -10,      // Tentativa de empréstimo sem critério (opcional)
};
