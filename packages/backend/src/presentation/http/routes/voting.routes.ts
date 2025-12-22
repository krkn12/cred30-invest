import { Hono } from 'hono';
import { pool } from '../../../infrastructure/database/postgresql/connection/pool';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { updateScore, SCORE_REWARDS } from '../../../application/services/score.service';

export const votingRoutes = new Hono();

// 1. Criar Proposta (Admin Only)
votingRoutes.post('/proposal', adminMiddleware, async (c) => {
    const { title, description } = await c.req.json();

    if (!title || !description) {
        return c.json({ success: false, message: 'Título e descrição são obrigatórios.' }, 400);
    }

    try {
        const result = await pool.query(
            'INSERT INTO voting_proposals (title, description) VALUES ($1, $2) RETURNING *',
            [title, description]
        );
        return c.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// 2. Listar Propostas
votingRoutes.get('/proposals', authMiddleware, async (c) => {
    try {
        // Retorna propostas e se o usuário já votou
        const userId = c.get('user').id;
        const result = await pool.query(`
            SELECT p.*, v.vote as user_vote
            FROM voting_proposals p
            LEFT JOIN voting_votes v ON v.proposal_id = p.id AND v.user_id = $1
            ORDER BY p.created_at DESC
        `, [userId]);

        return c.json({ success: true, data: result.rows });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// 3. Votar
votingRoutes.post('/vote', authMiddleware, async (c) => {
    const { proposalId, vote } = await c.req.json(); // vote: 'YES' ou 'NO'
    const user = c.get('user');

    if (!['YES', 'NO'].includes(vote)) {
        return c.json({ success: false, message: 'Voto inválido. Use YES ou NO.' }, 400);
    }

    try {
        // Requisitos: 5 cotas + score alto (ex: >= 500)
        // Buscar dados atuais do usuário para garantir
        const userRes = await pool.query('SELECT score FROM users WHERE id = $1', [user.id]);
        const quotaRes = await pool.query('SELECT COUNT(*) as count FROM quotas WHERE user_id = $1 AND status = $2', [user.id, 'ACTIVE']);

        const userScore = userRes.rows[0].score;
        const quotaCount = parseInt(quotaRes.rows[0].count);

        if (quotaCount < 5) {
            return c.json({ success: false, message: 'Você precisa de pelo menos 5 licenças ativas para votar.' }, 403);
        }

        if (userScore < 500) {
            return c.json({ success: false, message: 'Seu score precisa ser de pelo menos 500 pontos para participar da governança.' }, 403);
        }

        // Verificar se proposta está aberta
        const propRes = await pool.query('SELECT status FROM voting_proposals WHERE id = $1', [proposalId]);
        if (propRes.rows.length === 0 || propRes.rows[0].status !== 'ACTIVE') {
            return c.json({ success: false, message: 'Esta proposta não está mais aberta para votação.' }, 400);
        }

        // Registrar voto (UNIQUE constraint evita voto duplo)
        // Guardamos o peso do voto (quotaCount) no momento da votação
        await pool.query(
            'INSERT INTO voting_votes (proposal_id, user_id, vote, weight) VALUES ($1, $2, $3, $4)',
            [proposalId, user.id, vote, quotaCount]
        );

        // Atualizar contagem na proposta usando o peso (número de cotas)
        if (vote === 'YES') {
            await pool.query('UPDATE voting_proposals SET yes_votes = yes_votes + $1 WHERE id = $2', [quotaCount, proposalId]);
        } else {
            await pool.query('UPDATE voting_proposals SET no_votes = no_votes + $1 WHERE id = $2', [quotaCount, proposalId]);
        }

        // Recompensa de Score
        await updateScore(pool, user.id, SCORE_REWARDS.VOTING_PARTICIPATION, `Participação na governança #${proposalId} com peso ${quotaCount}`);

        return c.json({ success: true, message: 'Voto registrado com sucesso! Você ganhou 10 pontos de score.' });
    } catch (error: any) {
        if (error.code === '23505') {
            return c.json({ success: false, message: 'Você já votou nesta proposta.' }, 400);
        }
        return c.json({ success: false, message: error.message }, 500);
    }
});

// 4. Fechar Proposta (Admin Only)
votingRoutes.post('/proposal/:id/close', adminMiddleware, async (c) => {
    const id = c.req.param('id');
    try {
        await pool.query('UPDATE voting_proposals SET status = $1, closed_at = CURRENT_TIMESTAMP WHERE id = $2', ['CLOSED', id]);
        return c.json({ success: true, message: 'Proposta encerrada com sucesso.' });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});
