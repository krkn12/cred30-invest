import { Pool, PoolClient } from 'pg';
import { QUOTA_PRICE } from '../../shared/constants/business.constants';
import { calculateGatewayCost } from '../../shared/utils/financial.utils';
import { updateScore, SCORE_REWARDS } from '../../application/services/score.service';
import { logAudit } from '../../application/services/audit.service';
import { notificationService } from '../../application/services/notification.service';
import { calculateUserLoanLimit } from '../../application/services/credit-analysis.service';

export interface TransactionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Executa uma operação dentro de uma transação database ACID
 */
export async function executeInTransaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>
): Promise<TransactionResult<T>> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await operation(client);

    await client.query('COMMIT');

    return {
      success: true,
      data: result
    };
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Erro na transação:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido na transação'
    };
  } finally {
    client.release();
  }
}

/**
 * Verifica e bloqueia saldo do usuário para operação
 */
export async function lockUserBalance(
  client: PoolClient,
  userId: string,
  amount: number
): Promise<{ success: boolean; currentBalance?: number; error?: string }> {
  try {
    const result = await client.query(
      'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    const currentBalance = parseFloat(result.rows[0].balance);

    if (currentBalance < amount) {
      return {
        success: false,
        currentBalance,
        error: `Saldo insuficiente. Saldo atual: R$ ${currentBalance.toFixed(2)}`
      };
    }

    return { success: true, currentBalance };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao verificar saldo'
    };
  }
}

/**
 * Bloqueia e retorna as configurações globais do sistema para atualização atômica
 */
export async function lockSystemConfig(client: PoolClient) {
  const result = await client.query('SELECT * FROM system_config FOR UPDATE');
  return result.rows[0];
}

/**
 * Atualiza saldo do usuário de forma segura
 */
export async function updateUserBalance(
  client: PoolClient,
  userId: string,
  amount: number,
  operation: 'debit' | 'credit' = 'debit'
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const query = operation === 'debit'
      ? 'UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING balance'
      : 'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance';

    const result = await client.query(query, [amount, userId]);

    if (result.rows.length === 0) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    const newBalance = parseFloat(result.rows[0].balance);

    if (newBalance < 0) {
      throw new Error('Saldo negativo não permitido');
    }

    return { success: true, newBalance };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao atualizar saldo'
    };
  }
}

/**
 * Cria registro de transação com validação
 */
export async function createTransaction(
  client: PoolClient,
  userId: string,
  type: string,
  amount: number,
  description: string,
  status: string = 'PENDING',
  metadata?: any
): Promise<{ success: boolean; transactionId?: number; error?: string }> {
  try {
    const result = await client.query(
      `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [userId, type, amount, description, status, metadata ? JSON.stringify(metadata) : null]
    );

    return {
      success: true,
      transactionId: result.rows[0].id
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao criar transação'
    };
  }
}

/**
 * Atualiza status de transação com validação de concorrência
 */
export async function updateTransactionStatus(
  client: PoolClient,
  transactionId: string | number,
  currentStatus: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await client.query(
      'UPDATE transactions SET status = $1 WHERE id = $2 AND status = $3',
      [newStatus, transactionId, currentStatus]
    );

    if (result.rowCount === 0) {
      return {
        success: false,
        error: 'Transação não encontrada ou já foi processada'
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao atualizar transação'
    };
  }
}

/**
 * Processa a aprovação ou rejeição de uma transação (BUY_QUOTA, WITHDRAWAL, etc)
 */
export const processTransactionApproval = async (client: PoolClient, id: string, action: 'APPROVE' | 'REJECT') => {
  // 1. Buscar transação com bloqueio
  const transactionResult = await client.query(
    'SELECT * FROM transactions WHERE id = $1 AND status = $2 FOR UPDATE',
    [id, 'PENDING']
  );

  if (transactionResult.rows.length === 0) {
    throw new Error('Transação não encontrada ou já processada');
  }

  const transaction = transactionResult.rows[0];

  if (action === 'REJECT') {
    // Saques não debitam saldo na solicitação (usam limite de crédito), 
    // portanto não há saldo para devolver nem caixa operacional para ajustar na rejeição.
    if (transaction.type === 'WITHDRAWAL') {
      // Devolver saldo ao usuário caso o saque seja rejeitado
      await updateUserBalance(client, transaction.user_id, Math.abs(parseFloat(transaction.amount)), 'credit');
      console.log(`[REJECT_WITHDRAWAL] R$ ${transaction.amount} devolvidos ao usuário ${transaction.user_id}`);
    }

    if (transaction.type === 'BUY_QUOTA') {
      const metadata = transaction.metadata || {};
      if (metadata.useBalance) {
        await updateUserBalance(client, transaction.user_id, parseFloat(transaction.amount), 'credit');
      }
    }

    if (transaction.type === 'LOAN_PAYMENT') {
      const metadata = transaction.metadata || {};
      if (metadata.useBalance && metadata.loanId) {
        await updateUserBalance(client, transaction.user_id, parseFloat(transaction.amount), 'credit');
        await client.query('UPDATE loans SET status = $1 WHERE id = $2', ['APPROVED', metadata.loanId]);
      }
    }

    await client.query(
      'UPDATE transactions SET status = $1, processed_at = $2 WHERE id = $3',
      ['REJECTED', new Date(), id]
    );

    // Audit Log
    await logAudit(client, {
      userId: transaction.user_id,
      action: 'TRANSACTION_REJECTED',
      entityType: 'transaction',
      entityId: id,
      oldValues: { status: 'PENDING' },
      newValues: { status: 'REJECTED' }
    });

    return { success: true, status: 'REJECTED' };
  }

  // APROVAÇÃO
  if (transaction.type === 'BUY_QUOTA') {
    let metadata: any = transaction.metadata || {};
    // Garantir que metadata seja objeto se for string
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }

    let qty = metadata.quantity || Math.floor(parseFloat(transaction.amount) / QUOTA_PRICE);
    if (qty <= 0) qty = 1;

    for (let i = 0; i < qty; i++) {
      await client.query(
        `INSERT INTO quotas (user_id, purchase_price, current_value, purchase_date, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')`,
        [transaction.user_id, QUOTA_PRICE, QUOTA_PRICE, new Date()]
      );
    }

    await updateScore(client, transaction.user_id, SCORE_REWARDS.QUOTA_PURCHASE * qty, `Compra de ${qty} cotas`);

    if (!metadata.useBalance) {
      const paymentMethod = metadata.paymentMethod || 'pix';
      const baseCost = metadata.baseCost ? parseFloat(metadata.baseCost) : parseFloat(transaction.amount);
      const gatewayCost = calculateGatewayCost(baseCost, paymentMethod);

      await client.query(
        'UPDATE transactions SET gateway_cost = $1 WHERE id = $2',
        [gatewayCost, transaction.id]
      );

      const serviceFee = metadata.serviceFee ? parseFloat(metadata.serviceFee) : 0;
      const principalAmount = parseFloat(transaction.amount) - serviceFee;

      await client.query(
        'UPDATE system_config SET system_balance = system_balance + $1 - $2, total_gateway_costs = total_gateway_costs + $2',
        [principalAmount, gatewayCost]
      );

      // Distribuir a Taxa de Serviço se existir (externa)
      if (serviceFee > 0) {
        const feeForOperational = serviceFee * 0.85;
        const feeForProfit = serviceFee * 0.15;
        await client.query(
          'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
          [feeForOperational, feeForProfit]
        );
      }
    }
  }

  if (transaction.type === 'LOAN_PAYMENT') {
    let metadata: any = transaction.metadata || {};
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }

    if (metadata.loanId) {
      const loanResult = await client.query('SELECT * FROM loans WHERE id = $1 FOR UPDATE', [metadata.loanId]);
      if (loanResult.rows.length > 0) {
        const loan = loanResult.rows[0];
        let gatewayCost = 0;

        if (!metadata.useBalance) {
          const paymentMethod = metadata.paymentMethod || 'pix';
          const baseAmount = metadata.baseAmount ? parseFloat(metadata.baseAmount) : parseFloat(transaction.amount);
          gatewayCost = calculateGatewayCost(baseAmount, paymentMethod);

          await client.query('UPDATE transactions SET gateway_cost = $1 WHERE id = $2', [gatewayCost, transaction.id]);
          await client.query('UPDATE system_config SET total_gateway_costs = total_gateway_costs + $1', [gatewayCost]);
        }

        const actualPaymentAmount = metadata.baseAmount ? parseFloat(metadata.baseAmount) : parseFloat(transaction.amount);
        const loanPrincipal = parseFloat(loan.amount);
        const loanTotal = parseFloat(loan.total_repayment);

        const principalPortion = actualPaymentAmount * (loanPrincipal / loanTotal);
        const interestPortion = actualPaymentAmount - principalPortion;

        await client.query(
          'UPDATE system_config SET system_balance = system_balance + $1 - $2',
          [principalPortion, metadata.useBalance ? 0 : gatewayCost]
        );

        await client.query('UPDATE system_config SET profit_pool = profit_pool + $1', [interestPortion]);

        if (metadata.paymentType === 'full_payment' || (metadata.paymentType === 'installment' && (metadata.remainingAmount || 0) <= 0)) {
          await client.query('UPDATE loans SET status = $1 WHERE id = $2', ['PAID', metadata.loanId]);
        }

        if (metadata.paymentType === 'installment') {
          await client.query(
            'INSERT INTO loan_installments (loan_id, amount, use_balance, created_at) VALUES ($1, $2, $3, $4)',
            [metadata.loanId, actualPaymentAmount, metadata.useBalance || false, new Date()]
          );
        }

        await updateScore(client, transaction.user_id, SCORE_REWARDS.LOAN_PAYMENT_ON_TIME, 'Pagamento de empréstimo');
      }
    }
  }

  // UPGRADE PRO
  if (transaction.type === 'MEMBERSHIP_UPGRADE') {
    // 1. Ativar Plano PRO para o usuário
    await client.query('UPDATE users SET membership_type = $1 WHERE id = $2', ['PRO', transaction.user_id]);

    // 2. Distribuir o valor (50% Caixa / 50% Compartilhado)
    // O valor em 'amount' é negativo na transação (débito), então usamos o valor absoluto
    const upgradeFee = Math.abs(parseFloat(transaction.amount));
    const feeForProfit = upgradeFee * 0.5;
    const feeForOperational = upgradeFee * 0.5;

    await client.query(
      'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
      [feeForOperational, feeForProfit]
    );

    // 3. Bônus de Score por se tornar PRO
    await updateScore(client, transaction.user_id, 100, 'Upgrade para Plano Cred30 PRO');

    console.log(`[UPGRADE_PRO] Usuário ${transaction.user_id} agora é PRO via transação ${id}`);
  }

  // SAQUE (Dedução real do caixa operacional)
  if (transaction.type === 'WITHDRAWAL') {
    let metadata: any = transaction.metadata || {};
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }

    const netAmount = parseFloat(metadata.netAmount || transaction.amount);
    const feeAmount = parseFloat(metadata.feeAmount || '0');

    // --- RE-VALIDAÇÃO DE LIQUIDEZ ---
    const systemQuotasRes = await client.query("SELECT COUNT(*) as count FROM quotas WHERE status = 'ACTIVE'");
    const systemActiveLoansRes = await client.query("SELECT COALESCE(SUM(amount), 0) as total FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')");
    const systemQuotasCount = parseInt(systemQuotasRes.rows[0].count);
    const systemTotalLoaned = parseFloat(systemActiveLoansRes.rows[0].total);
    const systemGrossCash = systemQuotasCount * 50; // Preço fixo da cota (QUOTA_PRICE)
    const realLiquidity = systemGrossCash - systemTotalLoaned;

    if (netAmount > realLiquidity) {
      throw new Error(`Aprovação bloqueada: Liquidez insuficiente no caixa (Disponível: R$ ${realLiquidity.toFixed(2)}).`);
    }

    let feeForOperational = 0;
    let feeForProfit = 0;

    // 1. Subtrair o valor enviado (líquido) do saldo real do sistema
    await client.query(
      'UPDATE system_config SET system_balance = system_balance - $1',
      [netAmount]
    );

    // 2. Se houver taxa cobrada, aplicar a regra de divisão: 85% Volta pro Caixa / 15% Vai pros Lucros
    if (feeAmount > 0) {
      feeForOperational = feeAmount * 0.85;
      feeForProfit = feeAmount * 0.15;

      await client.query(
        'UPDATE system_config SET system_balance = system_balance + $1',
        [feeForOperational]
      );

      await client.query(
        'UPDATE system_config SET profit_pool = profit_pool + $1',
        [feeForProfit]
      );
    }

    console.log('DEBUG - Saque processado contabilmente (Regra 85/15):', {
      netAmount,
      feeAmount,
      feeForOperational,
      feeForProfit
    });
  }

  await client.query(
    'UPDATE transactions SET status = $1, processed_at = $2 WHERE id = $3',
    ['APPROVED', new Date(), id]
  );

  // Audit Log
  await logAudit(client, {
    userId: transaction.user_id,
    action: 'TRANSACTION_APPROVED',
    entityType: 'transaction',
    entityId: id,
    oldValues: { status: 'PENDING' },
    newValues: { status: 'APPROVED', type: transaction.type }
  });

  // Notificar usuário em tempo real
  notificationService.notifyUser(transaction.user_id, 'Status da Transação', `Sua transação de ${transaction.type} foi APROVADA!`);

  return { success: true, status: 'APPROVED' };
};

/**
 * Processa a aprovação ou rejeição de um empréstimo (LOAN)
 */
export const processLoanApproval = async (client: PoolClient, id: string, action: 'APPROVE' | 'REJECT') => {
  const loanResult = await client.query(
    'SELECT * FROM loans WHERE id = $1 AND status = $2 FOR UPDATE',
    [id, 'PENDING']
  );

  if (loanResult.rows.length === 0) {
    throw new Error('Empréstimo não encontrado ou já processado');
  }

  const loan = loanResult.rows[0];

  if (action === 'REJECT') {
    await client.query('UPDATE loans SET status = $1, approved_at = $2 WHERE id = $3', ['REJECTED', new Date(), id]);

    // Audit Log
    await logAudit(client, {
      userId: loan.user_id,
      action: 'LOAN_REJECTED',
      entityType: 'loan',
      entityId: id,
      oldValues: { status: 'PENDING' },
      newValues: { status: 'REJECTED' }
    });

    return { success: true, status: 'REJECTED' };
  }

  // --- RE-VALIDAÇÃO DE SEGURANÇA NA APROVAÇÃO ---
  // Recalcular limite e caixa disponível NO MOMENTO da aprovação
  const availableLimit = await calculateUserLoanLimit(client, loan.user_id);

  // Buscar dívidas ativas atuais (caso ele tenha pedido outro empréstimo nesse meio tempo)
  const activeLoansResult = await client.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM loans 
     WHERE user_id = $1 AND status IN ('APPROVED', 'PAYMENT_PENDING') AND id != $2`,
    [loan.user_id, id]
  );
  const currentDebt = parseFloat(activeLoansResult.rows[0].total);
  const realAvailable = availableLimit - currentDebt;

  if (parseFloat(loan.amount) > realAvailable) {
    throw new Error(`Aprovação bloqueada: Limite insuficiente no momento (Disponível: R$ ${realAvailable.toFixed(2)}).`);
  }

  await client.query('UPDATE loans SET status = $1, approved_at = $2 WHERE id = $3', ['APPROVED', new Date(), id]);

  // Audit Log
  await logAudit(client, {
    userId: loan.user_id,
    action: 'LOAN_APPROVED',
    entityType: 'loan',
    entityId: id,
    oldValues: { status: 'PENDING' },
    newValues: { status: 'APPROVED', amount: loan.amount }
  });

  // Calcular valor líquido a depositar (descontando taxa de originação de 3%)
  const originationFeeRate = 0.03; // LOAN_ORIGINATION_FEE_RATE
  const grossAmount = parseFloat(loan.amount);
  const originationFee = grossAmount * originationFeeRate;
  const netAmount = grossAmount - originationFee;

  await updateUserBalance(client, loan.user_id, netAmount, 'credit');

  await createTransaction(
    client,
    loan.user_id,
    'LOAN_APPROVED',
    netAmount,
    `Apoio Mútuo Aprovado - Valor Líquido Creditado (Taxa de Sustentabilidade de 3% retida)`,
    'APPROVED',
    {
      loanId: id,
      grossAmount,
      originationFee,
      netAmount,
      totalRepayment: parseFloat(loan.total_repayment),
      installments: loan.installments,
      creditedToBalance: true
    }
  );

  // Notificar usuário em tempo real
  notificationService.notifyUser(loan.user_id, 'Empréstimo Aprovado', `Seu empréstimo de R$ ${parseFloat(loan.amount).toFixed(2)} foi aprovado e creditado!`);

  return { success: true, status: 'APPROVED' };
};