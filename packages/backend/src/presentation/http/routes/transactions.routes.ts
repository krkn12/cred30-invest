import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { Transaction } from '../../../domain/entities/transaction.entity';
import { UserContext } from '../../../shared/types/hono.types';
import { executeInTransaction, lockUserBalance, updateUserBalance, createTransaction } from '../../../domain/services/transaction.service';
import { financialRateLimit } from '../middleware/rate-limit.middleware';

const transactionRoutes = new Hono();

// Aplicar rate limiting a operações financeiras
transactionRoutes.use('/withdraw', financialRateLimit);

// Esquema de validação para saque
const withdrawSchema = z.object({
  amount: z.number().positive(),
  pixKey: z.string().min(5),
});

// Listar transações do usuário
transactionRoutes.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // Buscar transações do usuário
    const result = await pool.query(
      `SELECT t.id, t.user_id, t.type, t.amount, t.description, t.status, t.metadata, t.created_at as date,
              u.name as user_name, u.email as user_email
       FROM transactions t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC`,
      [user.id]
    );

    // Formatar transações para resposta
    const formattedTransactions = result.rows.map(transaction => {
      const transactionDate = new Date(transaction.date);
      // Ajustar para fuso horário de Brasília (UTC-3)
      const brasiliaDate = new Date(transactionDate.getTime() - (3 * 60 * 60 * 1000));

      return {
        id: transaction.id,
        userId: transaction.user_id, // Adicionado campo userId
        type: transaction.type,
        amount: parseFloat(transaction.amount),
        date: brasiliaDate.getTime(),
        description: transaction.description,
        status: transaction.status,
        metadata: transaction.metadata,
        user_name: transaction.user_name,
        user_email: transaction.user_email,
      };
    });

    return c.json({
      success: true,
      data: {
        transactions: formattedTransactions,
      },
    });
  } catch (error) {
    console.error('Erro ao listar transações:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Solicitar saque
transactionRoutes.post('/withdraw', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { amount, pixKey } = withdrawSchema.parse(body);

    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // Validar valor mínimo e máximo
    if (amount <= 0) {
      return c.json({
        success: false,
        message: 'Valor deve ser maior que zero'
      }, 400);
    }

    if (amount > 10000) {
      return c.json({
        success: false,
        message: 'Valor máximo por saque é R$ 10.000,00'
      }, 400);
    }

    // Buscar valor total de cotas ativas do cliente
    const quotasResult = await pool.query(
      "SELECT COALESCE(SUM(current_value), 0) as total_quota_value FROM quotas WHERE user_id = $1 AND status = 'ACTIVE'",
      [user.id]
    );
    const totalQuotaValue = parseFloat(quotasResult.rows[0].total_quota_value);

    // Calcular taxa de saque: se o valor da cota for maior que o saque, o saque é grátis
    let fee = 0;
    if (totalQuotaValue < amount) {
      fee = Math.max(5, amount * 0.02);
    }
    const netAmount = amount - fee;

    // Executar operação dentro de transação ACID
    const result = await executeInTransaction(pool, async (client) => {
      // Verificar e bloquear saldo
      const balanceCheck = await lockUserBalance(client, user.id, amount);
      if (!balanceCheck.success) {
        throw new Error(balanceCheck.error);
      }

      // Deduzir saldo do usuário
      const updateResult = await updateUserBalance(client, user.id, amount, 'debit');
      if (!updateResult.success) {
        throw new Error(updateResult.error);
      }

      // Adicionar taxa ao lucro de juros do sistema
      await client.query(
        'UPDATE system_config SET profit_pool = profit_pool + $1',
        [fee]
      );

      // Criar transação de saque com informações detalhadas
      const transactionResult = await createTransaction(
        client,
        user.id,
        'WITHDRAWAL',
        amount,
        `Solicitação de Saque (${pixKey})`,
        'PENDING',
        {
          pixKey,
          fee: fee,
          netAmount: netAmount,
          totalAmount: amount
        }
      );

      if (!transactionResult.success) {
        throw new Error(transactionResult.error);
      }

      return {
        transactionId: transactionResult.transactionId,
        newBalance: updateResult.newBalance,
        fee: fee,
        netAmount: netAmount
      };
    });

    if (!result.success) {
      return c.json({
        success: false,
        message: result.error
      }, 400);
    }

    return c.json({
      success: true,
      message: 'Saque solicitado com sucesso! Aguarde processamento.',
      data: {
        transactionId: result.data?.transactionId,
        newBalance: result.data?.newBalance,
        fee: result.data?.fee,
        netAmount: result.data?.netAmount,
        message: `Taxa de R$ ${result.data?.fee.toFixed(2)} adicionada ao lucro de juros. Valor a ser transferido: R$ ${result.data?.netAmount.toFixed(2)}`
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }

    return c.json({ success: false, message: error instanceof Error ? error.message : 'Erro interno do servidor' }, 500);
  }
});

// Obter saldo do usuário
transactionRoutes.get('/balance', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;

    return c.json({
      success: true,
      data: {
        balance: user.balance,
      },
    });
  } catch (error) {
    console.error('Erro ao obter saldo:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

export { transactionRoutes };