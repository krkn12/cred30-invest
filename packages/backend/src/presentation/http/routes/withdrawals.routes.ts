import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, updateUserBalance, createTransaction } from '../../../domain/services/transaction.service';
import { emailService } from '../../../infrastructure/gateways/email.service';

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

    // Calcular taxa de saque: se o valor da cota for maior que o saque, o saque é grátis
    let feeAmount = 0;
    if (totalQuotaValue < amount) {
      const feePercentage = 0.02;
      const feeFixed = 5.00;
      feeAmount = Math.max(amount * feePercentage, feeFixed);
    }
    const netAmount = amount - feeAmount;

    // Buscar empréstimos aprovados do cliente
    const loansResult = await pool.query(
      `SELECT COALESCE(SUM(total_repayment), 0) as total_loan_amount
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
      // Gerar código de confirmação
      const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Criar transação de saque pendente de confirmação
      const transactionResult = await createTransaction(
        client,
        user.id,
        'WITHDRAWAL',
        amount,
        `Solicitação de Saque - R$ ${netAmount.toFixed(2)} (Taxa: R$ ${feeAmount.toFixed(2)})`,
        'PENDING_CONFIRMATION', // Novo status
        {
          pixKey,
          feeAmount,
          netAmount,
          totalLoanAmount,
          availableCredit,
          type: 'CREDIT_WITHDRAWAL',
          confirmationCode // Guardar código no metadata
        }
      );

      if (!transactionResult.success) {
        throw new Error(transactionResult.error);
      }

      // Enviar email (fora da transação para não bloquear, mas aqui é difícil se falhar. 
      // Idealmente seria fila, mas vamos chamar direto e logar erro se falhar)
      // O catch do transaction rollback não pega isso pois é async sem await se quisermos, 
      // mas aqui vamos dar await para garantir envio
      await emailService.sendWithdrawalToken(user.email, confirmationCode, amount);

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
      message: 'Solicitação enviada! Verifique seu email para confirmar o saque.',
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
    const metadata = transaction.metadata || {};

    if (metadata.confirmationCode !== code) {
      return c.json({ success: false, message: 'Código de confirmação inválido' }, 400);
    }

    // Atualizar status para PENDING (para admin ver)
    // Remover código do metadata por segurança (opcional, mas bom)
    const newMetadata = { ...metadata };
    delete newMetadata.confirmationCode;

    await pool.query(
      `UPDATE transactions 
       SET status = 'PENDING', metadata = $1 
       WHERE id = $2`,
      [newMetadata, transactionId]
    );

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
      `SELECT COALESCE(SUM(total_repayment), 0) as total_loan_amount
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