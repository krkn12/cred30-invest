import { Pool, PoolClient } from 'pg';
import { QUOTA_PRICE, QUOTA_SHARE_VALUE, QUOTA_ADM_FEE, ASAAS_PIX_OUT_FEE } from '../../shared/constants/business.constants';
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
  // 1. Buscar transação com bloqueio (aceita PENDING ou PENDING_CONFIRMATION para saques)
  const transactionResult = await client.query(
    'SELECT * FROM transactions WHERE id = $1 AND status IN ($2, $3) FOR UPDATE',
    [id, 'PENDING', 'PENDING_CONFIRMATION']
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
        [transaction.user_id, QUOTA_SHARE_VALUE, QUOTA_SHARE_VALUE, new Date()]
      );
    }

    await updateScore(client, transaction.user_id, SCORE_REWARDS.QUOTA_PURCHASE * qty, `Compra de ${qty} cotas`);

    // --- PAGAMENTO DE BÔNUS DE INDICAÇÃO (R$ 5,00) ---
    // Apenas se for dinheiro novo (não useBalance), ou conforme regra de negócio global.
    // Como a transação foi aprovada e dinheiro entrou (ou saldo foi debitado), pagamos o bônus.

    // 1. Verificar se usuário tem indicador
    const userRes = await client.query('SELECT referred_by, name FROM users WHERE id = $1', [transaction.user_id]);
    const buyer = userRes.rows[0];

    if (buyer?.referred_by) {
      const referrerRes = await client.query('SELECT id FROM users WHERE referral_code = $1', [buyer.referred_by]);

      if (referrerRes.rows.length > 0) {
        const referrerId = referrerRes.rows[0].id;
        const bonusAmount = 5.00;
        // --- PAGAMENTO DE BÔNUS DE INDICAÇÃO (R$ 5,00) ---
        // REGRA: Só libera se tiver gerado lucros (profit_pool)
        const sysRes = await client.query('SELECT profit_pool FROM system_config LIMIT 1');
        const profitPool = parseFloat(sysRes.rows[0].profit_pool);

        if (profitPool >= bonusAmount) {
          // Creditar Bônus
          await updateUserBalance(client, referrerId, bonusAmount, 'credit');

          // Deduzir do Pool de Lucros (Bônus é pago com o lucro gerado)
          await client.query(
            'UPDATE system_config SET profit_pool = profit_pool - $1',
            [bonusAmount]
          );

          // Registrar Transação do Bônus
          await createTransaction(
            client,
            referrerId,
            'REFERRAL_BONUS',
            bonusAmount,
            `Bônus por indicação: ${buyer.name} comprou cota(s)`,
            'APPROVED'
          );
        } else {
          // Se não houver lucro no momento, o bônus fica registrado como PENDING (aguardando lucro)
          await createTransaction(
            client,
            referrerId,
            'REFERRAL_BONUS',
            bonusAmount,
            `Bônus por indicação: ${buyer.name} comprou cota(s) (AGUARDANDO RESULTADOS DO SISTEMA)`,
            'PENDING'
          );
        }
      }
    }

    if (!metadata.useBalance) {
      const paymentMethod = metadata.paymentMethod || 'pix';
      // Extrair o valor base (o que o sistema realmente quer receber)
      const serviceFee = metadata.serviceFee ? parseFloat(metadata.serviceFee) : 0;
      const baseCost = metadata.baseCost ? parseFloat(metadata.baseCost) : (parseFloat(transaction.amount) - (metadata.userFee ? parseFloat(metadata.userFee) : 0) - serviceFee);
      const principalAmount = baseCost;

      const gatewayCost = calculateGatewayCost(baseCost, paymentMethod);

      await client.query(
        'UPDATE transactions SET gateway_cost = $1 WHERE id = $2',
        [gatewayCost, transaction.id]
      );

      // Calcular separação de valores: R$ 42,00 principal + R$ 8,00 manutenção
      const totalShareValue = qty * QUOTA_SHARE_VALUE;
      const totalAdmFee = qty * QUOTA_ADM_FEE;

      // Atualizar caixa do sistema: O principal (R$ 42) entra no caixa, e a taxa de manutenção (R$ 8) também.
      // A soma total (R$ 50) deve entrar no system_balance para cobrir custos e lastrear saques futuros.
      // O gateway cost é subtraído conforme regra atual.

      await client.query(
        'UPDATE system_config SET system_balance = system_balance + $1 - $2, total_gateway_costs = total_gateway_costs + $2',
        [parseFloat(transaction.amount), gatewayCost]
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

        // Usamos o valor líquido do pagamento (sem a taxa de gateway que o cliente pagou)
        const userFee = metadata.userFee ? parseFloat(metadata.userFee) : 0;
        const actualPaymentAmount = metadata.baseAmount ? parseFloat(metadata.baseAmount) : (parseFloat(transaction.amount) - userFee);
        const loanPrincipal = parseFloat(loan.amount);
        const loanTotal = parseFloat(loan.total_repayment);

        const principalPortion = actualPaymentAmount * (loanPrincipal / loanTotal);
        const interestPortion = actualPaymentAmount - principalPortion;

        // O saldo do sistema sobe pelo valor principal pago.
        // Taxas são repassadas.
        await client.query(
          'UPDATE system_config SET system_balance = system_balance + $1',
          [principalPortion]
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

    // 2. Distribuir o valor (85% para cotistas / 15% Operacional)
    const upgradeFee = Math.abs(parseFloat(transaction.amount));
    const feeForProfit = upgradeFee * 0.85;
    const feeForOperational = upgradeFee * 0.15;

    await client.query(
      'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
      [feeForOperational, feeForProfit]
    );

    // 3. Bônus de Score por se tornar PRO
    await updateScore(client, transaction.user_id, 100, 'Upgrade para Plano Cred30 PRO');

    console.log(`[UPGRADE_PRO] Usuário ${transaction.user_id} agora é PRO via transação ${id}`);
  }

  // COMPRA NO MARKETPLACE
  if (transaction.type === 'MARKET_PURCHASE') {
    let metadata: any = transaction.metadata || {};
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }

    if (metadata.orderId) {
      // 1. Atualizar status do pedido para 'Aguardando Envio'
      await client.query(
        "UPDATE marketplace_orders SET status = 'WAITING_SHIPPING', updated_at = NOW() WHERE id = $1",
        [metadata.orderId]
      );

      // 2. Se houver taxa de gateway externa (PIX/Cartão), contabilizar
      if (metadata.externalReference || metadata.gatewayId) {
        const paymentMethod = metadata.paymentMethod || 'pix';
        const baseAmount = parseFloat(transaction.amount);
        const gatewayCost = calculateGatewayCost(baseAmount, paymentMethod as any);

        await client.query(
          'UPDATE transactions SET gateway_cost = $1 WHERE id = $2',
          [gatewayCost, transaction.id]
        );

        await client.query(
          'UPDATE system_config SET system_balance = system_balance + $1 - $2, total_gateway_costs = total_gateway_costs + $2',
          [parseFloat(transaction.amount), gatewayCost]
        );
      }

      console.log(`[MARKET_PURCHASE] Pedido ${metadata.orderId} aprovado via transação ${id}`);
    }
  }

  // IMPULSIONAMENTO NO MARKETPLACE
  if (transaction.type === 'MARKET_BOOST') {
    let metadata: any = transaction.metadata || {};
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }

    if (metadata.listingId) {
      // 1. Ativar o Boost no anúncio
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await client.query(
        'UPDATE marketplace_listings SET is_boosted = TRUE, boost_expires_at = $1 WHERE id = $2',
        [expiresAt, metadata.listingId]
      );

      // 2. Distribuir a taxa (85% para cotistas / 15% Operacional)
      // Se for pagamento externo, considerar o gateway fee
      const boostFee = Math.abs(parseFloat(transaction.amount));
      let gatewayCost = 0;

      if (metadata.asaas_id || metadata.external_reference) {
        const paymentMethod = metadata.paymentMethod || 'pix';
        gatewayCost = calculateGatewayCost(boostFee, paymentMethod as any);

        await client.query(
          'UPDATE transactions SET gateway_cost = $1 WHERE id = $2',
          [gatewayCost, transaction.id]
        );

        await client.query(
          'UPDATE system_config SET total_gateway_costs = total_gateway_costs + $1',
          [gatewayCost]
        );
      }

      // Valor líquido para distribuição (depois do gateway cost)
      const netBoostFee = boostFee - gatewayCost;
      const feeForProfit = netBoostFee * 0.85;
      const feeForOperational = netBoostFee * 0.15;

      await client.query(
        'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
        [feeForOperational, feeForProfit]
      );

      console.log(`[MARKET_BOOST] Anúncio ${metadata.listingId} impulsionado via transação ${id}`);
    }
  }

  // SAQUE (Dedução real do caixa operacional)
  if (transaction.type === 'WITHDRAWAL') {
    let metadata: any = transaction.metadata || {};
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }

    const netAmount = parseFloat(metadata.netAmount || transaction.amount);
    const feeAmount = parseFloat(metadata.feeAmount || '0');

    // --- RE-VALIDAÇÃO DE LIQUIDEZ REAL (Somente Warning) ---
    // Não vamos bloquear a aprovação técnica da transação aqui, pois o usuário já teve o saldo debitado na solicitação.
    // Se não houver liquidez no caixa do banco (Asaas), o Admin verá isso na fila de pagamentos "PENDING_PAYMENT" e não conseguirá pagar.
    // Bloquear aqui causaria um estado inconsistente onde o usuário vê "Erro 500" mas o dinheiro já saiu da conta dele (Pending).

    const configRes = await client.query("SELECT system_balance, total_tax_reserve, total_operational_reserve, total_owner_profit FROM system_config LIMIT 1");
    const config = configRes.rows[0] || {};

    const totalReserves = (parseFloat(config.total_tax_reserve || '0')) +
      (parseFloat(config.total_operational_reserve || '0')) +
      (parseFloat(config.total_owner_profit || '0'));

    const realLiquidity = (parseFloat(config.system_balance || '0')) - totalReserves;

    // Apenas logar aviso se liquidez estiver baixa, mas prosseguir para criar o registro de pagamento pendente
    if (netAmount > realLiquidity) {
      console.warn(`[WARNING] Saque aprovado com liquidez apertada. Disponível: ${realLiquidity}, Solicitado: ${netAmount}`);
    }

    let feeForOperational = 0;
    let feeForProfit = 0;

    // 1. Subtrair o valor enviado (líquido) E o custo do gateway (Asaas Payout Fee) do saldo real do sistema
    // A plataforma "absorve" o custo de R$ 5,00 do Asaas conforme solicitado.
    const totalDeduction = netAmount + ASAAS_PIX_OUT_FEE;

    await client.query(
      'UPDATE system_config SET system_balance = system_balance - $1, total_gateway_costs = total_gateway_costs + $2',
      [totalDeduction, ASAAS_PIX_OUT_FEE]
    );

    // 2. Se houver taxa cobrada do usuário (ex: R$ 2,00), aplicar a regra de divisão: 15% Volta pro Caixa / 85% vai pros Lucros
    if (feeAmount > 0) {
      feeForProfit = feeAmount * 0.85;
      feeForOperational = feeAmount * 0.15;

      await client.query(
        'UPDATE system_config SET system_balance = system_balance + $1',
        [feeForOperational]
      );

      await client.query(
        'UPDATE system_config SET profit_pool = profit_pool + $1',
        [feeForProfit]
      );
    }

    console.log('DEBUG - Saque processado contabilmente (Regra 85/15 + Absorção Gateway):', {
      netAmount,
      feeAmount,
      gatewayCost: ASAAS_PIX_OUT_FEE,
      totalDeduction,
      feeForOperational,
      feeForProfit
    });
  }

  await client.query(
    'UPDATE transactions SET status = $1, processed_at = $2, payout_status = $3 WHERE id = $4',
    ['APPROVED', new Date(), transaction.type === 'WITHDRAWAL' ? 'PENDING_PAYMENT' : 'NONE', id]
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

  await client.query('UPDATE loans SET status = $1, approved_at = $2, payout_status = $3 WHERE id = $4', ['APPROVED', new Date(), 'NONE', id]);

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

  // Distribuir a Taxa de Originação (85% para cotistas / 15% Operacional)
  const feeForProfit = originationFee * 0.85;
  const feeForOperational = originationFee * 0.15;
  await client.query(
    'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
    [feeForOperational, feeForProfit]
  );

  // NOTA: Não deduzimos do system_balance aqui. A liquidez real só sai do banco quando o usuário sacar.

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