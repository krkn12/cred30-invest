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
    deliveryAddress: z.string().min(10, 'Endereço muito curto').optional(),
    contactPhone: z.string().min(8, 'Telefone inválido').optional(),
});

const buyOnCreditSchema = z.object({
    listingId: z.number().int(),
    installments: z.number().int().min(1).max(MARKET_CREDIT_MAX_INSTALLMENTS),
    deliveryAddress: z.string().min(10, 'Endereço muito curto').optional(),
    contactPhone: z.string().min(8, 'Telefone inválido').optional(),
});

/**
 * Listar todos os anúncios ativos no Mercado Cred30
 */
marketplaceRoutes.get('/listings', authMiddleware, async (c) => {
    try {
        const pool = getDbPool(c);

        // Buscar anúncios do marketplace (P2P)
        const marketplaceResult = await pool.query(
            `SELECT l.*, u.name as seller_name, 'P2P' as type
             FROM marketplace_listings l 
             JOIN users u ON l.seller_id = u.id 
             WHERE l.status = 'ACTIVE' 
             ORDER BY l.is_boosted DESC, l.created_at DESC`
        );

        // Buscar produtos de afiliados
        const productsResult = await pool.query(
            `SELECT p.*, 'AFFILIATE' as type, 'Cred30 Parceiros' as seller_name
             FROM products p
             WHERE p.active = true`
        );

        const marketplaceListings = marketplaceResult.rows.map(l => ({
            ...l,
            price: parseFloat(l.price)
        }));

        const affiliateProducts = productsResult.rows.map(p => ({
            ...p,
            seller_id: 0,
            price: p.price ? parseFloat(p.price) : 0,
            is_boosted: true, // Afiliados aparecem como patrocinados/impulsionados
            status: 'ACTIVE',
            image_url: p.image_url // Garantir mapeamento correto para o frontend
        }));

        // Combinar e ordenar (Impulsionados primeiro, depois por data)
        const combined = [...marketplaceListings, ...affiliateProducts]
            .sort((a, b) => {
                if (a.is_boosted && !b.is_boosted) return -1;
                if (!a.is_boosted && b.is_boosted) return 1;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });

        return c.json({
            success: true,
            data: {
                listings: combined
            }
        });
    } catch (error) {
        console.error('Erro ao listar anúncios:', error);
        return c.json({ success: false, message: 'Erro ao buscar anúncios' }, 500);
    }
});

marketplaceRoutes.post('/create', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const body = await c.req.json();
        const parseResult = createListingSchema.safeParse(body);

        if (!parseResult.success) {
            return c.json({
                success: false,
                message: 'Dados inválidos',
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
        console.error('Erro ao criar anúncio:', error);
        return c.json({ success: false, message: 'Erro ao publicar anúncio' }, 500);
    }
});

marketplaceRoutes.post('/buy-on-credit', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const body = await c.req.json();
        const { listingId, installments, deliveryAddress, contactPhone } = buyOnCreditSchema.parse(body);

        const userResult = await pool.query('SELECT score FROM users WHERE id = $1', [user.id]);
        const userScore = userResult.rows[0]?.score || 0;

        if (userScore < MARKET_CREDIT_MIN_SCORE) {
            return c.json({ success: false, message: `Score insuficiente (${userScore}). Mínimo: ${MARKET_CREDIT_MIN_SCORE}.` }, 403);
        }

        const listingResult = await pool.query('SELECT * FROM marketplace_listings WHERE id = $1 AND status = $2', [listingId, 'ACTIVE']);
        if (listingResult.rows.length === 0) return c.json({ success: false, message: 'Item indisponível.' }, 404);

        const listing = listingResult.rows[0];
        if (listing.seller_id === user.id) return c.json({ success: false, message: 'Você não pode comprar de si mesmo.' }, 400);

        const price = parseFloat(listing.price);
        const totalInterestRate = MARKET_CREDIT_INTEREST_RATE * installments;
        const totalAmountWithInterest = price * (1 + totalInterestRate);

        const result = await executeInTransaction(pool, async (client) => {
            const systemConfig = await lockSystemConfig(client);
            if (parseFloat(systemConfig.system_balance) < price) throw new Error('Limite diário de financiamento atingido.');

            await client.query('UPDATE marketplace_listings SET status = $1 WHERE id = $2', ['SOLD', listingId]);

            const orderResult = await client.query(
                `INSERT INTO marketplace_orders (listing_id, buyer_id, seller_id, amount, fee_amount, seller_amount, status, payment_method, delivery_address, contact_phone)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
                [listingId, user.id, listing.seller_id, price, price * MARKETPLACE_ESCROW_FEE_RATE, price * (1 - MARKETPLACE_ESCROW_FEE_RATE), 'WAITING_SHIPPING', 'CRED30_CREDIT', deliveryAddress, contactPhone]
            );
            const orderId = orderResult.rows[0].id;

            await client.query(
                `INSERT INTO loans (user_id, amount, installments, interest_rate, total_repayment, status, description, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [user.id, price, installments, MARKET_CREDIT_INTEREST_RATE, totalAmountWithInterest, 'APPROVED', `Compra: ${listing.title}`, JSON.stringify({ orderId, listingId, type: 'MARKET_FINANCING' })]
            );

            await createTransaction(client, user.id, 'MARKET_PURCHASE_CREDIT', totalAmountWithInterest, `Compra Parcelada: ${listing.title}`, 'APPROVED', { orderId, listingId });

            return { orderId };
        });

        if (!result.success) return c.json({ success: false, message: result.error }, 400);
        return c.json({ success: true, message: 'Financiamento Aprovado!', data: { orderId: result.data?.orderId } });

    } catch (error) {
        console.error('Buy Credit Error:', error);
        return c.json({ success: false, message: 'Erro ao processar' }, 500);
    }
});

marketplaceRoutes.post('/buy', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const body = await c.req.json();
        const { listingId, deliveryAddress, contactPhone } = buyListingSchema.parse(body);

        const listingResult = await pool.query('SELECT * FROM marketplace_listings WHERE id = $1 AND status = $2', [listingId, 'ACTIVE']);
        if (listingResult.rows.length === 0) return c.json({ success: false, message: 'Item indisponível.' }, 404);

        const listing = listingResult.rows[0];
        if (listing.seller_id === user.id) return c.json({ success: false, message: 'Você não pode comprar de si mesmo.' }, 400);

        const price = parseFloat(listing.price);
        const fee = price * MARKETPLACE_ESCROW_FEE_RATE;
        const sellerAmount = price - fee;

        const result = await executeInTransaction(pool, async (client) => {
            const balanceCheck = await lockUserBalance(client, user.id, price);
            if (!balanceCheck.success) throw new Error('Saldo insuficiente.');

            await updateUserBalance(client, user.id, price, 'debit');
            await client.query('UPDATE marketplace_listings SET status = $1 WHERE id = $2', ['SOLD', listingId]);

            const orderResult = await client.query(
                `INSERT INTO marketplace_orders (listing_id, buyer_id, seller_id, amount, fee_amount, seller_amount, status, payment_method, delivery_address, contact_phone)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
                [listingId, user.id, listing.seller_id, price, fee, sellerAmount, 'WAITING_SHIPPING', 'BALANCE', deliveryAddress, contactPhone]
            );
            const orderId = orderResult.rows[0].id;

            await createTransaction(client, user.id, 'MARKET_PURCHASE', price, `Compra: ${listing.title}`, 'APPROVED', { orderId, listingId });
            return { orderId };
        });

        if (!result.success) return c.json({ success: false, message: result.error }, 400);
        return c.json({ success: true, message: 'Compra realizada!', orderId: result.data?.orderId });

    } catch (error) {
        console.error('Buy Balance Error:', error);
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
              ub.name as buyer_name, us.name as seller_name,
              ln.installments, ln.interest_rate, ln.total_repayment
       FROM marketplace_orders o
       JOIN marketplace_listings l ON o.listing_id = l.id
       JOIN users ub ON o.buyer_id = ub.id
       JOIN users us ON o.seller_id = us.id
       LEFT JOIN loans ln ON o.payment_method = 'CRED30_CREDIT' 
            AND ln.metadata->>'orderId' = o.id::text 
            AND ln.user_id = o.buyer_id
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
