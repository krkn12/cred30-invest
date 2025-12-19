
import { Context } from 'hono';

interface Client {
    id: string;
    send: (data: any) => void;
}

/**
 * Serviço de Gerenciamento de Notificações em Tempo Real (SSE)
 */
class NotificationService {
    private clients: Client[] = [];

    /**
     * Adiciona um novo cliente (conexão SSE) à lista
     */
    public addClient(userId: string, send: (data: any) => void) {
        this.clients.push({ id: userId, send });
        console.log(`🔌 Cliente conectado às notificações: ${userId} (Total: ${this.clients.length})`);
    }

    /**
     * Remove um cliente quando a conexão é fechada
     */
    public removeClient(userId: string) {
        this.clients = this.clients.filter(c => c.id !== userId);
        console.log(`🔌 Cliente desconectado: ${userId} (Total: ${this.clients.length})`);
    }

    /**
     * Envia uma notificação para um usuário específico
     */
    public notifyUser(userId: string, event: string, data: any) {
        const client = this.clients.find(c => c.id === userId);
        if (client) {
            client.send({ event, data });
            console.log(`🔔 Notificação enviada para ${userId}: ${event}`);
        }
    }

    /**
     * Envia uma notificação para todos os usuários conectados
     */
    public notifyAll(event: string, data: any) {
        this.clients.forEach(c => c.send({ event, data }));
        console.log(`🔔 Notificação global enviada: ${event}`);
    }
}

export const notificationService = new NotificationService();
