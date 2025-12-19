
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { authMiddleware } from '../middleware/auth.middleware';
import { notificationService } from '../../../application/services/notification.service';

const notificationRoutes = new Hono();

/**
 * Endpoint para inscrição em notificações em tempo real (SSE)
 */
notificationRoutes.get('/stream', authMiddleware, async (c) => {
    const user = c.get('user');

    return streamSSE(c, async (stream) => {
        // Registrar o cliente no serviço
        const send = (data: any) => {
            stream.writeSSE({
                data: JSON.stringify(data),
                event: data.event || 'message',
                id: Date.now().toString(),
            });
        };

        notificationService.addClient(user.id, send);

        // Manter a conexão viva com um ping a cada 30 segundos
        const keepAlive = setInterval(() => {
            stream.writeSSE({ data: 'ping', event: 'ping' });
        }, 30000);

        // Limpeza ao fechar a conexão
        stream.onAbort(() => {
            notificationService.removeClient(user.id);
            clearInterval(keepAlive);
        });

        // Loop para manter o stream aberto
        while (true) {
            await stream.sleep(1000);
        }
    });
});

export { notificationRoutes };
