import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, securityLockMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { LOAN_INTEREST_RATE, ONE_MONTH_MS, PENALTY_RATE, LOAN_ORIGINATION_FEE_RATE } from '../../../shared/constants/business.constants';
import { updateScore, SCORE_REWARDS } from '../../../application/services/score.service';
import { createPixPayment, createCardPayment } from '../../../infrastructure/gateways/asaas.service';
import { calculateTotalToPay, PaymentMethod } from '../../../shared/utils/financial.utils';
import { executeInTransaction, processLoanApproval } from '../../../domain/services/transaction.service';
import { calculateUserLoanLimit } from '../../../application/services/credit-analysis.service';
import { PoolClient } from 'pg';
import { getWelcomeBenefit, consumeWelcomeBenefitUse, getWelcomeBenefitDescription } from '../../../application/services/welcome-benefit.service';

const loanRoutes = new Hono();

// Aplicar trava de segurança para solicitações e pagamentos
loanRoutes.use('/request', securityLockMiddleware);
loanRoutes.use('/repay', securityLockMiddleware);
loanRoutes.use('/repay-installment', securityLockMiddleware);

// Esquema de validação para solicitação de empréstimo
const createLoanSchema = z.object({
  amount: z.number().positive(),
  installments: z.number().int().min(1).max(12),
});

const cardDataSchema = {
  creditCard: z.object({
    holderName: z.string(),
    number: z.string(),
    expiryMonth: z.string(),
    expiryYear: z.string(),
    ccv: z.string(),
  }).optional(),
  creditCardHolderInfo: z.object({
    name: z.string(),
    email: z.string(),
    cpfCnpj: z.string(),
    postalCode: z.string(),
    addressNumber: z.string(),
    phone: z.string(),
  }).optional(),
};

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
  installments: z.number().optional(),
  ...cardDataSchema
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
  installments: z.number().optional(),
  ...cardDataSchema
});

// Listar empréstimos do usuário
loanRoutes.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const pool = getDbPool(c);

    // Buscar empréstimos do usuário
    // Otimização: Resolve o problema N+1 usando agregação lateral ou JSON no SQL
    const result = await pool.query(
      `SELECT l.*,
              COALESCE(
                (SELECT json_agg(json_build_object(
                  'id', li.id,
                  'amount', li.amount::float,
                  'useBalance', li.use_balance,
                  'createdAt', li.created_at
                ) ORDER BY li.created_at ASC)
                 FROM loan_installments li 
                 WHERE li.loan_id = l.id),
                '[]'
              ) as installments_json
       FROM loans l
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC`,
      [user.id]
    );

    const formattedLoans = result.rows.map(loan => {
      const paidInstallments = loan.installments_json;
      const totalPaid = paidInstallments.reduce((sum: number, inst: any) => sum + inst.amount, 0);
      const remainingAmount = parseFloat(loan.total_repayment) - totalPaid;

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
        paidInstallmentsCount: paidInstallments.length,
        isFullyPaid: totalPaid >= parseFloat(loan.total_repayment)
      };
    });

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
    const { amount, installments } = createLoanSchema.parse(body);

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

    // ===== SISTEMA DE BENEFÍCIO DE BOAS-VINDAS =====
    // Verificar se o usuário tem desconto por indicação
    const welcomeBenefit = await getWelcomeBenefit(pool, user.id);
    const effectiveInterestRate = welcomeBenefit.loanInterestRate;
    const effectiveOriginationRate = welcomeBenefit.loanOriginationFeeRate;

    console.log(`[LOAN] Usuário ${user.id} - Benefício: ${welcomeBenefit.hasDiscount ? 'ATIVO' : 'INATIVO'}, Taxa de juros: ${(effectiveInterestRate * 100).toFixed(1)}%, Taxa de originação: ${(effectiveOriginationRate * 100).toFixed(1)}%`);

    // Calcular taxas e juros (usando taxas do benefício se aplicável)
    const originationFee = amount * effectiveOriginationRate; // Ganho imediato pro caixa
    const amountToDisburse = amount - originationFee; // O que o usuário recebe de fato
    const totalWithInterest = amount * (1 + effectiveInterestRate);

    const result = await executeInTransaction(pool, async (client: PoolClient) => {
      const loanResult = await client.query(
        `INSERT INTO loans (user_id, amount, total_repayment, installments, interest_rate, penalty_rate, status, due_date, term_days, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, $9)
         RETURNING id`,
        [
          user.id,
          amount,
          totalWithInterest,
          installments,
          effectiveInterestRate,
          PENALTY_RATE,
          new Date(Date.now() + (installments * ONE_MONTH_MS)),
          installments * 30,
          JSON.stringify({
            originationFee,
            disbursedAmount: amountToDisburse,
            welcomeBenefitApplied: welcomeBenefit.hasDiscount,
            originalInterestRate: LOAN_INTEREST_RATE,
            appliedInterestRate: effectiveInterestRate
          })
        ]
      );

      const newLoanId = loanResult.rows[0].id;

      // Destinar a taxa de originação (Regra 85/15)
      const feeForOperational = originationFee * 0.85;
      const feeForProfit = originationFee * 0.15;

      await client.query(
        'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
        [feeForOperational, feeForProfit]
      );

      // Se usou benefício, consumir um uso
      if (welcomeBenefit.hasDiscount) {
        await consumeWelcomeBenefitUse(client, user.id, 'LOAN');
      }

      // Tentar aprovação imediata se houver liquidez
      // Se não houver, o disbursement-queue.service.ts aprovará sozinho depois
      try {
        const systemQuotasRes = await client.query("SELECT COUNT(*) as count FROM quotas WHERE status = 'ACTIVE'");
        const systemActiveLoansRes = await client.query("SELECT COALESCE(SUM(amount), 0) as total FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')");
        const systemQuotasCount = parseInt(systemQuotasRes.rows[0].count);
        const systemTotalLoaned = parseFloat(systemActiveLoansRes.rows[0].total);
        const systemGrossCash = systemQuotasCount * 50;
        const realLiquidity = systemGrossCash - systemTotalLoaned;

        if (amount <= realLiquidity) {
          await processLoanApproval(client, newLoanId.toString(), 'APPROVE');
          return { loanId: newLoanId, autoApproved: true, welcomeBenefitApplied: welcomeBenefit.hasDiscount };
        }
      } catch (e) {
        console.error('Erro na tentativa de auto-aprovação imediata:', e);
      }

      return { loanId: newLoanId, autoApproved: false, welcomeBenefitApplied: welcomeBenefit.hasDiscount };
    });

    const isAutoApproved = result.data?.autoApproved;
    const benefitApplied = result.data?.welcomeBenefitApplied;

    // Montar mensagem com info do benefício
    let baseMessage = isAutoApproved
      ? `Apoio Mútuo aprovado e creditado com sucesso! O valor de R$ ${amountToDisburse.toFixed(2)} já está disponível no seu saldo interno.`
      : `Solicitação enviada para a fila automática! Como o caixa está com muita demanda, seu pedido será processado assim que houver novos recursos, priorizando membros com mais participações e maior score.`;

    if (benefitApplied) {
      baseMessage += ` 🎁 Taxa especial de ${(effectiveInterestRate * 100).toFixed(1)}% aplicada (Benefício de Boas-Vindas). Usos restantes: ${welcomeBenefit.usesRemaining - 1}/3`;
    }

    return c.json({
      success: true,
      message: baseMessage,
      data: {
        loanId: result.data?.loanId,
        totalRepayment: totalWithInterest,
        interestRate: effectiveInterestRate,
        originationFee,
        disbursedAmount: amountToDisburse,
        autoApproved: isAutoApproved,
        welcomeBenefitApplied: benefitApplied,
        welcomeBenefitUsesRemaining: benefitApplied ? welcomeBenefit.usesRemaining - 1 : 0
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }

    console.error('Erro ao solicitar apoio:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Pagar apoio
loanRoutes.post('/repay', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { loanId, useBalance, paymentMethod, installments } = repayLoanSchema.parse(body);

    const user = c.get('user');
    const pool = getDbPool(c);

    // Buscar apoio
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

    // Buscar CPF do usuário para pagamento no Asaas
    const userInfoResult = await pool.query(
      'SELECT cpf, name FROM users WHERE id = $1',
      [user.id]
    );
    const userCpf = userInfoResult.rows[0]?.cpf;
    const userName = userInfoResult.rows[0]?.name;

    // Calcular separação entre principal e juros
    const totalRepayment = parseFloat(loan.total_repayment);
    const principalAmount = parseFloat(loan.amount);
    const totalInterest = totalRepayment - principalAmount;

    // Calcular valores com taxas conforme o método
    const method: PaymentMethod = useBalance ? 'balance' : (paymentMethod as PaymentMethod);
    const { total: finalCost, fee: userFee } = calculateTotalToPay(totalRepayment, method);

    console.log('DEBUG - Pagamento completo do apoio:', {
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

    // Atualizar status do apoio para pagamento pendente
    await pool.query(
      'UPDATE loans SET status = $1 WHERE id = $2',
      ['PAYMENT_PENDING', loanId]
    );

    let mpData: any = null;
    if (!useBalance) {
      try {
        if (paymentMethod === 'card' && body.creditCard) {
          mpData = await createCardPayment({
            amount: finalCost,
            description: `Reposição total de apoio no sistema Cred30`,
            email: user.email,
            external_reference: `REPAY_${loanId}_${Date.now()}`,
            installments: installments,
            cpf: userCpf,
            name: userName,
            creditCard: body.creditCard,
            creditCardHolderInfo: body.creditCardHolderInfo
          });
        } else {
          try {
            mpData = await createPixPayment({
              amount: finalCost,
              description: `Reposição total de apoio no sistema Cred30`,
              email: user.email,
              external_reference: `REPAY_${loanId}_${Date.now()}`,
              cpf: userCpf,
              name: userName
            });
          } catch (pixErr) {
            console.error('Erro PIX (seguindo manual):', pixErr);
          }
        }
      } catch (mpError) {
        console.error('Erro ao gerar cobrança Asaas:', mpError);
        // CORREÇÃO CRÍTICA: Se for cartão, o erro DEVE ser repassado ao frontend
        if (paymentMethod === 'card') {
          throw mpError;
        }
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
        `Reposição de Apoio Mútuo (${useBalance ? 'Saldo' : (mpData ? 'Asaas' : 'Externo')}) - Aguardando Confirmação`,
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

    console.error('Erro ao pagar apoio:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Pagar parcela específica de apoio
loanRoutes.post('/repay-installment', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { loanId, installmentAmount, useBalance, paymentMethod, installments } = repayInstallmentSchema.parse(body);

    const user = c.get('user');
    const pool = getDbPool(c);

    // Buscar apoio
    const loanResult = await pool.query(
      'SELECT * FROM loans WHERE id = $1 AND user_id = $2',
      [loanId, user.id]
    );

    if (loanResult.rows.length === 0) {
      return c.json({ success: false, message: 'Apoio não encontrado' }, 404);
    }

    const loan = loanResult.rows[0];

    if (loan.status !== 'APPROVED') {
      return c.json({ success: false, message: 'Apoio não está ativo para pagamento' }, 400);
    }

    // Buscar CPF do usuário para pagamento no Asaas
    const userInfoResult = await pool.query(
      'SELECT cpf, name FROM users WHERE id = $1',
      [user.id]
    );
    const userCpf = userInfoResult.rows[0]?.cpf;
    const userName = userInfoResult.rows[0]?.name;

    // Verificar se o apoio já tem parcelas pagas
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
    let mpData: any = null;
    if (!useBalance) {
      try {
        if (paymentMethod === 'card' && body.creditCard) {
          mpData = await createCardPayment({
            amount: finalInstallmentCost,
            description: `Pagamento de parcela de apoio no Cred30`,
            email: user.email,
            external_reference: `INSTALLMENT_${loanId}_${Date.now()}`,
            installments: installments,
            cpf: userCpf,
            name: userName,
            creditCard: body.creditCard,
            creditCardHolderInfo: body.creditCardHolderInfo
          });
        } else {
          try {
            mpData = await createPixPayment({
              amount: finalInstallmentCost,
              description: `Pagamento de parcela de apoio no Cred30`,
              email: user.email,
              external_reference: `INSTALLMENT_${loanId}_${Date.now()}`,
              cpf: userCpf,
              name: userName
            });
          } catch (pixErr) {
            console.error('Erro PIX (seguindo manual):', pixErr);
          }
        }
      } catch (mpError) {
        console.error('Erro ao gerar cobrança Asaas:', mpError);
        // CORREÇÃO CRÍTICA: Se for cartão, o erro DEVE ser repassado ao frontend
        if (paymentMethod === 'card') {
          throw mpError;
        }
      }

      const transaction = await pool.query(
        `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
           VALUES ($1, 'LOAN_PAYMENT', $2, $3, 'PENDING', $4)
           RETURNING id`,
        [
          user.id,
          finalInstallmentCost,
          `Pagamento parcela (${mpData ? 'Asaas' : 'Externo'}) - Aguardando Confirmação`,
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
        message: 'Código de reposição gerado! Aguarde a confirmação do Clube.',
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
      // Marcar apoio como PAGO
      await pool.query(
        'UPDATE loans SET status = $1 WHERE id = $2',
        ['PAID', loanId]
      );

      // Atualizar Score por pagamento de apoio (Recompensa)
      const isLate = new Date() > new Date(loan.due_date);
      if (isLate) {
        // Se estiver atrasado, poderia haver uma lógica de penalidade aqui, 
        // mas a recompensa de "pagamento em dia" certamente não se aplica.
        // Por enquanto, apenas não damos a recompensa se estiver muito atrasado.
      } else {
        await updateScore(pool, user.id, SCORE_REWARDS.LOAN_PAYMENT_ON_TIME, 'Reposição integral de apoio em dia');
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