
/**
 * Serviço de Notificações Cred30
 * Gerencia o envio de alertas para usuários e administradores
 */
export const notificationService = {
    /**
     * Envia um alerta de sistema para o administrador
     */
    async notifyAdmin(message: string, type: 'ALERT' | 'INFO' | 'SUCCESS' = 'INFO') {
        const emoji = type === 'ALERT' ? '🚨' : type === 'SUCCESS' ? '✅' : 'ℹ️';
        console.log(`${emoji} [ADMIN NOTIFICATION]: ${message}`);

        // TODO: Integrar com Bot do Telegram ou WhatsApp API
        // Exemplo: await sendTelegramMessage(process.env.ADMIN_CHAT_ID, message);
    },

    /**
     * Envia uma notificação para um usuário específico
     */
    async notifyUser(userId: string, title: string, body: string) {
        console.log(`🔔 [USER NOTIFICATION] User: ${userId} | ${title}: ${body}`);

        // Futuramente integrar com Push Notifications ou Email
    },

    /**
     * Alerta sobre novo saque solicitado
     */
    async notifyNewWithdrawal(userName: string, amount: number) {
        const msg = `Novo saque solicitado!\nCliente: ${userName}\nValor: R$ ${amount.toFixed(2)}\n\nAcesse o painel para aprovar.`;
        await this.notifyAdmin(msg, 'ALERT');
    },

    /**
     * Alerta sobre lucro distribuído
     */
    async notifyProfitDistributed(totalAmount: number) {
        const msg = `Distribuição diária realizada com sucesso!\nTotal distribuído: R$ ${totalAmount.toFixed(2)}`;
        await this.notifyAdmin(msg, 'SUCCESS');
    }
};
