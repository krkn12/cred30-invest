import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { LOAN_INTEREST_RATE, ONE_MONTH_MS, PENALTY_RATE, LOAN_ORIGINATION_FEE_RATE } from '../../../shared/constants/business.constants';
import { updateScore, SCORE_REWARDS } from '../../../application/services/score.service';
import { createPixPayment, createCardPayment } from '../../../infrastructure/gateways/mercadopago.service';
import { calculateTotalToPay, PaymentMethod } from '../../../shared/utils/financial.utils';
import { executeInTransaction, processLoanApproval } from '../../../domain/services/transaction.service';
import { calculateUserLoanLimit } from '../../../application/services/credit-analysis.service';
import { PoolClient } from 'pg';

const loanRoutes = new Hono();

// Esquema de validação para solicitação de empréstimo
const createLoanSchema = z.object({
  amount: z.number().positive(),
  installments: z.number().int().min(1).max(12),
  receivePixKey: z.string().min(5),
});

// Esquema de validação para pagamento de empréstimo
const repayLoanSchema = z.object({
  loanId: z.union([z.string(), z.number()]).transform((val) => {
    if (typeof val === 'number') {
      return val.toString();
    }
    return val;
  }),
  useBalance: z.boolean(),
  paymentMethod: z.enum(['pix', 'card']).optional().default('pix'),
  token: z.string().optional(),
  issuer_id: z.union([z.string(), z.number()]).optional(),
  installments: z.number().optional(),
  payment_method_id: z.string().optional(),
});

// Esquema de validação para pagamento parcelado
const repayInstallmentSchema = z.object({
  loanId: z.union([z.string(), z.number()]).transform((val) => {
    if (typeof val === 'number') {
      return val.toString();
    }
    return val;
  }),
  installmentAmount: z.number().positive(),
  useBalance: z.boolean(),
  paymentMethod: z.enum(['pix', 'card']).optional().default('pix'),
  token: z.string().optional(),
  issuer_id: z.union([z.string(), z.number()]).optional(),
  installments: z.number().optional(),
  payment_method_id: z.string().optional(),
});

// Listar empréstimos do usuário
loanRoutes.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const pool = getDbPool(c);

    // Buscar empréstimos do usuário
    const result = await pool.query(
      `SELECT id, user_id, amount, total_repayment, installments, interest_rate,
              created_at, status, due_date, pix_key_to_receive
       FROM loans
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    );

    // Formatar empréstimos para resposta
    const formattedLoans = await Promise.all(result.rows.map(async (loan) => {
      // Buscar parcelas pagas deste empréstimo
      const installmentsResult = await pool.query(
        'SELECT id, amount, use_balance, created_at FROM loan_installments WHERE loan_id = $1 ORDER BY created_at ASC',
        [loan.id]
      );

      const paidInstallments = installmentsResult.rows.map(installment => ({
        id: installment.id,
        amount: parseFloat(installment.amount),
        useBalance: installment.use_balance,
        createdAt: new Date(installment.created_at).getTime()
      }));

      const totalPaid = paidInstallments.reduce((sum, installment) => sum + installment.amount, 0);
      const remainingAmount = parseFloat(loan.total_repayment) - totalPaid;
      const paidInstallmentsCount = paidInstallments.length;

      return {
        id: loan.id,
        userId: loan.user_id,
        amount: parseFloat(loan.amount),
        totalRepayment: parseFloat(loan.total_repayment),
        installments: loan.installments,
        interestRate: parseFloat(loan.interest_rate),
        requestDate: new Date(loan.created_at).getTime(),
        status: loan.status,
        pixKeyToReceive: loan.pix_key_to_receive || '',
        dueDate: new Date(loan.due_date).getTime(),
        paidInstallments,
        totalPaid,
        remainingAmount,
        paidInstallmentsCount,
        isFullyPaid: totalPaid >= parseFloat(loan.total_repayment)
      };
    }));

    return c.json({
      success: true,
      data: {
        loans: formattedLoans,
      },
    });
  } catch (error) {
    console.error('Erro ao listar empréstimos:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Obter limite de crédito disponível (Nubank Style)
loanRoutes.get('/available-limit', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const pool = getDbPool(c);

    const limit = await calculateUserLoanLimit(pool, user.id);

    // Buscar dívidas ativas para calcular o limite RESTANTE
    const activeLoansResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM loans 
       WHERE user_id = $1 AND status IN ('APPROVED', 'PAYMENT_PENDING')`,
      [user.id]
    );
    const activeDebt = parseFloat(activeLoansResult.rows[0].total);
    const remainingLimit = Math.max(0, limit - activeDebt);

    return c.json({
      success: true,
      data: {
        totalLimit: limit,
        activeDebt: activeDebt,
        remainingLimit: remainingLimit
      }
    });
  } catch (error) {
    return c.json({ success: false, message: 'Erro ao calcular limite' }, 500);
  }
});

// Solicitar empréstimo
loanRoutes.post('/request', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { amount, installments, receivePixKey } = createLoanSchema.parse(body);

    const user = c.get('user');
    const pool = getDbPool(c);

    // Verificar se o usuário já tem empréstimos em atraso
    const lateLoansResult = await pool.query(
      `SELECT id FROM loans 
       WHERE user_id = $1 AND status = 'APPROVED' AND due_date < NOW()`,
      [user.id]
    );

    if (lateLoansResult.rows.length > 0) {
      // Aplicar penalidade de score por atraso
      await updateScore(pool, user.id, -50, 'Tentativa de novo apoio com compromissos em atraso');

      return c.json({
        success: false,
        message: 'Você possui compromissos em atraso. Regularize sua situação para solicitar novos apoios.'
      }, 400);
    }

    // --- VALIDAÇÃO DE LIMITE ESTILO NUBANK ---
    const userLimit = await calculateUserLoanLimit(pool, user.id);

    // Buscar total já emprestado (ativo)
    const activeLoansResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM loans 
       WHERE user_id = $1 AND status IN ('APPROVED', 'PAYMENT_PENDING')`,
      [user.id]
    );
    const currentDebt = parseFloat(activeLoansResult.rows[0].total);
    const available = userLimit - currentDebt;

    if (amount > available) {
      return c.json({
        success: false,
        message: `Limite insuficiente. Seu limite disponível é R$ ${available.toFixed(2)}.`,
        data: { available, userLimit, currentDebt }
      }, 400);
    }

    // DEBUG: Log para verificar o valor do PIX recebido
    console.log('DEBUG - PIX recebido na solicitação:', {
      receivePixKey,
      tipo: typeof receivePixKey,
      vazio: !receivePixKey,
      userId: user.id
    });

    // Garantir que o PIX seja uma string válida
    const pixKeyToSave = receivePixKey && receivePixKey.trim() ? receivePixKey.trim() : null;

    // Calcular taxas e juros
    const originationFee = amount * LOAN_ORIGINATION_FEE_RATE; // Ganho imediato pro caixa
    const amountToDisburse = amount - originationFee; // O que o usuário recebe de fato
    const totalWithInterest = amount * (1 + LOAN_INTEREST_RATE);

    // Criar empréstimo e APROVAR AUTOMATICAMENTE
    const loanId = await executeInTransaction(pool, async (client: PoolClient) => {
      const result = await client.query(
        `INSERT INTO loans (user_id, amount, total_repayment, installments, interest_rate, penalty_rate, status, due_date, pix_key_to_receive, term_days, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, $9, $10)
         RETURNING id`,
        [
          user.id,
          amount,
          totalWithInterest,
          installments,
          LOAN_INTEREST_RATE,
          PENALTY_RATE,
          new Date(Date.now() + (installments * ONE_MONTH_MS)),
          pixKeyToSave,
          installments * 30,
          JSON.stringify({ originationFee, disbursedAmount: amountToDisburse })
        ]
      );

      const newLoanId = result.rows[0].id;

      // Destinar a taxa de originação (Regra 85/15)
      const feeForOperational = originationFee * 0.85;
      const feeForProfit = originationFee * 0.15;

      await client.query(
        'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
        [feeForOperational, feeForProfit]
      );

      // Chamar aprovação automática
      await processLoanApproval(client, newLoanId, 'APPROVE');

      // Ajuste no saldo: O processLoanApproval adiciona 'amount', então precisamos remover a taxa de originação do saldo do usuário
      // para que ele receba apenas 'amountToDisburse'
      await client.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [originationFee, user.id]
      );

      return newLoanId;
    });

    return c.json({
      success: true,
      message: `Apoio Mútuo concedido! R$ ${amountToDisburse.toFixed(2)} creditados (descontado R$ ${originationFee.toFixed(2)} de taxa de sustentabilidade).`,
      data: {
        loanId: loanId.data,
        totalRepayment: totalWithInterest,
        originationFee,
        disbursedAmount: amountToDisburse
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }

    console.error('Erro ao solicitar empréstimo:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Pagar empréstimo
loanRoutes.post('/repay', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { loanId, useBalance, paymentMethod, token, issuer_id, installments } = repayLoanSchema.parse(body);

    const user = c.get('user');
    const pool = getDbPool(c);

    // Buscar empréstimo
    const loanResult = await pool.query(
      'SELECT * FROM loans WHERE id = $1 AND user_id = $2',
      [loanId, user.id]
    );

    if (loanResult.rows.length === 0) {
      return c.json({ success: false, message: 'Apoio Mútuo não encontrado' }, 404);
    }

    const loan = loanResult.rows[0];

    if (loan.status !== 'APPROVED') {
      return c.json({ success: false, message: 'Apoio Mútuo não disponível para reposição' }, 400);
    }

    // Calcular separação entre principal e juros
    const totalRepayment = parseFloat(loan.total_repayment);
    const principalAmount = parseFloat(loan.amount);
    const totalInterest = totalRepayment - principalAmount;

    // Calcular valores com taxas conforme o método
    const method: PaymentMethod = useBalance ? 'balance' : (paymentMethod as PaymentMethod);
    const { total: finalCost, fee: userFee } = calculateTotalToPay(totalRepayment, method);

    console.log('DEBUG - Pagamento completo do empréstimo:', {
      loanId,
      totalRepayment,
      finalCost,
      userFee,
      useBalance
    });

    // Se estiver usando saldo, verificar se tem saldo suficiente
    if (useBalance && user.balance < totalRepayment) {
      return c.json({ success: false, message: 'Saldo insuficiente para a reposição do apoio' }, 400);
    }

    // Se estiver usando saldo, deduzir do usuário
    if (useBalance) {
      await pool.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [totalRepayment, user.id]
      );
    }

    // Atualizar status do empréstimo para pagamento pendente
    await pool.query(
      'UPDATE loans SET status = $1 WHERE id = $2',
      ['PAYMENT_PENDING', loanId]
    );

    // Se for externo (não usa saldo), gerar pagamento MP
    let mpData = null;
    if (!useBalance) {
      try {
        if (paymentMethod === 'card' && token) {
          mpData = await createCardPayment({
            amount: finalCost,
            description: `Reposição total de apoio no sistema Cred30`,
            email: user.email,
            external_reference: `REPAY_${loanId}_${Date.now()}`,
            token,
            issuer_id: issuer_id ? Number(issuer_id) : undefined,
            installments: installments
          });
        } else {
          mpData = await createPixPayment({
            amount: finalCost,
            description: `Reposição total de apoio no sistema Cred30`,
            email: user.email,
            external_reference: `REPAY_${loanId}_${Date.now()}`
          });
        }
      } catch (mpError) {
        console.error('Erro ao gerar cobrança Mercado Pago:', mpError);
      }
    }

    // Criar transação de pagamento
    const transaction = await pool.query(
      `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
         VALUES ($1, 'LOAN_PAYMENT', $2, $3, 'PENDING', $4)
         RETURNING id`,
      [
        user.id,
        finalCost,
        `Reposição de Apoio Mútuo (${useBalance ? 'Saldo' : (mpData ? 'Mercado Pago' : 'Externo')}) - Aguardando Confirmação`,
        JSON.stringify({
          loanId,
          useBalance,
          paymentMethod: paymentMethod,
          principalAmount,
          interestAmount: totalInterest,
          paymentType: 'full_payment',
          baseAmount: totalRepayment,
          userFee,
          mp_id: mpData?.id,
          qr_code: mpData?.qr_code,
          qr_code_base64: mpData?.qr_code_base64
        })
      ]
    );

    return c.json({
      success: true,
      message: 'Reposição enviada para análise! Aguarde confirmação.',
      data: {
        transactionId: transaction.rows[0].id,
        principalAmount,
        interestAmount: totalInterest,
        baseAmount: totalRepayment,
        userFee,
        finalCost,
        pixData: mpData?.qr_code ? mpData : null,
        cardData: paymentMethod === 'card' ? mpData : null
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }

    console.error('Erro ao pagar empréstimo:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Pagar parcela específica de empréstimo
loanRoutes.post('/repay-installment', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { loanId, installmentAmount, useBalance, paymentMethod, token, issuer_id, installments } = repayInstallmentSchema.parse(body);

    const user = c.get('user');
    const pool = getDbPool(c);

    // Buscar empréstimo
    const loanResult = await pool.query(
      'SELECT * FROM loans WHERE id = $1 AND user_id = $2',
      [loanId, user.id]
    );

    if (loanResult.rows.length === 0) {
      return c.json({ success: false, message: 'Empréstimo não encontrado' }, 404);
    }

    const loan = loanResult.rows[0];

    if (loan.status !== 'APPROVED') {
      return c.json({ success: false, message: 'Empréstimo não está ativo para pagamento' }, 400);
    }

    // Verificar se o empréstimo já tem parcelas pagas
    const paidInstallmentsResult = await pool.query(
      'SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as paid_amount FROM loan_installments WHERE loan_id = $1',
      [loanId]
    );

    const paidAmount = parseFloat(paidInstallmentsResult.rows[0].paid_amount);
    const remainingAmountPre = parseFloat(loan.total_repayment) - paidAmount;

    // Calcular valores com taxas conforme o método
    const method: PaymentMethod = useBalance ? 'balance' : (paymentMethod as PaymentMethod);
    const { total: finalInstallmentCost, fee: userFee } = calculateTotalToPay(installmentAmount, method);

    // Validar valor da parcela
    if (installmentAmount > remainingAmountPre) {
      return c.json({ success: false, message: 'Valor da parcela excede o valor restante' }, 400);
    }

    // Calcular novo valor pago (incluindo esta parcela)
    const newPaidAmount = paidAmount + installmentAmount;

    // Se for pagamento via PIX/Cartão (não usa saldo), criar transação PENDENTE e NÃO registrar parcela ainda
    if (!useBalance) {
      let mpData = null;
      try {
        if (paymentMethod === 'card' && token) {
          mpData = await createCardPayment({
            amount: finalInstallmentCost,
            description: `Pagamento de parcela de emprestimo no Cred30`,
            email: user.email,
            external_reference: `INSTALLMENT_${loanId}_${Date.now()}`,
            token,
            issuer_id: issuer_id ? Number(issuer_id) : undefined,
            installments: installments
          });
        } else {
          mpData = await createPixPayment({
            amount: finalInstallmentCost,
            description: `Pagamento de parcela de emprestimo no Cred30`,
            email: user.email,
            external_reference: `INSTALLMENT_${loanId}_${Date.now()}`
          });
        }
      } catch (mpError) {
        console.error('Erro ao gerar cobrança Mercado Pago:', mpError);
      }

      const transaction = await pool.query(
        `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
         VALUES ($1, 'LOAN_PAYMENT', $2, $3, 'PENDING', $4)
         RETURNING id`,
        [
          user.id,
          finalInstallmentCost,
          `Pagamento parcela (${mpData ? 'Mercado Pago' : 'Externo'}) - Aguardando Confirmação`,
          JSON.stringify({
            loanId,
            installmentAmount,
            useBalance: false,
            paymentMethod: paymentMethod,
            paymentType: 'installment', // Identificador importante para o admin
            isInstallment: true,
            remainingAmount: remainingAmountPre - installmentAmount,
            baseAmount: installmentAmount,
            userFee,
            mp_id: mpData?.id,
            qr_code: mpData?.qr_code,
            qr_code_base64: mpData?.qr_code_base64
          })
        ]
      );

      return c.json({
        success: true,
        message: 'Código de reposição gerado! Aguarde a confirmação da cooperativa.',
        data: {
          transactionId: transaction.rows[0].id,
          remainingAmount: remainingAmountPre,
          isFullyPaid: false,
          baseAmount: installmentAmount,
          userFee,
          finalCost: finalInstallmentCost,
          pixData: mpData?.qr_code ? mpData : null,
          cardData: paymentMethod === 'card' ? mpData : null
        },
      });
    }

    // Se estiver usando saldo, verificar se tem saldo suficiente
    if (user.balance < installmentAmount) {
      return c.json({ success: false, message: 'Saldo insuficiente para a reposição desta parcela' }, 400);
    }

    // Deduzir do usuário
    await pool.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [installmentAmount, user.id]
    );

    // Registrar pagamento da parcela
    await pool.query(
      'INSERT INTO loan_installments (loan_id, amount, use_balance, created_at) VALUES ($1, $2, $3, $4)',
      [loanId, installmentAmount, true, new Date()]
    );

    // Separar principal e juros da parcela atual (Proporcional)
    const principalPortion = installmentAmount * (parseFloat(loan.amount) / parseFloat(loan.total_repayment));
    const interestPortion = installmentAmount - principalPortion;

    // Devolver principal ao sistema a cada parcela
    await pool.query(
      'UPDATE system_config SET system_balance = system_balance + $1',
      [principalPortion]
    );

    // Adicionar juros ao pool de lucros a cada parcela
    await pool.query(
      'UPDATE system_config SET profit_pool = profit_pool + $1',
      [interestPortion]
    );

    // Verificar se todas as parcelas foram pagas
    if (newPaidAmount >= parseFloat(loan.total_repayment)) {
      // Marcar empréstimo como PAGO
      await pool.query(
        'UPDATE loans SET status = $1 WHERE id = $2',
        ['PAID', loanId]
      );

      // Atualizar Score por pagamento de empréstimo (Recompensa)
      const isLate = new Date() > new Date(loan.due_date);
      if (isLate) {
        // Se estiver atrasado, poderia haver uma lógica de penalidade aqui, 
        // mas a recompensa de "pagamento em dia" certamente não se aplica.
        // Por enquanto, apenas não damos a recompensa se estiver muito atrasado.
      } else {
        await updateScore(pool, user.id, SCORE_REWARDS.LOAN_PAYMENT_ON_TIME, 'Pagamento integral de empréstimo em dia');
      }
    }

    // Criar transação de pagamento APROVADA
    const transaction = await pool.query(
      `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
       VALUES ($1, 'LOAN_PAYMENT', $2, $3, 'APPROVED', $4)
       RETURNING id`,
      [
        user.id,
        installmentAmount,
        `Reposição de parcela (Saldo) - ${newPaidAmount >= parseFloat(loan.total_repayment) ? 'Compromisso Finalizado' : 'Restante: R$ ' + (parseFloat(loan.total_repayment) - newPaidAmount).toFixed(2)}`,
        JSON.stringify({
          loanId,
          installmentAmount,
          useBalance: true,
          paymentType: 'installment',
          isInstallment: true,
          remainingAmount: parseFloat(loan.total_repayment) - newPaidAmount
        })
      ]
    );

    return c.json({
      success: true,
      message: 'Parcela paga com saldo!',
      data: {
        transactionId: transaction.rows[0].id,
        remainingAmount: parseFloat(loan.total_repayment) - newPaidAmount,
        isFullyPaid: newPaidAmount >= parseFloat(loan.total_repayment)
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }

    console.error('Erro ao pagar parcela:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

export { loanRoutes };