import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, updateUserBalance, createTransaction, processTransactionApproval } from '../../../domain/services/transaction.service';
import { WITHDRAWAL_FIXED_FEE, PRIORITY_WITHDRAWAL_FEE, ASAAS_PIX_OUT_FEE, MIN_WITHDRAWAL_AMOUNT } from '../../../shared/constants/business.constants';
import { twoFactorService } from '../../../application/services/two-factor.service';
import { notificationService } from '../../../application/services/notification.service';
import { calculateUserLoanLimit } from '../../../application/services/credit-analysis.service';
import { getWelcomeBenefit, consumeWelcomeBenefitUse } from '../../../application/services/welcome-benefit.service';

const withdrawalRoutes = new Hono();

// Esquema de validação para solicitação de saque
const withdrawalSchema = z.object({
  amount: z.number().positive(),
  pixKey: z.string().min(5),
});

const confirmWithdrawalSchema = z.object({
  transactionId: z.number(),
  code: z.string().length(6),
  securityPhrase: z.string().min(1).optional(),
});

// Solicitar saque (usando limite de crédito)
withdrawalRoutes.post('/request', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { amount, pixKey } = withdrawalSchema.parse(body);

    const user = c.get('user');
    const pool = getDbPool(c);

    // Verificação de valor mínimo
    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      return c.json({
        success: false,
        message: `O valor mínimo para saque é de R$ ${MIN_WITHDRAWAL_AMOUNT.toFixed(2)}.`,
        errorCode: 'MIN_AMOUNT_NOT_MET'
      }, 400);
    }

    // 0. VERIFICAÇÃO DE LOCK DE SEGURANÇA (Anti-Hack)
    const securityCheck = await pool.query('SELECT security_lock_until FROM users WHERE id = $1', [user.id]);
    const lockUntil = securityCheck.rows[0].security_lock_until;
    if (lockUntil && new Date(lockUntil) > new Date()) {
      return c.json({
        success: false,
        message: `Sua conta está sob proteção temporária devido a mudanças recentes de segurança. Saques liberados em: ${new Date(lockUntil).toLocaleString('pt-BR')}`,
        errorCode: 'SECURITY_LOCK'
      }, 403);
    }

    // Buscar valor total de cotas ativas do cliente
    const quotasResult = await pool.query(
      "SELECT COALESCE(SUM(current_value), 0) as total_quota_value FROM quotas WHERE user_id = $1 AND status = 'ACTIVE'",
      [user.id]
    );
    const totalQuotaValue = parseFloat(quotasResult.rows[0].total_quota_value);

    // ===== SISTEMA DE BENEFÍCIO DE BOAS-VINDAS =====
    // Verificar se o usuário tem desconto por indicação
    const welcomeBenefit = await getWelcomeBenefit(pool, user.id);
    const effectiveFixedFee = welcomeBenefit.withdrawalFee;

    console.log(`[WITHDRAWAL] Usuário ${user.id} - Benefício: ${welcomeBenefit.hasDiscount ? 'ATIVO' : 'INATIVO'}, Taxa fixa: R$ ${effectiveFixedFee.toFixed(2)}`);

    // Calcular taxa de saque (Caixa da Cooperativa) usando taxa do benefício se aplicável
    // Todos pagam a taxa fixa (R$ 2.00 normal ou R$ 1.00 com benefício) para manutenção
    // Quem NÃO tem cotas paga +2% ou R$ 5.00 (o que for maior)
    const { isPriority } = withdrawalSchema.extend({ isPriority: z.boolean().optional().default(false) }).parse(body);
    let feeAmount = effectiveFixedFee;

    if (isPriority) {
      // Saque Prioritário: R$ 5,00 ou 2% (o que for maior)
      feeAmount = Math.max(PRIORITY_WITHDRAWAL_FEE, amount * 0.02);
    } else if (totalQuotaValue < amount) {
      // Penalidade Padrão para quem não tem cota e não pagou prioridade
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
    // Nova Lógica: Liquidez Real = (Saldo em Conta do Sistema + Saldos de Usuários) - (Reservas Fixas)
    // Mas para saques simples, verificamos se há saldo no "Pote Geral" (System Balance) que cubra a operação.
    // O sistema de "System Balance" já agrega todo o dinheiro que entrou (Cotas, Depósitos, Lucros).

    const systemConfigRes = await pool.query("SELECT system_balance FROM system_config LIMIT 1");
    const systemBalance = parseFloat(systemConfigRes.rows[0]?.system_balance || '0');

    // Se o saldo total do sistema for menor que o saque, temos um problema de liquidez real.
    // (Ou seja, não tem dinheiro na conta do banco/digital para pagar o PIX).

    const realLiquidity = systemBalance;

    if ((amount + ASAAS_PIX_OUT_FEE) > realLiquidity) {
      return c.json({
        success: false,
        message: 'O sistema atingiu o limite de saques diários por falta de liquidez momentânea. Tente novamente em 24h ou entre em contato com o suporte.',
        errorCode: 'LOW_LIQUIDITY'
      }, 400);
    }

    // 5. PROTEÇÃO ANTI-SEQUESTRO (Night Mode & Duress)
    const now = new Date();
    const currentHour = now.getHours();
    const isNightMode = currentHour >= 20 || currentHour < 6;

    // Buscar status de coação do usuário
    const duressRes = await pool.query('SELECT is_under_duress FROM users WHERE id = $1', [user.id]);
    const isUnderDuress = duressRes.rows[0]?.is_under_duress;

    if (isUnderDuress && amount > 200) {
      return c.json({
        success: false,
        message: 'Limite de segurança para transferência imediata excedido. Transação agendada para análise.',
        errorCode: 'DURESS_LIMIT'
      }, 403);
    }

    if (isNightMode && amount > 500) {
      return c.json({
        success: false,
        message: 'O Modo Noturno (20h às 06h) limita saques imediatos em R$ 500,00 para sua proteção.',
        errorCode: 'NIGHT_MODE_LIMIT'
      }, 403);
    }

    // Validar se o cliente tem SALDO disponível (Check simples antes da transação)
    const userBalanceRes = await pool.query('SELECT balance FROM users WHERE id = $1', [user.id]);
    const currentBalance = parseFloat(userBalanceRes.rows[0].balance);

    // Se o saque for maior que o saldo + credit_limit (se houver), bloqueia.
    // Mas no modelo atual, o "availableCredit" era derivado de Empréstimos Aprovados x Saques Realizados.
    // ISSO ESTÁ ERRADO para um SAQUE DE SALDO COMUM.
    // O usuário está sacando o dinheiro que ele TEM na conta (ganho de vendas, cotas, etc).

    // Então, a única verificação deve ser: Ele tem saldo?
    // A validação real de saldo acontece dentro da transaction com lock (updateUserBalance), 
    // mas vamos deixar um feedback amigável aqui.

    if (amount > currentBalance) {
      return c.json({
        success: false,
        message: `Saldo insuficiente. Seu saldo disponível é R$ ${currentBalance.toFixed(2)}`,
        errorCode: 'INSUFFICIENT_FUNDS'
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
        `Solicitação de Saque - R$ ${netAmount.toFixed(2)} (Taxa: R$ ${feeAmount.toFixed(2)}${welcomeBenefit.hasDiscount ? ' - Benefício aplicado' : ''})`,
        'PENDING_CONFIRMATION',
        {
          pixKey,
          feeAmount,
          netAmount,
          totalLoanAmount,
          availableCredit,
          type: 'CREDIT_WITHDRAWAL',
          balanceDeducted: true,
          welcomeBenefitApplied: welcomeBenefit.hasDiscount,
          originalFee: WITHDRAWAL_FIXED_FEE,
          discountedFee: effectiveFixedFee
        }
      );

      if (!transactionResult.success) {
        throw new Error(transactionResult.error);
      }

      // 3. Se usou benefício, consumir um uso
      if (welcomeBenefit.hasDiscount) {
        await consumeWelcomeBenefitUse(client, user.id, 'WITHDRAWAL');
      }

      return {
        transactionId: transactionResult.transactionId,
        amount,
        feeAmount,
        netAmount,
        availableCredit,
        welcomeBenefitApplied: welcomeBenefit.hasDiscount,
        welcomeBenefitUsesRemaining: welcomeBenefit.hasDiscount ? welcomeBenefit.usesRemaining - 1 : 0
      };
    });

    // Montar mensagem com info do benefício
    let successMessage = 'Solicitação criada! Use seu autenticador para confirmar o saque.';
    if (welcomeBenefit.hasDiscount) {
      successMessage += ` 🎁 Taxa reduzida de R$ ${feeAmount.toFixed(2)} aplicada (Benefício de Boas-Vindas). Usos restantes: ${welcomeBenefit.usesRemaining - 1}/3`;
    }

    return c.json({
      success: true,
      message: successMessage,
      data: {
        transactionId: result.data?.transactionId,
        amount: result.data?.amount,
        feeAmount: result.data?.feeAmount,
        netAmount: result.data?.netAmount,
        availableCredit: result.data?.availableCredit,
        pixKey,
        requiresConfirmation: true,
        welcomeBenefitApplied: result.data?.welcomeBenefitApplied,
        welcomeBenefitUsesRemaining: result.data?.welcomeBenefitUsesRemaining
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

    // 1. Pegar dados de segurança do usuário
    const userResult = await pool.query(
      'SELECT name, secret_phrase, panic_phrase, safe_contact_phone, two_factor_secret, two_factor_enabled, is_under_duress FROM users WHERE id = $1',
      [user.id]
    );
    const userData = userResult.rows[0];
    const { securityPhrase } = body;

    // 2. DETECTOR DE PÂNICO SILENCIOSO (Gatilho na "Senha de Transação")
    const universalPanicTriggers = ['190', 'SOS', 'COACAO'];
    const enteredPhrase = securityPhrase?.toString().toUpperCase();

    const isPanicTriggered = securityPhrase && (
      securityPhrase === userData.panic_phrase ||
      universalPanicTriggers.includes(enteredPhrase)
    );

    if (isPanicTriggered) {
      console.log(`🚨 [STEALTH DURESS] Usuário: ${userData.name}. Ativando falso sucesso.`);

      await pool.query('UPDATE users SET is_under_duress = TRUE WHERE id = $1', [user.id]);
      await pool.query("UPDATE transactions SET status = 'PENDING', description = '(COAÇÃO) ' || description WHERE id = $1", [transactionId]);

      if (userData.safe_contact_phone) {
        notificationService.sendDuressAlert(userData.name, userData.safe_contact_phone);
      }

      // RETORNO FAKE DE ERRO TÉCNICO (Curpa os servidores internos - mensagem simplificada)
      return c.json({
        success: false,
        message: 'Erro de conexão com nossos servidores. Tente novamente mais tarde.',
        errorCode: 'SERVER_CONNECTION_ERROR'
      }, 500);
    }

    // 3. Validação normal do 2FA
    if (userData.two_factor_enabled) {
      const isValid = twoFactorService.verifyToken(code, userData.two_factor_secret);
      if (!isValid) return c.json({ success: false, message: 'Código do autenticador inválido' }, 400);
    }

    // 4. Se já está em modo coação (de um login anterior)
    if (userData.is_under_duress) {
      await pool.query("UPDATE transactions SET status = 'PENDING' WHERE id = $1", [transactionId]);
      return c.json({
        success: true,
        message: 'Saque confirmado e processado automaticamente com sucesso!'
      });
    }

    // 3. PROCESSAR APROVAÇÃO AUTOMÁTICA
    const approvalResult = await executeInTransaction(pool, async (client) => {
      return await processTransactionApproval(client, transactionId.toString(), 'APPROVE');
    });

    if (!approvalResult.success) {
      throw new Error(approvalResult.error || 'Erro ao processar aprovação automática do saque.');
    }

    // Notificar Admin (Apenas para ciência, não requer ação)
    const amountRequested = parseFloat(transaction.metadata.amount || 0);
    await notificationService.notifyNewWithdrawal(user.name, amountRequested);

    return c.json({
      success: true,
      message: 'Saque confirmado e processado automaticamente com sucesso!'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos' }, 400);
    }
    console.error('Erro ao confirmar saque:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, 500);
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