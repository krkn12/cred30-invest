import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { MARKETPLACE_ESCROW_FEE_RATE, MARKET_CREDIT_INTEREST_RATE, MARKET_CREDIT_MAX_INSTALLMENTS, MARKET_CREDIT_MIN_SCORE } from '../../../shared/constants/business.constants';
import { UserContext } from '../../../shared/types/hono.types';
import { executeInTransaction, lockUserBalance, updateUserBalance, createTransaction, lockSystemConfig } from '../../../domain/services/transaction.service';

const marketplaceRoutes = new Hono();

// Esquemas de validação
const createListingSchema = z.object({
    title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres').max(255),
    description: z.string().min(5, 'Descrição deve ter pelo menos 5 caracteres'),
    price: z.number().positive('Preço deve ser maior que zero'),
    category: z.string().optional(),
    imageUrl: z.string().optional(),
});

const buyListingSchema = z.object({
    listingId: z.number().int(),
});

const buyOnCreditSchema = z.object({
    listingId: z.number().int(),
    installments: z.number().int().min(1).max(MARKET_CREDIT_MAX_INSTALLMENTS),
});

/**
 * Listar todos os anúncios ativos no Mercado Cred30
 */
marketplaceRoutes.get('/listings', authMiddleware, async (c) => {
    try {
        const pool = getDbPool(c);
        const result = await pool.query(
            `SELECT l.*, u.name as seller_name 
       FROM marketplace_listings l 
       JOIN users u ON l.seller_id = u.id 
       WHERE l.status = 'ACTIVE' 
       ORDER BY l.is_boosted DESC, l.created_at DESC`
        );

        return c.json({
            success: true,
            data: {
                listings: result.rows.map(l => ({
                    ...l,
                    price: parseFloat(l.price)
                }))
            }
        });
    } catch (error) {
        console.error('Erro ao listar anúncios:', error);
        return c.json({ success: false, message: 'Erro ao buscar anúncios' }, 500);
    }
});

/**
 * Criar um novo anúncio no Mercado Cred30
 */
marketplaceRoutes.post('/create', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const body = await c.req.json();
        const parseResult = createListingSchema.safeParse(body);

        if (!parseResult.success) {
            console.error('Validation error creating listing:', parseResult.error.errors);
            return c.json({
                success: false,
                message: 'Dados do anúncio inválidos: ' + parseResult.error.errors.map(e => e.message).join(', '),
                errors: parseResult.error.errors
            }, 400);
        }

        const { title, description, price, category, imageUrl } = parseResult.data;

        const result = await pool.query(
            `INSERT INTO marketplace_listings (seller_id, title, description, price, category, image_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [user.id, title, description, price, category || 'OUTROS', imageUrl]
        );

        return c.json({
            success: true,
            listing: result.rows[0],
            message: 'Anúncio publicado com sucesso!'
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
        }
        console.error('Erro ao criar anúncio:', error);
        return c.json({ success: false, message: 'Erro ao publicar anúncio' }, 500);
    }
});

/**
 * Comprar um item (Inicia o processo de Escrow/Garantia)
 * O valor é retirado do saldo do comprador e fica retido pelo sistema.
 */
/**
 * Comprar parcelado via Crediário Cred30 (Financiamento Social)
 * A plataforma antecipa o valor para o vendedor e o comprador paga parcelado.
 */
marketplaceRoutes.post('/buy-on-credit', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const body = await c.req.json();
        const { listingId, installments } = buyOnCreditSchema.parse(body);

        // 1. Verificar Score Mínimo
        const userResult = await pool.query('SELECT score FROM users WHERE id = $1', [user.id]);
        const userScore = userResult.rows[0]?.score || 0;

        if (userScore < MARKET_CREDIT_MIN_SCORE) {
            return c.json({
                success: false,
                message: `Seu Score (${userScore}) é insuficiente para o Crediário Cred30. O mínimo necessário é ${MARKET_CREDIT_MIN_SCORE}.`
            }, 403);
        }

        // 2. Buscar anúncio
        const listingResult = await pool.query(
            'SELECT * FROM marketplace_listings WHERE id = $1 AND status = $2',
            [listingId, 'ACTIVE']
        );

        if (listingResult.rows.length === 0) {
            return c.json({ success: false, message: 'Este item não está mais disponível.' }, 404);
        }

        const listing = listingResult.rows[0];

        if (listing.seller_id === user.id) {
            return c.json({ success: false, message: 'Você não pode financiar seu próprio item.' }, 400);
        }

        const price = parseFloat(listing.price);
        const totalInterestRate = MARKET_CREDIT_INTEREST_RATE * installments;
        const totalAmountWithInterest = price * (1 + totalInterestRate);
        const installmentValue = totalAmountWithInterest / installments;

        const result = await executeInTransaction(pool, async (client) => {
            // 3. Verificar se o caixa do sistema suporta honrar esse pagamento ao vendedor
            const systemConfig = await lockSystemConfig(client);
            if (parseFloat(systemConfig.system_balance) < price) {
                throw new Error('O sistema atingiu o limite de financiamentos diários. Tente novamente amanhã.');
            }

            // 4. Marcar anúncio como VENDIDO
            await client.query('UPDATE marketplace_listings SET status = $1 WHERE id = $2', ['SOLD', listingId]);

            // 5. Criar o Pedido com status de Garantia (Escrow) e método CRED30_CREDIT
            const orderResult = await client.query(
                `INSERT INTO marketplace_orders (listing_id, buyer_id, seller_id, amount, fee_amount, seller_amount, status, payment_method)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [listingId, user.id, listing.seller_id, price, price * MARKETPLACE_ESCROW_FEE_RATE, price * (1 - MARKETPLACE_ESCROW_FEE_RATE), 'WAITING_SHIPPING', 'CRED30_CREDIT']
            );

            const orderId = orderResult.rows[0].id;

            // 6. Criar o registro de "Empréstimo/Dívida" para o comprador
            await client.query(
                `INSERT INTO loans (user_id, amount, installments, interest_rate, total_repayment, status, description, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [user.id, price, installments, MARKET_CREDIT_INTEREST_RATE, totalAmountWithInterest, 'APPROVED', `Compra no Mercado: ${listing.title}`, JSON.stringify({ orderId, listingId, type: 'MARKET_FINANCING' })]
            );

            // 7. Registrar transação informativa no extrato
            await createTransaction(
                client,
                user.id,
                'MARKET_PURCHASE_CREDIT',
                totalAmountWithInterest,
                `Compra Parcelada: ${listing.title} (${installments}x de R$ ${installmentValue.toFixed(2)})`,
                'APPROVED',
                { orderId, listingId, installments }
            );

            return { orderId, totalAmountWithInterest };
        });

        if (!result.success) return c.json({ success: false, message: result.error }, 400);

        return c.json({
            success: true,
            message: `Financiamento Social Aprovado! Você pagará ${installments}x de R$ ${installmentValue.toFixed(2)}.`,
            data: { orderId: result.data?.orderId }
        });
    } catch (error) {
        console.error('Erro ao comprar no crediário:', error);
        return c.json({ success: false, message: 'Erro ao processar financiamento social' }, 500);
    }
});

marketplaceRoutes.post('/buy', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const body = await c.req.json();
        const { listingId } = buyListingSchema.parse(body);

        // Buscar anúncio
        const listingResult = await pool.query(
            'SELECT * FROM marketplace_listings WHERE id = $1 AND status = $2',
            [listingId, 'ACTIVE']
        );

        if (listingResult.rows.length === 0) {
            return c.json({ success: false, message: 'Este item não está mais disponível.' }, 404);
        }

        const listing = listingResult.rows[0];

        // Impedir compra de si mesmo
        if (listing.seller_id === user.id) {
            return c.json({ success: false, message: 'Você não pode comprar seu próprio item.' }, 400);
        }

        const price = parseFloat(listing.price);
        const fee = price * MARKETPLACE_ESCROW_FEE_RATE;
        const sellerAmount = price - fee;

        const result = await executeInTransaction(pool, async (client) => {
            // 1. Verificar e bloquear saldo do comprador
            const balanceCheck = await lockUserBalance(client, user.id, price);
            if (!balanceCheck.success) {
                throw new Error('Saldo insuficiente para realizar a compra.');
            }

            // 2. Deduzir saldo do comprador
            await updateUserBalance(client, user.id, price, 'debit');

            // 3. Marcar anúncio como VENDIDO
            await client.query('UPDATE marketplace_listings SET status = $1 WHERE id = $2', ['SOLD', listingId]);

            // 4. Criar o Pedido com status de Garantia (Escrow)
            const orderResult = await client.query(
                `INSERT INTO marketplace_orders (listing_id, buyer_id, seller_id, amount, fee_amount, seller_amount, status, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [listingId, user.id, listing.seller_id, price, fee, sellerAmount, 'WAITING_SHIPPING', 'BALANCE']
            );

            const orderId = orderResult.rows[0].id;

            // 5. Registrar transação no extrato do comprador
            await createTransaction(
                client,
                user.id,
                'MARKET_PURCHASE',
                price,
                `Compra no Mercado: ${listing.title} (Garantia Ativa)`,
                'APPROVED',
                { orderId, listingId }
            );

            return { orderId };
        });

        if (!result.success) {
            return c.json({ success: false, message: result.error }, 400);
        }

        return c.json({
            success: true,
            message: 'Compra realizada! O valor está seguro com a Cred30 até que você receba o produto.',
            orderId: result.data?.orderId
        });
    } catch (error) {
        console.error('Erro ao comprar item:', error);
        return c.json({ success: false, message: 'Erro ao processar compra' }, 500);
    }
});

/**
 * Confirmar recebimento (Comprador libera os fundos para o vendedor)
 */
marketplaceRoutes.post('/order/:id/receive', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const orderId = c.req.param('id');

        // Buscar pedido esperando entrega
        const orderResult = await pool.query(
            `SELECT o.*, l.title FROM marketplace_orders o 
       JOIN marketplace_listings l ON o.listing_id = l.id 
       WHERE o.id = $1 AND o.buyer_id = $2 AND o.status IN ('WAITING_SHIPPING', 'IN_TRANSIT')`,
            [orderId, user.id]
        );

        if (orderResult.rows.length === 0) {
            return c.json({ success: false, message: 'Pedido não encontrado ou já finalizado.' }, 404);
        }

        const order = orderResult.rows[0];

        const result = await executeInTransaction(pool, async (client) => {
            // 1. Finalizar pedido
            await client.query(
                'UPDATE marketplace_orders SET status = $1, updated_at = NOW() WHERE id = $2',
                ['COMPLETED', orderId]
            );

            // 2. Liberar saldo para o vendedor (valor líquido)
            const sellerAmount = parseFloat(order.seller_amount);

            // Se foi no crediário, o dinheiro sai do caixa do sistema para o vendedor
            if (order.payment_method === 'CRED30_CREDIT') {
                await client.query('UPDATE system_config SET system_balance = system_balance - $1', [order.amount]);
            }

            await updateUserBalance(client, order.seller_id, sellerAmount, 'credit');

            // 3. Contabilizar a taxa de serviço (Regra 85/15)
            const feeAmount = parseFloat(order.fee_amount);
            const feeForOperational = feeAmount * 0.85;
            const feeForProfit = feeAmount * 0.15;

            await client.query(
                'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
                [feeForOperational, feeForProfit]
            );

            // 4. Registrar transação no extrato do vendedor
            await createTransaction(
                client,
                order.seller_id,
                'MARKET_SALE',
                sellerAmount,
                `Venda Concluída: ${order.title}`,
                'APPROVED',
                { orderId }
            );

            return { sellerAmount };
        });

        if (!result.success) {
            return c.json({ success: false, message: result.error }, 400);
        }

        return c.json({
            success: true,
            message: 'Entrega confirmada! Saldo liberado ao vendedor.'
        });
    } catch (error) {
        console.error('Erro ao confirmar recebimento:', error);
        return c.json({ success: false, message: 'Erro ao processar liberação de fundos' }, 500);
    }
});

/**
 * Listar minhas compras e vendas
 */
marketplaceRoutes.get('/my-orders', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);

        const result = await pool.query(
            `SELECT o.*, l.title, l.image_url, 
              ub.name as buyer_name, us.name as seller_name
       FROM marketplace_orders o
       JOIN marketplace_listings l ON o.listing_id = l.id
       JOIN users ub ON o.buyer_id = ub.id
       JOIN users us ON o.seller_id = us.id
       WHERE o.buyer_id = $1 OR o.seller_id = $1
       ORDER BY o.created_at DESC`,
            [user.id]
        );

        return c.json({
            success: true,
            data: {
                orders: result.rows
            }
        });
    } catch (error) {
        console.error('Erro ao listar pedidos:', error);
        return c.json({ success: false, message: 'Erro ao buscar seu histórico' }, 500);
    }
});

/**
 * Impulsionar um anúncio (Monetização)
 */
marketplaceRoutes.post('/boost', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const { listingId } = await c.req.json();
        const BOOST_FEE = 5.00; // R$ 5,00 para impulsionar por 7 dias

        const result = await executeInTransaction(pool, async (client) => {
            // 1. Verificar se o anúncio pertence ao usuário e está ativo
            const listingRes = await client.query(
                'SELECT * FROM marketplace_listings WHERE id = $1 AND seller_id = $2 AND status = $3',
                [listingId, user.id, 'ACTIVE']
            );

            if (listingRes.rows.length === 0) throw new Error('Anúncio não encontrado ou inválido');

            // 2. Verificar saldo do usuário
            const userRes = await client.query('SELECT balance FROM users WHERE id = $1', [user.id]);
            if (parseFloat(userRes.rows[0].balance) < BOOST_FEE) throw new Error('Saldo insuficiente para impulsionar');

            // 3. Cobrar taxa e atualizar anúncio
            await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [BOOST_FEE, user.id]);

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            await client.query(
                'UPDATE marketplace_listings SET is_boosted = TRUE, boost_expires_at = $1 WHERE id = $2',
                [expiresAt, listingId]
            );

            // 4. Distribuir dividendos (15% para cotistas)
            const feeForProfit = BOOST_FEE * 0.15;
            const feeForOperational = BOOST_FEE * 0.85;

            await client.query(
                'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
                [feeForOperational, feeForProfit]
            );

            // 5. Registrar transação
            await createTransaction(
                client,
                user.id,
                'MARKET_BOOST',
                -BOOST_FEE,
                `Impulsionamento de Anúncio: ${listingRes.rows[0].title}`,
                'APPROVED'
            );

            return { success: true };
        });

        if (!result.success) return c.json({ success: false, message: result.error }, 400);
        return c.json({ success: true, message: 'Seu anúncio foi impulsionado! Ele aparecerá no topo por 7 dias.' });
    } catch (error: any) {
        console.error('Error boosting listing:', error);
        return c.json({ success: false, message: error.message || 'Erro ao impulsionar anúncio' }, 500);
    }
});

export { marketplaceRoutes };
