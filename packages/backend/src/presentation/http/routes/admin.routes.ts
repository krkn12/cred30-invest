import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { PoolClient } from 'pg';
import { authMiddleware, adminMiddleware, attendantMiddleware } from '../middleware/auth.middleware';
import { auditMiddleware, initializeAuditTable } from '../../../infrastructure/logging/audit.middleware';
import { adminRateLimit } from '../middleware/rate-limit.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import {
  DIVIDEND_USER_SHARE,
  DIVIDEND_MAINTENANCE_SHARE,
  QUOTA_PRICE,
  QUOTA_SHARE_VALUE,
  QUOTA_ADM_FEE,
  REFERRAL_BONUS
} from '../../../shared/constants/business.constants';
import { executeInTransaction, updateUserBalance, createTransaction, updateTransactionStatus, processTransactionApproval, processLoanApproval } from '../../../domain/services/transaction.service';
import { distributeProfits } from '../../../application/services/profit-distribution.service';
import { runAutoLiquidation } from '../../../application/services/auto-liquidation.service';
import { updateScore, SCORE_REWARDS } from '../../../application/services/score.service';
import { calculateGatewayCost } from '../../../shared/utils/financial.utils';
import { simulatePaymentApproval } from '../../../infrastructure/gateways/mercadopago.service';

interface PaymentApprovalResult {
  success: boolean;
  principalAmount: number;
  interestAmount: number;
}

const adminRoutes = new Hono();

// Aplicar middlewares a todas as rotas de admin
adminRoutes.use('*', authMiddleware);
adminRoutes.use('*', adminRateLimit);

// Esquema de validação para atualização de saldo do sistema
const updateBalanceSchema = z.object({
  newBalance: z.number(),
});

// Esquema de validação para adição ao pool de lucros
const updateProfitSchema = z.object({
  amountToAdd: z.number(),
});

// Esquema de validação para aprovação/rejeição
const actionSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((val) => {
    if (typeof val === 'string') {
      return val; // Manter como string (UUID)
    }
    return val.toString(); // Converter number para string
  }).refine((val) => typeof val === 'string', {
    message: "ID deve ser uma string (UUID) válida"
  }),
  type: z.enum(['TRANSACTION', 'LOAN']),
  action: z.enum(['APPROVE', 'REJECT']),
});

const simulateMpSchema = z.object({
  paymentId: z.string(),
  transactionId: z.string()
});

const payoutActionSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(val => val.toString()),
  type: z.enum(['TRANSACTION', 'LOAN']),
});

const createReferralCodeSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  maxUses: z.number().int().min(1).optional().nullable(),
});

const addQuotaSchema = z.object({
  email: z.string().email(),
  quantity: z.number().int().positive(),
  reason: z.string().optional()
});

const createCostSchema = z.object({
  description: z.string().min(3),
  amount: z.number().positive(),
  isRecurring: z.boolean().default(true),
});

// Listar custos do sistema
adminRoutes.get('/costs', adminMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);
    const result = await pool.query('SELECT * FROM system_costs ORDER BY created_at DESC');
    return c.json({ success: true, data: result.rows });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Adicionar custo do sistema
adminRoutes.post('/costs', adminMiddleware, auditMiddleware('ADD_COST', 'SYSTEM'), async (c) => {
  try {
    const body = await c.req.json();
    const { description, amount, isRecurring } = createCostSchema.parse(body);
    const pool = getDbPool(c);

    await pool.query(
      'INSERT INTO system_costs (description, amount, is_recurring) VALUES ($1, $2, $3)',
      [description, amount, isRecurring]
    );

    return c.json({ success: true, message: 'Custo adicionado com sucesso' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Remover custo do sistema
adminRoutes.delete('/costs/:id', adminMiddleware, auditMiddleware('DELETE_COST', 'SYSTEM'), async (c) => {
  try {
    const id = c.req.param('id');
    const pool = getDbPool(c);

    const result = await pool.query('DELETE FROM system_costs WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Custo não encontrado' }, 404);
    }

    return c.json({ success: true, message: 'Custo removido com sucesso' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Pagamento de custo do sistema
adminRoutes.post('/costs/:id/pay', adminMiddleware, auditMiddleware('PAY_COST', 'SYSTEM'), async (c) => {
  try {
    const id = c.req.param('id');
    const pool = getDbPool(c);

    const result = await executeInTransaction(pool, async (client) => {
      // 1. Buscar o custo
      const costRes = await client.query('SELECT description, amount FROM system_costs WHERE id = $1', [id]);
      if (costRes.rows.length === 0) {
        throw new Error('Custo não encontrado');
      }
      const cost = costRes.rows[0];
      const amount = parseFloat(cost.amount);

      // 2. Subtrair do saldo do sistema
      const configRes = await client.query('SELECT system_balance FROM system_config LIMIT 1');
      if (parseFloat(configRes.rows[0].system_balance) < amount) {
        throw new Error('Saldo do sistema insuficiente para realizar este pagamento.');
      }

      await client.query('UPDATE system_config SET system_balance = system_balance - $1', [amount]);

      // 3. Remover o custo (como solicitado: "as dívidas somem")
      await client.query('DELETE FROM system_costs WHERE id = $1', [id]);

      return { description: cost.description, amount: amount };
    });

    if (!result.success) return c.json({ success: false, message: result.error }, 400);

    return c.json({ success: true, message: `Pagamento de "${result.data?.description}" realizado com sucesso!` });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Histórico Financeiro do Admin (Extrato)
adminRoutes.get('/finance-history', adminMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);
    const result = await pool.query(`
      SELECT l.*, u.name as admin_name 
      FROM admin_logs l
      LEFT JOIN users u ON l.admin_id = u.id
      WHERE l.action IN ('MANUAL_PROFIT_ADD', 'PAY_COST', 'ADD_COST', 'DELETE_COST', 'MANUAL_ADD_QUOTA')
      ORDER BY l.created_at DESC
      LIMIT 50
    `);
    return c.json({ success: true, data: result.rows });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Dashboard administrativo
adminRoutes.get('/dashboard', adminMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);

    // Buscar configurações do sistema
    const configResult = await pool.query('SELECT * FROM system_config LIMIT 1');
    let config = configResult.rows[0] || null;

    if (!config) {
      // Criar configuração padrão se não existir
      await pool.query(`
        INSERT INTO system_config (system_balance, profit_pool, quota_price, loan_interest_rate, penalty_rate, vesting_period_ms)
        VALUES (0, 0, $1, 0.2, 0.4, $2)
      `, [QUOTA_PRICE, 365 * 24 * 60 * 60 * 1000]);

      // Buscar novamente
      const newConfigResult = await pool.query('SELECT * FROM system_config LIMIT 1');
      config = newConfigResult.rows[0];
    }

    // Calcular caixa operacional baseado em cotas ATIVAS APENAS
    // Caixa = (Total de cotas ATIVAS * QUOTA_PRICE) - (Valor total emprestado)
    const activeQuotasResult = await pool.query(
      `SELECT COUNT(*) as count FROM quotas WHERE status = 'ACTIVE'`
    );
    const activeQuotasCount = parseInt(activeQuotasResult.rows[0].count);
    const totalQuotasValue = activeQuotasCount * QUOTA_PRICE;

    // Calcular valor total emprestado (apenas empréstimos ATIVOS, não pagos)
    const totalLoanedResult = await pool.query(
      `SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as total_loaned
       FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')`
    );
    const totalLoaned = parseFloat(totalLoanedResult.rows[0].total_loaned);

    // Calcular "Saúde Financeira" Teórica (Deveria existir = Capital - Saídas)
    // Brindes agora são considerados entradas de dinheiro (capitalização do sistema)
    const operationalCash = totalQuotasValue - totalLoaned;

    // Converter valores numéricos para garantir consistência e evitar strings
    config.system_balance = parseFloat(String(config.system_balance || 0));
    config.profit_pool = parseFloat(String(config.profit_pool || 0));
    config.quota_price = parseFloat(String(config.quota_price || 0));
    config.total_gateway_costs = parseFloat(String(config.total_gateway_costs || 0));
    config.total_manual_costs = parseFloat(String(config.total_manual_costs || 0));
    config.total_tax_reserve = parseFloat(String(config.total_tax_reserve || 0));
    config.total_operational_reserve = parseFloat(String(config.total_operational_reserve || 0));
    config.total_owner_profit = parseFloat(String(config.total_owner_profit || 0));

    // Buscar totais e métricas financeiras de forma otimizada (query única)
    const statsResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COALESCE(SUM(CAST(balance AS NUMERIC)), 0) FROM users) as total_user_balances,
        (SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE') as quotas_count,
        (SELECT COUNT(*) FROM loans WHERE status IN ('PENDING', 'APPROVED', 'PAYMENT_PENDING')) as active_loans_count,
        (SELECT COALESCE(SUM(CAST(total_repayment AS NUMERIC)), 0) FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')) as total_to_receive,
        (SELECT COALESCE(SUM(amount), 0) FROM system_costs) as total_monthly_costs
    `);

    const stats = statsResult.rows[0];
    const usersCount = parseInt(stats.users_count);
    const totalUserBalances = parseFloat(stats.total_user_balances);
    const quotasCount = parseInt(stats.quotas_count);
    const activeLoansCount = parseInt(stats.active_loans_count);
    const totalToReceive = parseFloat(stats.total_to_receive);
    const totalMonthlyCosts = parseFloat(stats.total_monthly_costs);

    // Calcular detalhamento de liquidez para o dashboard
    // Liquidez Real = (Saldo em Conta) - (Saldos dos Usuários) - (Reservas Fixas) - (Custos do Mês)
    // O profit_pool NÃO é subtraído aqui porque ele é uma distribuição futura, não uma dívida imediata exigível (saque).
    const totalReservesForRealLiquidity = config.total_tax_reserve +
      config.total_operational_reserve +
      config.total_owner_profit +
      totalMonthlyCosts +
      totalUserBalances;

    config.real_liquidity = config.system_balance - totalReservesForRealLiquidity;
    config.total_reserves = totalReservesForRealLiquidity;
    config.total_user_balances = totalUserBalances;
    config.theoretical_cash = operationalCash;
    config.monthly_fixed_costs = totalMonthlyCosts;

    // DEBUG: Informação detalhada de caixa
    console.log('DEBUG - Saúde Financeira:', {
      caixaBruto: config.system_balance,
      saldosUsuarios: totalUserBalances,
      reservasTotal: totalReservesForRealLiquidity,
      liquidezReal: config.real_liquidity,
      caixaTeorico: operationalCash,
      custosFixos: totalMonthlyCosts
    });

    return c.json({
      success: true,
      data: {
        systemConfig: config,
        stats: {
          usersCount,
          quotasCount,
          activeLoansCount,
          totalLoaned,
          totalToReceive,
        },
      },
    });
  } catch (error) {
    console.error('Erro ao carregar dashboard administrativo:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Rota obsoleta - Caixa operacional agora é calculado automaticamente
// Mantida para compatibilidade, mas retorna mensagem informativa
// Painel de Monitoramento de Saúde do Sistema
adminRoutes.get('/metrics/health', attendantMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);
    const start = Date.now();

    // 1. Latência do Banco de Dados
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - start;

    // 2, 3 e 4. Estatísticas Consolidadas (Performance)
    const statsResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM transactions) as total_transactions,
        (SELECT COUNT(*) FROM quotas) as total_quotas,
        (SELECT COUNT(*) FROM loans) as total_loans,
        (SELECT COUNT(*) FROM admin_logs) as total_admin_logs,
        (SELECT COUNT(*) FROM system_costs) as total_system_costs,
        (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours') as new_users_24h,
        (SELECT COUNT(*) FROM transactions WHERE created_at > NOW() - INTERVAL '24 hours') as trans_24h,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE created_at > NOW() - INTERVAL '24 hours' AND status = 'APPROVED') as volume_24h,
        (SELECT COUNT(*) FROM loans WHERE status = 'PENDING') as pending_loans_count,
        (SELECT COALESCE(SUM(amount), 0) FROM loans WHERE status = 'PENDING') as pending_loans_volume
    `);

    const stats = statsResult.rows[0];

    // 5. Recursos do Sistema (Node.js)
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return c.json({
      success: true,
      data: {
        health: {
          status: 'HEALTHY',
          dbLatency: `${dbLatency}ms`,
          uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
          memory: {
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
          }
        },
        database: {
          total_users: stats.total_users,
          total_transactions: stats.total_transactions,
          total_quotas: stats.total_quotas,
          total_loans: stats.total_loans,
          total_admin_logs: stats.total_admin_logs,
          total_system_costs: stats.total_system_costs
        },
        activity: {
          new_users_24h: stats.new_users_24h,
          trans_24h: stats.trans_24h,
          volume_24h: stats.volume_24h
        },
        queue: {
          pending_loans_count: stats.pending_loans_count,
          pending_loans_volume: stats.pending_loans_volume
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Erro ao buscar métricas de saúde:', error);
    return c.json({ success: false, message: 'Erro ao coletar métricas' }, 500);
  }
});

adminRoutes.post('/system-balance', adminMiddleware, async (c) => {
  return c.json({
    success: false,
    message: 'Caixa operacional agora é calculado automaticamente baseado nas cotas ATIVAS e empréstimos ativos.',
    info: 'Valor = (Total de cotas ATIVAS × R$ 50) - (Total emprestado)'
  }, 400);
});

// Adicionar lucro ao pool
// Adicionar lucro ao pool (e distribuir automaticamente agora)
adminRoutes.post('/profit-pool', adminMiddleware, auditMiddleware('MANUAL_PROFIT_ADD', 'SYSTEM_CONFIG'), async (c) => {
  try {
    const body = await c.req.json();
    let amountToAdd;

    // Tentar pegar do schema validado OU do corpo direto (fallback)
    if (body.amountToAdd !== undefined) {
      amountToAdd = parseFloat(body.amountToAdd);
    } else if (body.amount !== undefined) {
      amountToAdd = parseFloat(body.amount);
    }

    if (amountToAdd === undefined || isNaN(amountToAdd)) {
      return c.json({ success: false, message: 'Valor inválido' }, 400);
    }

    const pool = getDbPool(c);

    // Executar dentro de transação para garantir consistência: Adiciona e Distribui
    await executeInTransaction(pool, async (client) => {
      // 1. Adicionar ao pool de lucros E ao saldo real (pois é dinheiro novo entrando)
      await client.query(
        'UPDATE system_config SET profit_pool = profit_pool + $1, system_balance = system_balance + $1',
        [amountToAdd]
      );

      // 2. Registrar auditoria manual
      const user = c.get('user');
      await client.query(
        `INSERT INTO admin_logs (admin_id, action, entity_type, new_values, created_at)
             VALUES ($1, 'MANUAL_PROFIT_ADD', 'SYSTEM_CONFIG', $2, $3)`,
        [
          user.id,
          JSON.stringify({ addedAmount: amountToAdd }),
          new Date()
        ]
      );
    });

    return c.json({
      success: true,
      message: `R$ ${amountToAdd.toFixed(2)} adicionado ao acumulado e ao saldo do sistema!`,
      data: { addedAmount: amountToAdd }
    });
  } catch (error) {
    console.error('Erro ao adicionar lucro ao pool:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Adicionar cotas manualmente para um usuário (Gift/Bonus)
adminRoutes.post('/users/add-quota', adminMiddleware, auditMiddleware('MANUAL_ADD_QUOTA', 'QUOTA'), async (c) => {
  try {
    const body = await c.req.json();
    const { email, quantity, reason } = addQuotaSchema.parse(body);

    const pool = getDbPool(c);

    const result = await executeInTransaction(pool, async (client) => {
      // 1. Encontrar usuário
      const userRes = await client.query('SELECT id, name FROM users WHERE email = $1', [email]);
      if (userRes.rows.length === 0) {
        throw new Error('Usuário não encontrado com este email');
      }
      const user = userRes.rows[0];

      // 2. Inserir Cotas
      for (let i = 0; i < quantity; i++) {
        await client.query(
          `INSERT INTO quotas (user_id, purchase_price, current_value, purchase_date, status)
           VALUES ($1, $2, $3, $4, 'ACTIVE')`,
          [user.id, QUOTA_SHARE_VALUE, QUOTA_SHARE_VALUE, new Date()]
        );
      }

      // 3. Registrar a entrada de capital das cotas presenteadas (Admin aportando/capitalizando)
      const giftTotal = quantity * QUOTA_PRICE;
      const giftShareValue = quantity * QUOTA_SHARE_VALUE;
      const giftAdmFee = quantity * QUOTA_ADM_FEE;

      await client.query(
        'UPDATE system_config SET system_balance = system_balance + $1',
        [giftTotal] // O sistema recebe o valor total (como se o admin estivesse injetando capital)
      );

      // 4. Atualizar Score do Usuário (Benefício da Cota)
      await updateScore(client, user.id, SCORE_REWARDS.QUOTA_PURCHASE * quantity, `Ganhou ${quantity} cotas (Gift Admin)`);

      // 3. Registrar Log no histórico do usuário
      await createTransaction(
        client,
        user.id,
        'ADMIN_GIFT',
        0,
        `Recebeu ${quantity} cotas manualmente do Admin. Motivo: ${reason || 'Bônus Administrativo'}`,
        'COMPLETED',
        { quantity, reason, adminAction: true }
      );

      return { user: user.name };
    });

    if (!result.success) {
      return c.json({ success: false, message: result.error }, 400);
    }

    return c.json({
      success: true,
      message: `${quantity} cotas adicionadas para ${result.data?.user} com sucesso!`
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }
    return c.json({ success: false, message: error instanceof Error ? error.message : 'Erro interno' }, 500);
  }
});

// Processar ação administrativa (aprovar/rejeitar)
// Processar ação administrativa (aprovar/rejeitar)
adminRoutes.post('/process-action', adminMiddleware, auditMiddleware('PROCESS_ACTION', 'TRANSACTION_LOAN'), async (c) => {
  try {
    const body = await c.req.json();
    const { id, type, action } = actionSchema.parse(body);

    const pool = getDbPool(c);

    // Executar dentro de transação para garantir consistência
    const result = await executeInTransaction(pool, async (client) => {
      if (type === 'TRANSACTION') {
        return await processTransactionApproval(client, id, action);
      }
      throw new Error('Tipo de ação não reconhecido');
    });

    if (!result.success) {
      return c.json({
        success: false,
        message: result.error
      }, 400);
    }

    return c.json({
      success: true,
      message: `${action === 'APPROVE' ? 'Aprovado' : 'Rejeitado'} com sucesso!`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }

    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, 500);
  }
});

// Listar Fila de Pagamentos (Payout Queue)
adminRoutes.get('/payout-queue', adminMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);

    // Buscar transações (saques) aguardando pagamento
    const transactionsResult = await pool.query(
      `SELECT t.*, u.name as user_name, u.email as user_email, u.pix_key as user_pix, u.score as user_score,
              (SELECT COUNT(*) FROM quotas q WHERE q.user_id = t.user_id AND q.status = 'ACTIVE') as user_quotas
       FROM transactions t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.payout_status = 'PENDING_PAYMENT'
       ORDER BY user_quotas DESC, user_score DESC, t.created_at ASC`
    );



    return c.json({
      success: true,
      data: {
        transactions: transactionsResult.rows,
        loans: [] // Retornar vazio para compatibilidade
      }
    });
  } catch (error) {
    console.error('Erro ao buscar fila de pagamentos:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Confirmar Pagamento Efetuado (PIX enviado)
adminRoutes.post('/confirm-payout', adminMiddleware, auditMiddleware('CONFIRM_PAYOUT', 'TRANSACTION_LOAN'), async (c) => {
  try {
    const body = await c.req.json();
    const { id, type } = payoutActionSchema.parse(body);
    const pool = getDbPool(c);

    await executeInTransaction(pool, async (client) => {
      if (type === 'TRANSACTION') {
        await client.query(
          "UPDATE transactions SET payout_status = 'PAID', processed_at = $1 WHERE id = $2",
          [new Date(), id]
        );
      } else {
        throw new Error('Tipo de confirmação não suportado');
      }
    });

    return c.json({ success: true, message: 'Pagamento confirmado c/ sucesso!' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }
    return c.json({ success: false, message: error instanceof Error ? error.message : 'Erro interno' }, 500);
  }
});

// Distribuir dividendos
// Distribuir dividendos (Endpoint mantido para compatibilidade, mas agora usa o serviço compartilhado)
adminRoutes.post('/distribute-dividends', adminMiddleware, auditMiddleware('DISTRIBUTE_DIVIDENDS', 'SYSTEM_CONFIG'), async (c) => {
  try {
    const pool = getDbPool(c);

    const result = await distributeProfits(pool);

    if (!result.success) {
      return c.json(result, 400);
    }

    return c.json(result);
  } catch (error) {
    console.error('Erro ao distribuir dividendos:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Rota para atualização de saldo via PIX removida ou em outra seção

// Rota auxiliar para atualizar PIX de empréstimos existentes (temporário)
adminRoutes.post('/fix-loan-pix', adminMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { loanId, pixKey } = body;

    if (!loanId || !pixKey) {
      return c.json({ success: false, message: 'loanId e pixKey são obrigatórios' }, 400);
    }

    const pool = getDbPool(c);

    const result = await pool.query(
      'UPDATE loans SET pix_key_to_receive = $1 WHERE id = $2 RETURNING id, pix_key_to_receive',
      [pixKey, loanId]
    );

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Empréstimo não encontrado' }, 404);
    }

    return c.json({
      success: true,
      message: 'PIX atualizado com sucesso',
      data: {
        loanId: result.rows[0].id,
        pixKey: result.rows[0].pix_key_to_receive
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar PIX do empréstimo:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Aprovar pagamentos de empréstimos pendentes
adminRoutes.post('/approve-payment', adminMiddleware, auditMiddleware('APPROVE_PAYMENT', 'TRANSACTION'), async (c) => {
  try {
    const body = await c.req.json();
    const { transactionId } = body;

    if (!transactionId) {
      return c.json({ success: false, message: 'transactionId é obrigatório' }, 400);
    }

    const pool = getDbPool(c);

    // Executar dentro de transação para garantir consistência
    const result = await executeInTransaction(pool, async (client) => {
      // Buscar transação de pagamento com bloqueio
      const transactionResult = await client.query(
        'SELECT * FROM transactions WHERE id = $1 AND status = $2 FOR UPDATE',
        [transactionId, 'PENDING']
      );

      if (transactionResult.rows.length === 0) {
        throw new Error('Transação não encontrada ou já processada');
      }

      const transaction = transactionResult.rows[0];

      // Verificar se é uma transação de pagamento de empréstimo
      if (transaction.type !== 'LOAN_PAYMENT') {
        throw new Error('Transação não é um pagamento de empréstimo');
      }

      // Verificar se metadata já é um objeto ou precisa fazer parse
      let metadata: any = {};
      try {
        // Verificar se metadata já é um objeto
        if (transaction.metadata && typeof transaction.metadata === 'object') {
          metadata = transaction.metadata;
          console.log('DEBUG - Metadata já é objeto:', metadata);
        } else {
          // Se for string, fazer parse
          const metadataStr = String(transaction.metadata || '{}').trim();
          console.log('DEBUG - Metadata da transação (string):', metadataStr);
          if (metadataStr.startsWith('{') || metadataStr.startsWith('[')) {
            metadata = JSON.parse(metadataStr);
            console.log('DEBUG - Metadata parseado:', metadata);
          }
        }
      } catch (error) {
        console.error('Erro ao fazer parse do metadata:', error);
        metadata = {};
      }

      if (!metadata.loanId) {
        throw new Error('Metadata não contém loanId');
      }

      // Buscar empréstimo
      const loanResult = await client.query(
        'SELECT * FROM loans WHERE id = $1 FOR UPDATE',
        [metadata.loanId]
      );

      if (loanResult.rows.length === 0) {
        throw new Error('Empréstimo não encontrado');
      }

      const loan = loanResult.rows[0];

      // Calcular separação entre principal e juros
      const totalRepayment = parseFloat(loan.total_repayment);
      const principalAmount = parseFloat(loan.amount);
      const totalInterest = totalRepayment - principalAmount;

      console.log('DEBUG - Aprovação de pagamento:', {
        transactionId,
        loanId: metadata.loanId,
        totalRepayment,
        principalAmount,
        totalInterest,
        paymentType: metadata.paymentType
      });

      // Separar valores baseado no tipo de pagamento
      if (metadata.paymentType === 'full_payment') {
        // Pagamento completo do empréstimo
        // Calcular custo do gateway se não for via saldo
        let gatewayCost = 0;
        if (!metadata.useBalance) {
          const paymentMethod = metadata.paymentMethod || 'pix';
          const baseAmount = metadata.baseAmount ? parseFloat(metadata.baseAmount) : principalAmount + totalInterest;
          gatewayCost = calculateGatewayCost(baseAmount, paymentMethod);

          await client.query(
            'UPDATE transactions SET gateway_cost = $1 WHERE id = $2',
            [gatewayCost, transaction.id]
          );

          await client.query(
            'UPDATE system_config SET total_gateway_costs = total_gateway_costs + $1',
            [gatewayCost]
          );
        }

        // Devolver principal ao sistema
        // Se for pagamento externo, o principal vem com a taxa inclusa? 
        // Não, o system_balance deve aumentar pelo principal. O lucro de juros deve aumentar pelo juro.
        // Mas se houve custo de gateway, quem paga?
        // Se for PIX, o sistema absorve (diminui system_balance).
        // Se for CARTÃO, o usuário pagou extra (transaction.amount > baseAmount).

        await client.query(
          'UPDATE system_config SET system_balance = system_balance + $1 - $2',
          [principalAmount, metadata.useBalance ? 0 : gatewayCost]
        );

        // Adicionar juros ao pool de lucros
        await client.query(
          'UPDATE system_config SET profit_pool = profit_pool + $1',
          [totalInterest]
        );

        // Marcar empréstimo como PAGO
        await client.query(
          'UPDATE loans SET status = $1 WHERE id = $2',
          ['PAID', metadata.loanId]
        );

        console.log('DEBUG - Pagamento completo processado (100% juros para pool):', {
          principalReturned: principalAmount,
          totalInterest,
          totalToProfit: totalInterest
        });

      } else if (metadata.paymentType === 'installment' && metadata.installmentAmount) {
        // Pagamento de parcela individual
        const installmentAmount = parseFloat(metadata.installmentAmount);

        // Calcular proporção de principal e juros na parcela
        const principalPortion = installmentAmount * (principalAmount / totalRepayment);
        const interestPortion = installmentAmount - principalPortion;

        // Enviar 100% dos juros da parcela para o pool
        const interestForProfit = interestPortion;

        // Devolver parte do principal ao caixa operacional descontando o custo do gateway
        const paymentMethod = metadata.paymentMethod || 'pix';
        const baseAmount = metadata.baseAmount ? parseFloat(metadata.baseAmount) : installmentAmount;
        const gatewayCost = calculateGatewayCost(baseAmount, paymentMethod);

        // Atualizar transação com o custo (apenas uma vez se múltiplos blocos lerem)
        await client.query(
          'UPDATE transactions SET gateway_cost = $1 WHERE id = $2',
          [gatewayCost, transaction.id]
        );

        // Subtrair do caixa operacional e registrar custo total
        await client.query(
          'UPDATE system_config SET system_balance = system_balance + $1 - $2, total_gateway_costs = total_gateway_costs + $2',
          [principalPortion, gatewayCost]
        );

        console.log('DEBUG - Parcela processada:', {
          installmentAmount,
          principalPortion,
          interestPortion,
          gatewayCost
        });

        // Registrar pagamento da parcela na tabela de installments (IMPORTANTE: PIX não registra antes)
        // O use_balance é false pois se chegou aqui é aprovação de pagamento externo (não saldo)
        await client.query(
          'INSERT INTO loan_installments (loan_id, amount, use_balance, created_at) VALUES ($1, $2, $3, $4)',
          [metadata.loanId, installmentAmount, false, new Date()]
        );

        // Verificar se completou o pagamento do empréstimo
        const paidInstallmentsResult = await client.query(
          'SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as paid_amount FROM loan_installments WHERE loan_id = $1',
          [metadata.loanId]
        );

        const totalPaidAmount = parseFloat(paidInstallmentsResult.rows[0].paid_amount);

        // Se o valor pago for maior ou igual ao total, marcar como PAIDO
        if (totalPaidAmount >= parseFloat(loan.total_repayment)) {
          console.log('DEBUG - Empréstimo quitado com esta parcela!', {
            loanId: metadata.loanId,
            totalPaid: totalPaidAmount,
            totalRepayment: loan.total_repayment
          });

          await client.query(
            'UPDATE loans SET status = $1 WHERE id = $2',
            ['PAID', metadata.loanId]
          );
        }

      } else {
        throw new Error('Tipo de pagamento não reconhecido');
      }

      // Atualizar status da transação para APROVADO
      const updateResult = await updateTransactionStatus(
        client,
        transactionId,
        'PENDING',
        'APPROVED'
      );

      if (!updateResult.success) {
        throw new Error(updateResult.error);
      }

      let calculatedPrincipal = 0;
      let calculatedInterest = 0;

      if (metadata.paymentType === 'full_payment') {
        calculatedPrincipal = principalAmount;
        calculatedInterest = totalInterest;
      } else if (metadata.paymentType === 'installment' && metadata.installmentAmount) {
        const installmentAmount = parseFloat(metadata.installmentAmount);
        // Calcular proporção de principal e juros na parcela
        calculatedPrincipal = installmentAmount * (principalAmount / totalRepayment);
        calculatedInterest = installmentAmount - calculatedPrincipal;
      }

      console.log('DEBUG - Valores calculados para retorno:', {
        paymentType: metadata.paymentType,
        calculatedPrincipal,
        calculatedInterest,
        installmentAmount: metadata.installmentAmount,
        principalAmount,
        totalInterest,
        totalRepayment,
        loanAmount: loan.amount,
        loanTotalRepayment: loan.total_repayment
      });

      // Garantir que os valores sejam números válidos
      const validPrincipal = isNaN(calculatedPrincipal) ? 0 : calculatedPrincipal;
      const validInterest = isNaN(calculatedInterest) ? 0 : calculatedInterest;

      console.log('DEBUG - Valores finais após validação:', {
        validPrincipal,
        validInterest,
        interestForProfit: validInterest * 0.85,
        interestForOperational: validInterest * 0.15
      });

      return {
        success: true,
        principalAmount: validPrincipal,
        interestAmount: validInterest
      } as PaymentApprovalResult;
    });

    // Se houve sucesso na aprovação e geração de juros PARA LUCRO
    // REMOVIDO: Distribuição automática imediata.
    // O lucro acumula no pool e será distribuído pelo Cron Job.

    // Casting do resultado da transação
    const finalResult = result as PaymentApprovalResult;

    const principalReturned = finalResult.principalAmount || 0;
    const interestAdded = finalResult.interestAmount || 0;
    const interestForProfit = interestAdded ? interestAdded * 0.85 : 0;
    const interestForOperational = interestAdded ? interestAdded * 0.15 : 0;

    console.log('DEBUG - Valores finais para retorno ao frontend:', {
      transactionId,
      principalReturned,
      interestAdded,
      interestForProfit,
      interestForOperational,
      rawResult: finalResult
    });

    return c.json({
      success: true,
      message: 'Pagamento aprovado com sucesso! Principal devolvido ao caixa, juros distribuídos (85% para lucro, 15% para caixa).',
      data: {
        transactionId,
        principalReturned,
        interestAdded,
        interestForProfit,
        interestForOperational
      }
    });
  } catch (error) {
    console.error('Erro ao aprovar pagamento:', error);
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, 500);
  }
});

// Rejeitar pagamentos de empréstimos pendentes
adminRoutes.post('/reject-payment', adminMiddleware, auditMiddleware('REJECT_PAYMENT', 'TRANSACTION'), async (c) => {
  try {
    const body = await c.req.json();
    const { transactionId } = body;

    if (!transactionId) {
      return c.json({ success: false, message: 'transactionId é obrigatório' }, 400);
    }

    const pool = getDbPool(c);

    // Executar dentro de transação para garantir consistência
    const result = await executeInTransaction(pool, async (client) => {
      // Buscar transação de pagamento com bloqueio
      const transactionResult = await client.query(
        'SELECT * FROM transactions WHERE id = $1 AND status = $2 FOR UPDATE',
        [transactionId, 'PENDING']
      );

      if (transactionResult.rows.length === 0) {
        throw new Error('Transação não encontrada ou já processada');
      }

      const transaction = transactionResult.rows[0];

      // Verificar se é uma transação de pagamento de empréstimo
      if (transaction.type !== 'LOAN_PAYMENT') {
        throw new Error('Transação não é um pagamento de empréstimo');
      }

      // Verificar se metadata já é um objeto ou precisa fazer parse
      let metadata: any = {};
      try {
        // Verificar se metadata já é um objeto
        if (transaction.metadata && typeof transaction.metadata === 'object') {
          metadata = transaction.metadata;
          console.log('DEBUG - Metadata já é objeto (rejeição):', metadata);
        } else {
          // Se for string, fazer parse
          const metadataStr = String(transaction.metadata || '{}').trim();
          console.log('DEBUG - Metadata da transação (string) (rejeição):', metadataStr);
          if (metadataStr.startsWith('{') || metadataStr.startsWith('[')) {
            metadata = JSON.parse(metadataStr);
            console.log('DEBUG - Metadata parseado (rejeição):', metadata);
          }
        }
      } catch (error) {
        console.error('Erro ao fazer parse do metadata (rejeição):', error);
        metadata = {};
      }

      if (!metadata.loanId) {
        throw new Error('Metadata não contém loanId');
      }

      // Reembolsar o cliente se o pagamento foi feito com saldo
      if (metadata.useBalance) {
        await updateUserBalance(client, transaction.user_id, parseFloat(transaction.amount), 'credit');
        console.log('DEBUG - Saldo reembolsado:', parseFloat(transaction.amount));
      }

      // Reativar o empréstimo para permitir novo pagamento
      await client.query(
        'UPDATE loans SET status = $1 WHERE id = $2',
        ['APPROVED', metadata.loanId]
      );

      console.log('DEBUG - Empréstimo reativado:', metadata.loanId);

      // Atualizar status da transação para REJEITADO
      const updateResult = await updateTransactionStatus(
        client,
        transactionId,
        'PENDING',
        'REJECTED'
      );

      if (!updateResult.success) {
        throw new Error(updateResult.error);
      }

      return {
        success: true,
        loanId: metadata.loanId,
        amountRefunded: metadata.useBalance ? parseFloat(transaction.amount) : 0
      };
    });

    return c.json({
      success: true,
      message: 'Pagamento rejeitado! Empréstimo reativado para novo pagamento.',
      data: {
        transactionId,
        loanId: (result as any).loanId,
        amountRefunded: (result as any).amountRefunded
      }
    });
  } catch (error) {
    console.error('Erro ao rejeitar pagamento:', error);
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, 500);
  }
});

// Aprovar saques pendentes
adminRoutes.post('/approve-withdrawal', adminMiddleware, auditMiddleware('APPROVE_WITHDRAWAL', 'TRANSACTION'), async (c) => {
  try {
    const body = await c.req.json();
    const { transactionId } = body;

    if (!transactionId) {
      return c.json({ success: false, message: 'transactionId é obrigatório' }, 400);
    }

    const pool = getDbPool(c);

    // Executar dentro de transação para garantir consistência
    const result = await executeInTransaction(pool, async (client) => {
      // Buscar transação de saque com bloqueio
      const transactionResult = await client.query(
        'SELECT * FROM transactions WHERE id = $1 AND status = $2 FOR UPDATE',
        [transactionId, 'PENDING']
      );

      if (transactionResult.rows.length === 0) {
        throw new Error('Transação não encontrada ou já processada');
      }

      const transaction = transactionResult.rows[0];

      // Verificar se é uma transação de saque
      if (transaction.type !== 'WITHDRAWAL') {
        throw new Error('Transação não é um saque');
      }

      // Verificar se metadata já é um objeto ou precisa fazer parse
      let metadata: any = {};
      try {
        // Verificar se metadata já é um objeto
        if (transaction.metadata && typeof transaction.metadata === 'object') {
          metadata = transaction.metadata;
          console.log('DEBUG - Metadata já é objeto (saque):', metadata);
        } else {
          // Se for string, fazer parse
          const metadataStr = String(transaction.metadata || '{}').trim();
          console.log('DEBUG - Metadata da transação (saque) (string):', metadataStr);
          if (metadataStr.startsWith('{') || metadataStr.startsWith('[')) {
            metadata = JSON.parse(metadataStr);
            console.log('DEBUG - Metadata parseado (saque):', metadata);
          }
        }
      } catch (error) {
        console.error('Erro ao fazer parse do metadata (saque):', error);
        metadata = {};
      }

      const withdrawalAmount = parseFloat(transaction.amount);

      // Validações para evitar valores negativos ou cálculos incorretos
      if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
        throw new Error('Valor do saque inválido ou negativo');
      }

      // Calcular taxa de saque (2% ou R$ 5,00, o que for maior)
      const feePercentage = 0.02;
      const feeFixed = 5.00;
      const feeAmount = Math.max(withdrawalAmount * feePercentage, feeFixed);
      const netAmount = withdrawalAmount - feeAmount;

      // Validações adicionais para integridade dos valores
      if (feeAmount >= withdrawalAmount) {
        throw new Error('Taxa não pode ser maior ou igual ao valor do saque');
      }

      if (netAmount < 0) {
        throw new Error('Valor líquido do saque não pode ser negativo');
      }

      // Validar limites máximos e mínimos
      if (withdrawalAmount > 10000) {
        throw new Error('Valor máximo de saque é R$ 10.000,00');
      }

      if (netAmount < 1) {
        throw new Error('Valor líquido mínimo após taxa é R$ 1,00');
      }

      console.log('DEBUG - Aprovação de saque:', {
        transactionId,
        withdrawalAmount,
        feeAmount,
        netAmount,
        feePercentage,
        feeFixed
      });

      // Deduzir valor líquido do caixa operacional
      await client.query(
        'UPDATE system_config SET system_balance = system_balance - $1',
        [netAmount]
      );

      // Aplicar nova regra: 85% da taxa para o caixa operacional e 15% para o lucro de juros
      const feeForOperational = feeAmount * 0.85; // 85% da taxa vai para o caixa operacional
      const feeForProfit = feeAmount * 0.15; // 15% da taxa vai para o lucro de juros

      // Adicionar 85% da taxa ao caixa operacional
      await client.query(
        'UPDATE system_config SET system_balance = system_balance + $1',
        [feeForOperational]
      );

      // Adicionar 15% da taxa ao lucro de juros
      await client.query(
        'UPDATE system_config SET profit_pool = profit_pool + $1',
        [feeForProfit]
      );

      console.log('DEBUG - Distribuição de taxa de saque (nova regra 85/15):', {
        transactionId,
        withdrawalAmount,
        feeAmount,
        feeForOperational,
        feeForProfit,
        netAmount,
        totalWithdrawal: withdrawalAmount,
        timestamp: new Date().toISOString(),
        adminId: c.get('user')?.id,
        adminEmail: c.get('user')?.email
      });

      // Log de auditoria para distribuição de taxa de saque
      // Usando admin_logs que é a tabela correta e ajustando colunas
      await client.query(
        `INSERT INTO admin_logs (action, entity_id, entity_type, new_values, admin_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'WITHDRAWAL_FEE_DISTRIBUTION',
          transactionId,
          'WITHDRAWAL',
          JSON.stringify({
            withdrawalAmount,
            feeAmount,
            feeForOperational,
            feeForProfit,
            netAmount,
            distributionRule: '85% operational, 15% profit'
          }),
          c.get('user')?.id,
          new Date()
        ]
      );

      // Atualizar status da transação para APROVADO
      const updateResult = await updateTransactionStatus(
        client,
        transactionId,
        'PENDING',
        'APPROVED'
      );

      if (!updateResult.success) {
        throw new Error(updateResult.error);
      }

      console.log('DEBUG - Saque aprovado e processado:', {
        transactionId,
        netAmountDeducted: netAmount,
        feeAddedToProfit: feeAmount,
        totalWithdrawal: withdrawalAmount
      });

      return {
        success: true,
        netAmount,
        feeAmount,
        totalAmount: withdrawalAmount
      };
    });

    const finalResult = result as any;

    return c.json({
      success: true,
      message: 'Saque aprovado com sucesso! Valor líquido deduzido do caixa operacional e taxa distribuída (85% para caixa, 15% para lucro de juros).',
      data: {
        transactionId,
        netAmount: finalResult.netAmount,
        feeAmount: finalResult.feeAmount,
        feeForOperational: finalResult.feeAmount * 0.85,
        feeForProfit: finalResult.feeAmount * 0.15,
        totalAmount: finalResult.totalAmount
      }
    });
  } catch (error) {
    console.error('Erro ao aprovar saque:', error);
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, 500);
  }
});

// Rejeitar saques pendentes
adminRoutes.post('/reject-withdrawal', adminMiddleware, auditMiddleware('REJECT_WITHDRAWAL', 'TRANSACTION'), async (c) => {
  try {
    const body = await c.req.json();
    const { transactionId } = body;

    if (!transactionId) {
      return c.json({ success: false, message: 'transactionId é obrigatório' }, 400);
    }

    const pool = getDbPool(c);

    // Executar dentro de transação para garantir consistência
    const result = await executeInTransaction(pool, async (client) => {
      // Buscar transação de saque com bloqueio
      const transactionResult = await client.query(
        'SELECT * FROM transactions WHERE id = $1 AND status = $2 FOR UPDATE',
        [transactionId, 'PENDING']
      );

      if (transactionResult.rows.length === 0) {
        throw new Error('Transação não encontrada ou já processada');
      }

      const transaction = transactionResult.rows[0];

      // Verificar se é uma transação de saque
      if (transaction.type !== 'WITHDRAWAL') {
        throw new Error('Transação não é um saque');
      }

      // Reembolsar o cliente (devolver o valor ao saldo do cliente)
      await updateUserBalance(client, transaction.user_id, parseFloat(transaction.amount), 'credit');

      console.log('DEBUG - Saldo reembolsado (rejeição de saque):', parseFloat(transaction.amount));

      // Atualizar status da transação para REJEITADO
      const updateResult = await updateTransactionStatus(
        client,
        transactionId,
        'PENDING',
        'REJECTED'
      );

      if (!updateResult.success) {
        throw new Error(updateResult.error);
      }

      return {
        success: true,
        amountRefunded: parseFloat(transaction.amount)
      };
    });

    return c.json({
      success: true,
      message: 'Saque rejeitado! Valor reembolsado na conta do cliente.',
      data: {
        transactionId,
        amountRefunded: (result as any).amountRefunded
      }
    });
  } catch (error) {
    console.error('Erro ao rejeitar saque:', error);
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, 500);
  }
});

// Rota temporária para limpar administradores
adminRoutes.post('/clear-admins', adminMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);

    // Limpar todos os administradores existentes
    await pool.query('UPDATE users SET is_admin = FALSE WHERE is_admin = TRUE');

    return c.json({
      success: true,
      message: 'Todos os administradores foram removidos. O próximo usuário a se registrar será o administrador.'
    });
  } catch (error) {
    console.error('Erro ao limpar administradores:', error);
    return c.json({
      success: false,
      message: 'Erro ao limpar administradores'
    }, 500);
  }
});



// Simular aprovação de pagamento via Mercado Pago (Apenas Sandbox)
adminRoutes.post('/simulate-mp-payment', adminMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { paymentId, transactionId } = simulateMpSchema.parse(body);

    console.log(`[ADMIN] Simulando aprovação MP para Pagamento ${paymentId}, Transação ${transactionId}`);

    // 1. Tentar aprovar no Mercado Pago de verdade (só funciona em Sandbox)
    try {
      await simulatePaymentApproval(parseInt(paymentId));
      console.log(`[ADMIN] Status atualizado no Mercado Pago para 'approved'`);
    } catch (mpError: any) {
      console.warn(`[ADMIN] Aviso: Não foi possível atualizar no Mercado Pago: ${mpError.message}`);
    }

    // 2. Forçar aprovação interna (mesma lógica do Webhook)
    const pool = getDbPool(c);
    const result = await executeInTransaction(pool, async (client: PoolClient) => {
      return await processTransactionApproval(client, transactionId, 'APPROVE');
    });

    if (!result.success) {
      return c.json({ success: false, message: result.error || 'Erro ao processar aprovação interna' }, 400);
    }

    return c.json({
      success: true,
      message: 'Simulação realizada com sucesso! Transação aprovada e Mercado Pago atualizado.'
    });

  } catch (error: any) {
    console.error('Erro na simulação administrativa:', error);
    return c.json({ success: false, message: error.message || 'Erro interno do servidor' }, 500);
  }
});

// Adicionar custo manual ao sistema
adminRoutes.post('/manual-cost', adminMiddleware, auditMiddleware('ADD_MANUAL_COST', 'SYSTEM_CONFIG'), async (c) => {
  try {
    const body = await c.req.json();
    const amount = parseFloat(body.amount);

    if (isNaN(amount) || amount <= 0) {
      return c.json({ success: false, message: 'Valor inválido' }, 400);
    }

    const pool = getDbPool(c);

    await executeInTransaction(pool, async (client) => {
      // 1. Deduzir do caixa operacional e adicionar aos custos manuais
      await client.query(
        'UPDATE system_config SET system_balance = system_balance - $1, total_manual_costs = total_manual_costs + $1',
        [amount]
      );

      // 2. Registrar no log de auditoria
      const user = c.get('user');
      await client.query(
        `INSERT INTO admin_logs (admin_id, action, entity_type, new_values, created_at)
         VALUES ($1, 'MANUAL_COST_ADD', 'SYSTEM_CONFIG', $2, $3)`,
        [user.id, JSON.stringify({ addedCost: amount, description: body.description || 'Custo manual' }), new Date()]
      );
    });

    return c.json({
      success: true,
      message: `Custo de R$ ${amount.toFixed(2)} registrado com sucesso e deduzido do caixa operacional.`,
      data: { addedCost: amount }
    });
  } catch (error) {
    console.error('Erro ao adicionar custo manual:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Liquidar empréstimo usando as cotas do usuário como garantia (Exercer Garantia)
adminRoutes.post('/liquidate-loan', adminMiddleware, auditMiddleware('LIQUIDATE_LOAN_WITH_QUOTAS', 'LOAN'), async (c) => {
  try {
    const body = await c.req.json();
    const { loanId } = body;

    if (!loanId) {
      return c.json({ success: false, message: 'ID do empréstimo é obrigatório' }, 400);
    }

    const pool = getDbPool(c);

    const result = await executeInTransaction(pool, async (client) => {
      // 1. Buscar empréstimo
      const loanRes = await client.query('SELECT * FROM loans WHERE id = $1 FOR UPDATE', [loanId]);
      if (loanRes.rows.length === 0) throw new Error('Empréstimo não encontrado');
      const loan = loanRes.rows[0];

      if (loan.status === 'PAID') throw new Error('Empréstimo já está quitado');

      // 2. Calcular quanto o usuário deve (Total - já pago)
      const paidRes = await client.query('SELECT COALESCE(SUM(amount), 0) as total FROM loan_installments WHERE loan_id = $1', [loanId]);
      const debtAmount = parseFloat(loan.total_repayment) - parseFloat(paidRes.rows[0].total);

      // 3. Buscar cotas ativas do usuário para liquidar
      const quotasRes = await client.query('SELECT id, current_value FROM quotas WHERE user_id = $1 AND status = $2 FOR UPDATE', [loan.user_id, 'ACTIVE']);
      const userQuotas = quotasRes.rows;

      let liquidatedValue = 0;
      const quotasToLiquidate = [];

      for (const q of userQuotas) {
        if (liquidatedValue < debtAmount) {
          liquidatedValue += parseFloat(q.current_value);
          quotasToLiquidate.push(q.id);
        }
      }

      if (liquidatedValue === 0) throw new Error('Usuário não possui cotas ativas para garantir a dívida');

      // 4. Executar a liquidação
      // Deletar as cotas (elas voltam para o sistema como caixa)
      if (quotasToLiquidate.length > 0) {
        await client.query('DELETE FROM quotas WHERE id = ANY($1)', [quotasToLiquidate]);
      }

      // Devolver o principal ao caixa do sistema
      await client.query('UPDATE system_config SET system_balance = system_balance + $1', [liquidatedValue]);

      // Marcar empréstimo como PAGO (Integral ou parcial dependendo do valor)
      const newStatus = liquidatedValue >= debtAmount ? 'PAID' : loan.status;
      await client.query('UPDATE loans SET status = $1 WHERE id = $2', [newStatus, loanId]);

      // Registrar transação de liquidação forçada
      const admin = c.get('user');
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
         VALUES ($1, 'SYSTEM_LIQUIDATION', $2, $3, 'APPROVED', $4)`,
        [
          loan.user_id,
          liquidatedValue,
          `Liquidação forçada de ${quotasToLiquidate.length} cota(s) para quitar empréstimo ${loanId}`,
          JSON.stringify({ adminId: admin.id, loanId, quotasCount: quotasToLiquidate.length })
        ]
      );

      return { success: true, liquidatedValue, isFullyPaid: newStatus === 'PAID' };
    });

    return c.json(result);
  } catch (error: any) {
    console.error('Erro ao liquidar empréstimo:', error);
    return c.json({ success: false, message: error.message || 'Erro interno' }, 500);
  }
});

// --- GESTÃO DE CÓDIGOS DE INDICAÇÃO (REFERRAL CODES) ---

// Listar todos os códigos
adminRoutes.get('/referral-codes', adminMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);
    const result = await pool.query(`
      SELECT rc.*, u.name as creator_name 
      FROM referral_codes rc
      LEFT JOIN users u ON rc.created_by = u.id
      ORDER BY rc.created_at DESC
    `);
    return c.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao listar códigos de indicação:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Criar novo código
adminRoutes.post('/referral-codes', adminMiddleware, auditMiddleware('CREATE_REFERRAL_CODE', 'REFERRAL_CODE'), async (c) => {
  try {
    const body = await c.req.json();
    const { code, maxUses } = createReferralCodeSchema.parse(body);
    const user = c.get('user');
    const pool = getDbPool(c);

    const result = await pool.query(
      'INSERT INTO referral_codes (code, created_by, max_uses) VALUES ($1, $2, $3) RETURNING *',
      [code, user.id, maxUses]
    );

    return c.json({
      success: true,
      message: 'Código de indicação criado com sucesso!',
      data: result.rows[0]
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return c.json({ success: false, message: 'Este código já existe. Escolha outro.' }, 409);
    }
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }
    console.error('Erro ao criar código de indicação:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Ativar/Desativar código
adminRoutes.post('/referral-codes/:id/toggle', adminMiddleware, auditMiddleware('TOGGLE_REFERRAL_CODE', 'REFERRAL_CODE'), async (c) => {
  try {
    const id = c.req.param('id');
    const pool = getDbPool(c);

    const result = await pool.query(
      'UPDATE referral_codes SET is_active = NOT is_active WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Código não encontrado' }, 404);
    }

    return c.json({
      success: true,
      message: `Código ${result.rows[0].is_active ? 'ativado' : 'desativado'} com sucesso!`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao toggle código de indicação:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

adminRoutes.delete('/referral-codes/:id', adminMiddleware, auditMiddleware('DELETE_REFERRAL_CODE', 'REFERRAL_CODE'), async (c) => {
  try {
    const id = c.req.param('id');
    const pool = getDbPool(c);
    const result = await pool.query('DELETE FROM referral_codes WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Código não encontrado' }, 404);
    }

    return c.json({ success: true, message: 'Código removido com sucesso!' });
  } catch (error) {
    console.error('Erro ao remover código de indicação:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Resolver Disputa de Marketplace
const resolveDisputeSchema = z.object({
  orderId: z.number(),
  resolution: z.enum(['REFUND_BUYER', 'RELEASE_TO_SELLER']),
  penaltyUserId: z.number().optional(), // Usuário que agiu de má fé para perder score
});

adminRoutes.post('/marketplace/resolve-dispute', adminMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { orderId, resolution, penaltyUserId } = resolveDisputeSchema.parse(body);
    const pool = getDbPool(c);

    // 1. Buscar o pedido em disputa
    const orderRes = await pool.query('SELECT * FROM marketplace_orders WHERE id = $1 AND status = \'DISPUTE\'', [orderId]);
    if (orderRes.rows.length === 0) return c.json({ success: false, message: 'Disputa não encontrada.' }, 404);
    const order = orderRes.rows[0];

    const result = await executeInTransaction(pool, async (client) => {
      if (resolution === 'REFUND_BUYER') {
        // Estornar Comprador (Igual ao cancelamento)
        await client.query('UPDATE marketplace_orders SET status = \'CANCELLED\', updated_at = NOW() WHERE id = $1', [orderId]);
        await client.query('UPDATE marketplace_listings SET status = \'ACTIVE\' WHERE id = $1', [order.listing_id]);

        if (order.payment_method === 'BALANCE') {
          await updateUserBalance(client, order.buyer_id, parseFloat(order.amount), 'credit');
          await createTransaction(client, order.buyer_id, 'MARKET_REFUND', parseFloat(order.amount), `Disputa Resolvida: Estorno do Pedido #${orderId}`, 'APPROVED');
        } else if (order.payment_method === 'CRED30_CREDIT') {
          await client.query("UPDATE loans SET status = 'CANCELLED' WHERE status = 'APPROVED' AND metadata->>'orderId' = $1", [orderId.toString()]);
        }
      } else {
        // Liberar para o Vendedor (Igual à finalização)
        await client.query('UPDATE marketplace_orders SET status = \'COMPLETED\', updated_at = NOW() WHERE id = $1', [orderId]);

        const sellerAmount = parseFloat(order.seller_amount);
        if (order.payment_method === 'CRED30_CREDIT') {
          await client.query('UPDATE system_config SET system_balance = system_balance - $1', [order.amount]);
        }
        await updateUserBalance(client, order.seller_id, sellerAmount, 'credit');

        // Taxas
        const feeAmount = parseFloat(order.fee_amount);
        await client.query('UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2', [feeAmount * 0.85, feeAmount * 0.15]);

        await createTransaction(client, order.seller_id, 'MARKET_SALE', sellerAmount, `Disputa Resolvida: Venda #${orderId} Liberada`, 'APPROVED', { orderId });
      }

      // Aplicar Penalidade se houver culpado claro
      if (penaltyUserId) {
        await updateScore(client, penaltyUserId, -100, `Penalidade: Má fé em disputa de marketplace (#${orderId})`);
      }

      return { success: true };
    });

    return c.json({ success: true, message: `Disputa resolvida: ${resolution}` });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Forçar Liquidação Automática
adminRoutes.post('/run-liquidation', adminMiddleware, auditMiddleware('FORCE_LIQUIDATION', 'LOAN'), async (c) => {
  try {
    const pool = getDbPool(c);
    const result = await runAutoLiquidation(pool);
    return c.json({
      success: true,
      message: `Varredura concluída. ${result.liquidatedCount} garantias executadas.`,
      data: result
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Registrar Custo Manual (Despesa)
adminRoutes.post('/manual-cost', adminMiddleware, auditMiddleware('RECORD_MANUAL_COST', 'SYSTEM_CONFIG'), async (c) => {
  try {
    const body = await c.req.json();
    const { amount, description } = z.object({ amount: z.number().positive(), description: z.string() }).parse(body);
    const pool = getDbPool(c);

    await pool.query(
      'UPDATE system_config SET system_balance = system_balance - $1, total_manual_costs = total_manual_costs + $1',
      [amount]
    );

    return c.json({ success: true, message: 'Custo registrado e deduzido do caixa.' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// --- GESTÃO DE USUÁRIOS E EQUIPE (MODO FINTECH) ---

const updateUserRoleStatusSchema = z.object({
  userId: z.number(),
  role: z.enum(['MEMBER', 'ATTENDANT', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'BLOCKED']).optional()
});

const createAttendantSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  secretPhrase: z.string().min(3),
  pixKey: z.string().min(5)
});

// Listar todos os usuários com filtros
adminRoutes.get('/users', adminMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);
    const { search, role, status } = c.req.query();

    let query = `
      SELECT id, name, email, role, status, balance, score, created_at, pix_key
      FROM users
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);
    return c.json({ success: true, data: result.rows });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Atualizar Role ou Status de um usuário
adminRoutes.post('/users/update-access', adminMiddleware, auditMiddleware('UPDATE_USER_ACCESS', 'USER'), async (c) => {
  try {
    const body = await c.req.json();
    const { userId, role, status } = updateUserRoleStatusSchema.parse(body);
    const pool = getDbPool(c);

    const updateFields = [];
    const params = [];
    let index = 1;

    if (role) {
      updateFields.push(`role = $${index++}`);
      params.push(role);
    }
    if (status) {
      updateFields.push(`status = $${index++}`);
      params.push(status);
    }

    if (updateFields.length === 0) {
      return c.json({ success: false, message: 'Nenhuma alteração fornecida' }, 400);
    }

    params.push(userId);
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${index} RETURNING id`;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
    }

    return c.json({ success: true, message: 'Permissões atualizadas com sucesso' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Criar um novo atendente diretamente
adminRoutes.post('/users/create-attendant', adminMiddleware, auditMiddleware('CREATE_ATTENDANT', 'USER'), async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, password, secretPhrase, pixKey } = createAttendantSchema.parse(body);
    const pool = getDbPool(c);
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, secret_phrase, pix_key, role, status)
       VALUES ($1, $2, $3, $4, $5, 'ATTENDANT', 'ACTIVE') RETURNING id`,
      [name, email, passwordHash, secretPhrase, pixKey]
    );

    return c.json({ success: true, message: 'Atendente criado com sucesso', data: { id: result.rows[0].id } });
  } catch (error: any) {
    if (error.code === '23505') {
      return c.json({ success: false, message: 'Email já cadastrado' }, 409);
    }
    return c.json({ success: false, message: error.message }, 500);
  }
});

export { adminRoutes };

