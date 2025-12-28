import { Hono } from 'hono';
import { PoolClient } from 'pg';
import crypto from 'crypto';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { checkPaymentStatus } from '../../../infrastructure/gateways/asaas.service';
import { executeInTransaction, processTransactionApproval } from '../../../domain/services/transaction.service';
import { logWebhook, updateWebhookStatus } from '../../../application/services/audit.service';
import { VIDEO_QUOTA_HOLDERS_SHARE, VIDEO_SERVICE_FEE_SHARE, VIDEO_VIEWER_SHARE } from '../../../shared/constants/business.constants';

const webhookRoutes = new Hono();

// Webhook do Asaas
webhookRoutes.post('/asaas', async (c) => {
    const pool = getDbPool(c);
    let webhookLogId: number | null = null;

    try {
        const body = await c.req.json();

        // 1. Persistir Webhook IMEDIATAMENTE (Segurança contra queda de servidor)
        webhookLogId = await logWebhook(pool, 'asaas', body);

        // Asaas envia um token de autenticação no header
        const asaasAccessToken = c.req.header('asaas-access-token');
        const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;

        console.log(`[WEBHOOK ASAAS] Recebido (ID Log: ${webhookLogId}):`, JSON.stringify(body));

        // Validação de Token (opcional, mas recomendado)
        if (expectedToken && asaasAccessToken !== expectedToken) {
            console.error('[WEBHOOK ASAAS] Token Inválido!');
            if (webhookLogId) await updateWebhookStatus(pool, webhookLogId, 'FAILED', 'Invalid Token');
            return c.json({ success: false, message: 'Invalid token' }, 401);
        }

        // Asaas envia eventos com a estrutura: { event: "PAYMENT_RECEIVED", payment: { id, status, ... } }
        const event = body.event;
        const payment = body.payment;

        if (!payment) {
            console.log('[WEBHOOK ASAAS] Payload sem payment:', body);
            if (webhookLogId) await updateWebhookStatus(pool, webhookLogId, 'COMPLETED', 'No payment in payload');
            return c.json({ success: true });
        }

        const paymentId = payment.id;
        const status = payment.status;

        console.log(`[WEBHOOK ASAAS] Event: ${event}, PaymentId: ${paymentId}, Status: ${status}`);

        // Eventos de sucesso no Asaas
        const successStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];

        if (successStatuses.includes(status)) {
            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                // Buscar transação pelo ID do Asaas (salvo em metadata)
                const txResult = await client.query(
                    "SELECT id FROM transactions WHERE metadata->>'asaas_id' = $1 AND status = 'PENDING'",
                    [paymentId]
                );

                if (txResult.rows.length > 0) {
                    const transactionId = txResult.rows[0].id;
                    await processTransactionApproval(client, transactionId, 'APPROVE');
                    return { processed: true, transactionId };
                }

                // Tentar buscar pelo external_reference também
                const externalRef = payment.externalReference;
                if (externalRef) {
                    // NOVO: Verificar se é um vídeo promocional (PROMO_userId_timestamp)
                    if (externalRef.startsWith('PROMO_')) {
                        const parts = externalRef.split('_');
                        const userId = parts[1];

                        // Ativar o vídeo promocional mais recente desse usuário que está PENDING
                        const promoResult = await client.query(
                            `UPDATE promo_videos 
                             SET status = 'ACTIVE', is_active = TRUE, is_approved = TRUE
                             WHERE id = (
                                 SELECT id FROM promo_videos 
                                 WHERE user_id = $1 AND status = 'PENDING'
                                 ORDER BY created_at DESC
                                 LIMIT 1
                             )
                             RETURNING id, title`,
                            [userId]
                        );

                        if (promoResult.rows.length > 0) {
                            const promo = promoResult.rows[0];
                            const budget = parseFloat(promo.budget_gross); // Usar o valor bruto pago

                            const quotaShare = budget * VIDEO_QUOTA_HOLDERS_SHARE;
                            const systemAndViewerShare = budget * (VIDEO_SERVICE_FEE_SHARE + VIDEO_VIEWER_SHARE);

                            await client.query(
                                'UPDATE system_config SET profit_pool = profit_pool + $1, system_balance = system_balance + $2',
                                [quotaShare, systemAndViewerShare]
                            );

                            console.log(`[WEBHOOK ASAAS] Vídeo promocional ativado: ${promo.title} (ID: ${promo.id}). Financeiro distribuído: Pool +R$${quotaShare.toFixed(2)}, System +R$${systemAndViewerShare.toFixed(2)}`);
                            return { processed: true, promoVideoId: promo.id };
                        }
                    }

                    const txByRefResult = await client.query(
                        "SELECT id FROM transactions WHERE metadata->>'external_reference' = $1 AND status = 'PENDING'",
                        [externalRef]
                    );

                    if (txByRefResult.rows.length > 0) {
                        const transactionId = txByRefResult.rows[0].id;
                        await processTransactionApproval(client, transactionId, 'APPROVE');
                        return { processed: true, transactionId };
                    }
                }

                // Atualizar metadata mesmo se não encontrar transação pendente
                await client.query(
                    "UPDATE transactions SET metadata = metadata || jsonb_build_object('asaas_status', $1) WHERE metadata->>'asaas_id' = $2",
                    [status, paymentId]
                );
                return { processed: false };
            });

            if (webhookLogId && result.success) {
                await updateWebhookStatus(pool, webhookLogId, 'COMPLETED');
            }
        } else {
            // Pagamento não aprovado ainda (ex: PENDING, OVERDUE), apenas logamos o status
            if (webhookLogId) await updateWebhookStatus(pool, webhookLogId, 'COMPLETED', `Status: ${status}`);
        }

        return c.json({ success: true });
    } catch (error: any) {
        console.error('[WEBHOOK ASAAS] Erro:', error);
        if (webhookLogId) await updateWebhookStatus(pool, webhookLogId, 'FAILED', error.message);
        return c.json({ success: false, error: error.message }, 200);
    }
});

// Manter webhook do Mercado Pago para compatibilidade (transições)
webhookRoutes.post('/mercadopago', async (c) => {
    console.log('[WEBHOOK MP] Recebido mas gateway migrado para Asaas');
    return c.json({ success: true, message: 'Gateway migrado para Asaas' });
});

// Webhook de transferências (payouts) do Asaas
webhookRoutes.post('/asaas/transfer', async (c) => {
    const pool = getDbPool(c);

    try {
        const body = await c.req.json();
        console.log('[WEBHOOK ASAAS TRANSFER] Recebido:', JSON.stringify(body));

        const transfer = body.transfer;
        if (!transfer) {
            return c.json({ success: true, message: 'No transfer in payload' });
        }

        // Atualizar status do payout na transação correspondente
        if (transfer.status === 'DONE' || transfer.status === 'CONFIRMED') {
            await pool.query(
                "UPDATE transactions SET payout_status = 'PAID', metadata = metadata || jsonb_build_object('asaas_transfer_status', $1) WHERE metadata->>'asaas_transfer_id' = $2",
                [transfer.status, transfer.id]
            );
        }

        return c.json({ success: true });
    } catch (error: any) {
        console.error('[WEBHOOK ASAAS TRANSFER] Erro:', error);
        return c.json({ success: false, error: error.message }, 200);
    }
});

export { webhookRoutes };
