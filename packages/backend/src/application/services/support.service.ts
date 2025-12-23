import { Pool, PoolClient } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ChatMessage {
    id?: number;
    chatId: number;
    senderId?: number | null;
    role: 'user' | 'assistant' | 'admin';
    content: string;
    createdAt?: Date;
}

export interface SupportChat {
    id: number;
    userId: number;
    status: 'AI_ONLY' | 'PENDING_HUMAN' | 'ACTIVE_HUMAN' | 'CLOSED';
    lastMessageAt: Date;
    createdAt: Date;
}

export class SupportService {
    async getOrCreateChat(pool: Pool | PoolClient, userId: number): Promise<SupportChat> {
        // Buscar chat ativo
        const chatResult = await pool.query(
            `SELECT * FROM support_chats WHERE user_id = $1 AND status != 'CLOSED' ORDER BY last_message_at DESC LIMIT 1`,
            [userId]
        );

        if (chatResult.rows.length > 0) {
            return {
                id: chatResult.rows[0].id,
                userId: chatResult.rows[0].user_id,
                status: chatResult.rows[0].status,
                lastMessageAt: chatResult.rows[0].last_message_at,
                createdAt: chatResult.rows[0].created_at
            };
        }

        // Criar novo chat
        const newChatResult = await pool.query(
            `INSERT INTO support_chats (user_id, status) VALUES ($1, 'AI_ONLY') RETURNING *`,
            [userId]
        );

        return {
            id: newChatResult.rows[0].id,
            userId: newChatResult.rows[0].user_id,
            status: newChatResult.rows[0].status,
            lastMessageAt: newChatResult.rows[0].last_message_at,
            createdAt: newChatResult.rows[0].created_at
        };
    }

    async getChatHistory(pool: Pool | PoolClient, chatId: number): Promise<ChatMessage[]> {
        const result = await pool.query(
            `SELECT * FROM support_messages WHERE chat_id = $1 ORDER BY created_at ASC`,
            [chatId]
        );

        return result.rows.map(row => ({
            id: row.id,
            chatId: row.chat_id,
            senderId: row.sender_id,
            role: row.role,
            content: row.content,
            createdAt: row.created_at
        }));
    }

    async addMessage(pool: Pool | PoolClient, chatId: number, role: 'user' | 'assistant' | 'admin', content: string, senderId?: number | null): Promise<ChatMessage> {
        const result = await pool.query(
            `INSERT INTO support_messages (chat_id, role, content, sender_id) VALUES ($1, $2, $3, $4) RETURNING *`,
            [chatId, role, content, senderId || null]
        );

        await pool.query(
            `UPDATE support_chats SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [chatId]
        );

        return {
            id: result.rows[0].id,
            chatId: result.rows[0].chat_id,
            senderId: result.rows[0].sender_id,
            role: result.rows[0].role,
            content: result.rows[0].content,
            createdAt: result.rows[0].created_at
        };
    }

    async escalateToHuman(pool: Pool | PoolClient, chatId: number): Promise<void> {
        await pool.query(
            `UPDATE support_chats SET status = 'PENDING_HUMAN' WHERE id = $1`,
            [chatId]
        );
    }

    async processAiResponse(pool: Pool | PoolClient, chatId: number, userMessage: string): Promise<string> {
        const lowerMessage = userMessage.toLowerCase();

        // 1. Verificação imediata de intenção de humano (hardcoded para velocidade e economia)
        if (lowerMessage.includes('falar com atendente') || lowerMessage.includes('humano') || lowerMessage.includes('pessoa') || lowerMessage.includes('suporte direto')) {
            await this.escalateToHuman(pool, chatId);
            return "Entendido. Vou encaminhar sua conversa para um atendente humano. Por favor, aguarde um momento que logo alguém irá falar com você.";
        }

        // 2. Tentar usar Gemini AI (Se houver chave configurada)
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-pro" });

                const prompt = `
                    Você é o Edy, o assistente virtual da Cred30, um clube de benefícios de apoio mútuo.
                    Sua persona: Homem brasileiro do norte, ético, amigável, profissional e direto. Use gírias leves da região norte se couber, mas mantenha o profissionalismo.
                    
                    Informações Chave do Cred30:
                    - Participações: Custam R$ 50,00. Representam adesão ao clube e geram excedentes operacionais.
                    - Mercado Cred30: Compra e venda de produtos entre membros.
                      * Para Comprar: Use Saldo ou Crediário Social (parcelado no boleto, sujeito a Score).
                      * Para Vender: Taxa de 5% sobre a venda. O valor fica retido (Escrow) até o comprador confirmar o recebimento.
                      * Segurança: Só liberamos o dinheiro ao vendedor quando o comprador confirma que recebeu o produto.
                    - Distribuição de Sobras: Apenas para membros ATIVOS que interagem com o App (login, tarefas). Quem não usa o App, não recebe sobras.
                    - Resgates de Cotas: Carência de 1 ano para resgate integral. Se sacar antes, paga multa de 40%.
                    - Apoio Mútuo: Recurso baseado no score e participações. Taxa de sustentabilidade de 20%. Pagamento em até 12x. Não requer consulta ao SPC/Serasa, pois é baseado na confiança da comunidade (Score).
                    - Saques: Via PIX do saldo disponível. Taxa Zero se tiver cotas equivalentes ao saque.
                    - Score: Pontos ganhos por pagar em dia, assistir vídeos e completar tarefas. Aumenta limite de apoio.
                    - Jogos/Vídeos: Formas de ganhar saldo extra e score assistindo anúncios.
                    - Indicação: Ganhe saldo por indicar amigos. O valor cai direto no seu Saldo Pessoal, mesmo que não tenha dinheiro no caixa do sistema (excedentes).
                    
                    Instruções:
                    1. Responda à dúvida do usuário de forma concisa e útil (máximo 4 frases).
                    2. Se o usuário pedir atendimento humano ou se você não souber a resposta com certeza absoluta, responda APENAS A STRING: "ESCALATE_TO_HUMAN".
                    3. Nunca invente taxas ou regras não listadas acima.
                    
                    Usuário: "${userMessage}"
                `;

                const result = await model.generateContent(prompt);
                const response = result.response.text();

                if (response.includes("ESCALATE_TO_HUMAN")) {
                    await this.escalateToHuman(pool, chatId);
                    return "Compreendo. Essa questão requer um especialista. Estou chamando um atendente humano para te ajudar. Aguarde um instante.";
                }

                return response;

            } catch (error) {
                console.error("Erro na Gemini AI:", error);
                // Continua para o fallback se a API falhar
            }
        }

        // 3. Fallback (Lógica antiga de palavras-chave)
        let response = "";
        if (lowerMessage.includes('cota') || lowerMessage.includes('aporte')) {
            response = "As cotas do Cred30 custam R$ 50,00 cada. Elas representam sua participação na cooperativa e geram excedentes operacionais baseados na produtividade da comunidade.";
        } else if (lowerMessage.includes('apoio') || lowerMessage.includes('empréstimo')) {
            response = "O apoio mútuo é um crédito baseado no seu score e nas suas cotas. A taxa de sustentabilidade é de 20% e você pode pagar em até 12 parcelas.";
        } else if (lowerMessage.includes('saque')) {
            response = "Os saques podem ser feitos via PIX do seu saldo disponível. Se você tiver cotas em valor igual ou superior ao saque, a taxa é Zero!";
        } else if (lowerMessage.includes('oi') || lowerMessage.includes('olá') || lowerMessage.includes('bom dia')) {
            response = "Olá! Sou o Edy, seu assistente virtual do Cred30. Como posso ajudar você hoje? Posso explicar sobre participações, apoios mútuos e saques.";
        } else {
            response = "Ainda estou aprendendo. Gostaria de falar com um atendente humano? Se sim, clique no botão 'Falar com Atendente' acima.";
        }

        return response;
    }

    async getPendingHumanChats(pool: Pool | PoolClient): Promise<any[]> {
        const result = await pool.query(
            `SELECT c.*, u.name as user_name, u.email as user_email 
             FROM support_chats c
             JOIN users u ON c.user_id = u.id
             WHERE c.status IN ('PENDING_HUMAN', 'ACTIVE_HUMAN')
             ORDER BY c.last_message_at DESC`
        );
        return result.rows;
    }

    async respondAsAdmin(pool: Pool | PoolClient, chatId: number, adminId: number, content: string): Promise<ChatMessage> {
        // Mudar status para ACTIVE_HUMAN se estava PENDING
        await pool.query(
            `UPDATE support_chats SET status = 'ACTIVE_HUMAN' WHERE id = $1 AND status = 'PENDING_HUMAN'`,
            [chatId]
        );

        return this.addMessage(pool, chatId, 'admin', content, adminId);
    }
    async closeChat(pool: Pool | PoolClient, chatId: number, adminId: number): Promise<void> {
        await pool.query(
            "UPDATE support_chats SET status = 'CLOSED' WHERE id = $1",
            [chatId]
        );

        // Mensagem final do sistema
        await this.addMessage(pool, chatId, 'assistant', 'Atendimento encerrado pelo agente. Por favor, avalie nosso atendimento.', null);
    }

    async getClosedChatsWithFeedback(pool: Pool | PoolClient): Promise<any[]> {
        const result = await pool.query(
            `SELECT c.*, u.name as user_name, u.email as user_email 
             FROM support_chats c
             JOIN users u ON c.user_id = u.id
             WHERE c.status = 'CLOSED' AND c.rating IS NOT NULL
             ORDER BY c.last_message_at DESC`
        );
        return result.rows;
    }
}

export const supportService = new SupportService();
