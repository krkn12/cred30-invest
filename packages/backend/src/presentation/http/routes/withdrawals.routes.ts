import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, updateUserBalance, createTransaction } from '../../../domain/services/transaction.service';
import { WITHDRAWAL_FIXED_FEE } from '../../../shared/constants/business.constants';
import { twoFactorService } from '../../../application/services/two-factor.service';
import { notificationService } from '../../../application/services/notification.service';
import { calculateUserLoanLimit } from '../../../application/services/credit-analysis.service';

const withdrawalRoutes = new Hono();

// Esquema de validação para solicitação de saque
const withdrawalSchema = z.object({
  amount: z.number().positive(),
  pixKey: z.string().min(5),
});

const confirmWithdrawalSchema = z.object({
  transactionId: z.number(),
  code: z.string().length(6),
});

// Solicitar saque (usando limite de crédito)
withdrawalRoutes.post('/request', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { amount, pixKey } = withdrawalSchema.parse(body);

    const user = c.get('user');
    const pool = getDbPool(c);

    // Buscar valor total de cotas ativas do cliente
    const quotasResult = await pool.query(
      "SELECT COALESCE(SUM(current_value), 0) as total_quota_value FROM quotas WHERE user_id = $1 AND status = 'ACTIVE'",
      [user.id]
    );
    const totalQuotaValue = parseFloat(quotasResult.rows[0].total_quota_value);

    // Calcular taxa de saque (Caixa da Cooperativa)
    // Todos pagam a taxa fixa de R$ 2.00 para manutenção
    // Quem NÃO tem cotas paga +2% ou R$ 5.00 (o que for maior)
    let feeAmount = WITHDRAWAL_FIXED_FEE;

    if (totalQuotaValue < amount) {
      const feePercentage = 0.02;
      const feeFixed = 5.00;
      const extraFee = Math.max(amount * feePercentage, feeFixed);
      feeAmount += extraFee;
    }

    const netAmount = amount - feeAmount;

    // Buscar empréstimos aprovados do cliente
    const loansResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_loan_amount
       FROM loans 
       WHERE user_id = $1 AND status IN ('APPROVED', 'PAYMENT_PENDING')`,
      [user.id]
    );

    // Buscar saques já aprovados do cliente
    const withdrawalsResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_withdrawn
       FROM transactions 
       WHERE user_id = $1 AND type = 'WITHDRAWAL' AND status = 'APPROVED'`,
      [user.id]
    );

    const totalLoanAmount = parseFloat(loansResult.rows[0].total_loan_amount);
    const totalWithdrawnAmount = parseFloat(withdrawalsResult.rows[0].total_withdrawn);
    const availableCredit = totalLoanAmount - totalWithdrawnAmount;

    // 4. VERIFICAÇÃO DE LIQUIDEZ DO SISTEMA (TRAVA ANTIFALÊNCIA)
    const systemQuotasRes = await pool.query("SELECT COUNT(*) as count FROM quotas WHERE status = 'ACTIVE'");
    const systemActiveLoansRes = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')");

    const systemQuotasCount = parseInt(systemQuotasRes.rows[0].count);
    const systemTotalLoaned = parseFloat(systemActiveLoansRes.rows[0].total);
    const systemGrossCash = systemQuotasCount * 50; // Preço fixo da cota

    // Liquidez Real = O que tem no "pote" agora
    const realLiquidity = systemGrossCash - systemTotalLoaned;

    if (amount > realLiquidity) {
      return c.json({
        success: false,
        message: 'O sistema atingiu o limite de saques diários por falta de liquidez momentânea. Tente novamente em 24h ou entre em contato com o suporte.',
        errorCode: 'LOW_LIQUIDITY'
      }, 400);
    }

    // Validar se o cliente tem limite disponível
    if (amount > availableCredit) {
      return c.json({
        success: false,
        message: `Limite indisponível. Seu limite disponível é R$ ${availableCredit.toFixed(2)}`,
        data: {
          availableCredit,
          requestedAmount: amount,
          totalLoanAmount,
          totalWithdrawnAmount
        }
      }, 400);
    }

    // Executar dentro de transação para consistência
    const result = await executeInTransaction(pool, async (client) => {
      // 1. DEBITAR SALDO IMEDIATAMENTE (Trava de Double Spending)
      const balanceDebit = await updateUserBalance(client, user.id, amount, 'debit');
      if (!balanceDebit.success) {
        throw new Error(balanceDebit.error || 'Saldo insuficiente para este saque.');
      }

      // 2. Criar transação de saque pendente de confirmação
      const transactionResult = await createTransaction(
        client,
        user.id,
        'WITHDRAWAL',
        amount,
        `Solicitação de Saque - R$ ${netAmount.toFixed(2)} (Taxa: R$ ${feeAmount.toFixed(2)})`,
        'PENDING_CONFIRMATION',
        {
          pixKey,
          feeAmount,
          netAmount,
          totalLoanAmount,
          availableCredit,
          type: 'CREDIT_WITHDRAWAL',
          balanceDeducted: true
        }
      );

      if (!transactionResult.success) {
        throw new Error(transactionResult.error);
      }

      return {
        transactionId: transactionResult.transactionId,
        amount,
        feeAmount,
        netAmount,
        availableCredit
      };
    });

    return c.json({
      success: true,
      message: 'Solicitação criada! Use seu autenticador para confirmar o saque.',
      data: {
        transactionId: result.data?.transactionId,
        amount: result.data?.amount,
        feeAmount: result.data?.feeAmount,
        netAmount: result.data?.netAmount,
        availableCredit: result.data?.availableCredit,
        pixKey,
        requiresConfirmation: true
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }

    console.error('Erro ao solicitar saque:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Confirmar saque
withdrawalRoutes.post('/confirm', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { transactionId, code } = confirmWithdrawalSchema.parse(body);
    const user = c.get('user');
    const pool = getDbPool(c);

    const result = await pool.query(
      `SELECT id, metadata, status FROM transactions 
       WHERE id = $1 AND user_id = $2 AND status = 'PENDING_CONFIRMATION'`,
      [transactionId, user.id]
    );

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Solicitação não encontrada ou já confirmada' }, 404);
    }

    const transaction = result.rows[0];

    // Buscar segredo 2FA do usuário no banco
    const userResult = await pool.query('SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1', [user.id]);
    const userData = userResult.rows[0];

    if (!userData.two_factor_enabled) {
      return c.json({ success: false, message: 'Autenticação de 2 fatores não está ativada na sua conta' }, 400);
    }

    const isValid = twoFactorService.verifyToken(code, userData.two_factor_secret);

    if (!isValid) {
      return c.json({ success: false, message: 'Código do autenticador inválido' }, 400);
    }

    // Atualizar status para PENDING (para admin ver)
    await pool.query(
      `UPDATE transactions 
       SET status = 'PENDING'
       WHERE id = $1`,
      [transactionId]
    );

    // Notificar Admin
    const amountRequested = parseFloat(transaction.metadata.amount || 0);
    await notificationService.notifyNewWithdrawal(user.name, amountRequested);

    return c.json({
      success: true,
      message: 'Saque confirmado e enviado para aprovação!'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos' }, 400);
    }
    console.error('Erro ao confirmar saque:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Listar saques do usuário
withdrawalRoutes.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const pool = getDbPool(c);

    // Buscar saques do usuário
    const result = await pool.query(
      `SELECT id, amount, status, description, created_at, metadata
       FROM transactions 
       WHERE user_id = $1 AND type = 'WITHDRAWAL'
       ORDER BY created_at DESC`,
      [user.id]
    );

    // Formatar saques para resposta
    const formattedWithdrawals = result.rows.map(withdrawal => ({
      id: withdrawal.id,
      amount: parseFloat(withdrawal.amount),
      status: withdrawal.status,
      description: withdrawal.description,
      requestDate: new Date(withdrawal.created_at).getTime(),
      metadata: withdrawal.metadata
    }));

    return c.json({
      success: true,
      data: {
        withdrawals: formattedWithdrawals,
      },
    });
  } catch (error) {
    console.error('Erro ao listar saques:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Buscar limite de crédito disponível
withdrawalRoutes.get('/credit-limit', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const pool = getDbPool(c);

    // Buscar empréstimos aprovados do cliente
    const loansResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_loan_amount
       FROM loans 
       WHERE user_id = $1 AND status IN ('APPROVED', 'PAYMENT_PENDING')`,
      [user.id]
    );

    // Buscar saques já aprovados do cliente
    const withdrawalsResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_withdrawn
       FROM transactions 
       WHERE user_id = $1 AND type = 'WITHDRAWAL' AND status = 'APPROVED'`,
      [user.id]
    );

    const totalLoanAmount = parseFloat(loansResult.rows[0].total_loan_amount);
    const totalWithdrawnAmount = parseFloat(withdrawalsResult.rows[0].total_withdrawn);
    const availableCredit = totalLoanAmount - totalWithdrawnAmount;
    const creditUtilizationRate = totalLoanAmount > 0 ? (totalWithdrawnAmount / totalLoanAmount) * 100 : 0;

    return c.json({
      success: true,
      data: {
        totalLoanAmount,
        totalWithdrawnAmount,
        availableCredit,
        creditUtilizationRate,
        hasCreditAvailable: availableCredit > 0
      },
    });
  } catch (error) {
    console.error('Erro ao buscar limite de crédito:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

export { withdrawalRoutes };