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
    VOTING_PARTICIPATION: 10, // Por voto em proposta de governança
};

export const SCORE_PENALTIES = {
    LATENESS: -50,            // Por atraso no pagamento
    LOAN_REJECTION: -10,      // Tentativa de empréstimo sem critério (opcional)
    DAILY_DECAY: -10          // Decaimento diário por inatividade/manutenção
};

/**
 * Aplica o decaimento diário de score para todos os usuários
 * Isso força o usuário a engajar (ver ads) para manter o score.
 */
export const decreaseDailyScore = async (pool: Pool): Promise<{ success: boolean; affectedUsers: number }> => {
    try {
        // Reduzir score de todos os usuários com score > 0
        // Decaimento de 10 pontos por dia
        const result = await pool.query(`
            UPDATE users 
            SET score = GREATEST(0, score - 10) 
            WHERE score > 0
        `);

        console.log(`[Score] Decaimento diário aplicado a ${result.rowCount} usuários (-10 pontos).`);
        return { success: true, affectedUsers: result.rowCount || 0 };
    } catch (error) {
        console.error('Erro ao aplicar decaimento de score:', error);
        return { success: false, affectedUsers: 0 };
    }
};
