import { Hono } from 'hono';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { supportService } from '../../../application/services/support.service';

const supportRoutes = new Hono();

// Listar histórico de chat do usuário
supportRoutes.get('/history', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);

        const chat = await supportService.getOrCreateChat(pool, user.id);
        const messages = await supportService.getChatHistory(pool, chat.id);

        return c.json({
            success: true,
            data: {
                chat,
                messages
            }
        });
    } catch (error: any) {
        console.error('Erro ao buscar histórico de chat:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

// Enviar mensagem do usuário
supportRoutes.post('/message', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);
        const { content } = await c.req.json();

        if (!content || content.trim() === '') {
            return c.json({ success: false, message: 'Conteúdo da mensagem é obrigatório' }, 400);
        }

        const chat = await supportService.getOrCreateChat(pool, user.id);

        // Adicionar mensagem do usuário
        const userMsg = await supportService.addMessage(pool, chat.id, 'user', content, user.id);

        // Se o chat for AI_ONLY, gerar resposta da IA
        let aiMsg = null;
        if (chat.status === 'AI_ONLY') {
            const aiResponseContent = await supportService.processAiResponse(pool, chat.id, content);
            aiMsg = await supportService.addMessage(pool, chat.id, 'assistant', aiResponseContent, null);
        } else if (chat.status === 'PENDING_HUMAN') {
            const lowerContent = content.toLowerCase();
            if (lowerContent.includes('cancelar') || lowerContent.includes('voltar')) {
                // User wants to go back to AI
                await pool.query("UPDATE support_chats SET status = 'AI_ONLY' WHERE id = $1", [chat.id]);
                aiMsg = await supportService.addMessage(pool, chat.id, 'assistant', "Atendimento humano cancelado. Voltei! Como posso ajudar você hoje?", null);
            } else {
                // Remind user they are waiting
                // Only send reminder if the last message wasn't already a reminder (to avoid spam loop? Hard to check quickly, just send for now)
                aiMsg = await supportService.addMessage(pool, chat.id, 'assistant', "Sua solicitação foi enviada para nossos atendentes. Por favor, aguarde um momento. \n\nPara cancelar e voltar a falar com o Edy, digite 'cancelar'.", null);
            }
        }

        return c.json({
            success: true,
            data: {
                userMessage: userMsg,
                aiMessage: aiMsg,
                chatStatus: (await supportService.getOrCreateChat(pool, user.id)).status
            }
        });
    } catch (error: any) {
        console.error('Erro ao enviar mensagem:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

// ESCALONAMENTO MANUAL (Botão "Falar com Atendente")
supportRoutes.post('/escalate', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);

        const chat = await supportService.getOrCreateChat(pool, user.id);
        await supportService.escalateToHuman(pool, chat.id);

        return c.json({
            success: true,
            message: 'Solicitação de atendimento humano enviada!'
        });
    } catch (error: any) {
        console.error('Erro ao escalonar atendimento:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

// --- ROTAS DE ADMIN ---

// Listar chats pendentes (Admin)
supportRoutes.get('/admin/pending', authMiddleware, adminMiddleware, async (c) => {
    try {
        const pool = getDbPool(c);
        const chats = await supportService.getPendingHumanChats(pool);

        return c.json({
            success: true,
            data: { chats }
        });
    } catch (error: any) {
        console.error('Erro ao listar chats pendentes:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

// Buscar mensagens de um chat específico (Admin)
supportRoutes.get('/admin/chat/:id', authMiddleware, adminMiddleware, async (c) => {
    try {
        const pool = getDbPool(c);
        const chatId = parseInt(c.req.param('id'));
        const messages = await supportService.getChatHistory(pool, chatId);

        return c.json({
            success: true,
            data: { messages }
        });
    } catch (error: any) {
        console.error('Erro ao buscar mensagens do chat:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

// Responder como Admin
supportRoutes.post('/admin/respond', authMiddleware, adminMiddleware, async (c) => {
    try {
        const admin = c.get('user') as any;
        const pool = getDbPool(c);
        const { chatId, content } = await c.req.json();

        if (!chatId || !content) {
            return c.json({ success: false, message: 'ChatId e conteúdo são obrigatórios' }, 400);
        }

        const message = await supportService.respondAsAdmin(pool, chatId, admin.id, content);

        return c.json({
            success: true,
            data: { message }
        });
    } catch (error: any) {
        console.error('Erro ao responder como admin:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});
// Fechar chat (Admin)
supportRoutes.post('/admin/close', authMiddleware, adminMiddleware, async (c) => {
    try {
        const admin = c.get('user') as any;
        const pool = getDbPool(c);
        const { chatId } = await c.req.json();

        if (!chatId) {
            return c.json({ success: false, message: 'ChatId é obrigatório' }, 400);
        }

        await supportService.closeChat(pool, chatId, admin.id);

        return c.json({
            success: true,
            message: 'Chat encerrado com sucesso'
        });
    } catch (error: any) {
        console.error('Erro ao encerrar chat:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

// Enviar feedback (Usuário)
supportRoutes.post('/feedback', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);
        const { chatId, rating, comment } = await c.req.json();

        if (!chatId || !rating) {
            return c.json({ success: false, message: 'ChatId e nota são obrigatórios' }, 400);
        }

        // Atualizar chat com feedback
        await pool.query(
            'UPDATE support_chats SET rating = $1, feedback_comment = $2 WHERE id = $3 AND user_id = $4',
            [rating, comment || null, chatId, user.id]
        );

        return c.json({
            success: true,
            message: 'Feedback enviado com sucesso!'
        });
    } catch (error: any) {
        console.error('Erro ao enviar feedback:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

// Listar feedbacks (Admin)
supportRoutes.get('/admin/feedback', authMiddleware, adminMiddleware, async (c) => {
    try {
        const pool = getDbPool(c);
        const feedbacks = await supportService.getClosedChatsWithFeedback(pool);

        return c.json({
            success: true,
            data: { feedbacks }
        });
    } catch (error: any) {
        console.error('Erro ao buscar feedbacks:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

export { supportRoutes };
