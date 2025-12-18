import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { LOAN_INTEREST_RATE, ONE_MONTH_MS, PENALTY_RATE } from '../../../shared/constants/business.constants';
import { updateScore, SCORE_REWARDS } from '../../../application/services/score.service';

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
      // Aplicar penalidade de score por atraso (se ainda não foi aplicada hoje, por exemplo, 
      // mas aqui aplicaremos a cada tentativa de novo empréstimo como aviso)
      await updateScore(pool, user.id, -50, 'Tentativa de novo empréstimo com parcelas em atraso');

      return c.json({
        success: false,
        message: 'Você possui empréstimos em atraso. Regularize sua situação para solicitar novos créditos.'
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

    // Calcular valor total com juros
    const totalWithInterest = amount * (1 + LOAN_INTEREST_RATE);

    // Criar empréstimo
    const result = await pool.query(
      `INSERT INTO loans (user_id, amount, total_repayment, installments, interest_rate, penalty_rate, status, due_date, pix_key_to_receive, term_days)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, $9)
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
        installments * 30 // Calculando term_days
      ]
    );

    console.log('DEBUG - Empréstimo criado com PIX:', {
      loanId: result.rows[0].id,
      pixKeyToSave
    });

    return c.json({
      success: true,
      message: 'Empréstimo solicitado! Aguarde aprovação do administrador.',
      data: {
        loanId: result.rows[0].id,
        totalRepayment: totalWithInterest,
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
    const { loanId, useBalance } = repayLoanSchema.parse(body);

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

    // Calcular separação entre principal e juros
    const totalRepayment = parseFloat(loan.total_repayment);
    const principalAmount = parseFloat(loan.amount);
    const totalInterest = totalRepayment - principalAmount;

    console.log('DEBUG - Pagamento completo do empréstimo:', {
      loanId,
      totalRepayment,
      principalAmount,
      totalInterest,
      useBalance
    });

    // Se estiver usando saldo, verificar se tem saldo suficiente
    if (useBalance && user.balance < totalRepayment) {
      return c.json({ success: false, message: 'Saldo insuficiente para pagar o empréstimo' }, 400);
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

    // Criar transação de pagamento
    const transaction = await pool.query(
      `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
         VALUES ($1, 'LOAN_PAYMENT', $2, $3, 'PENDING', $4)
         RETURNING id`,
      [
        user.id,
        totalRepayment,
        `Pagamento de empréstimo (${useBalance ? 'Saldo' : 'PIX Externo'}) - Aguardando Confirmação`,
        JSON.stringify({
          loanId,
          useBalance,
          principalAmount,
          interestAmount: totalInterest,
          paymentType: 'full_payment'
        })
      ]
    );

    return c.json({
      success: true,
      message: 'Pagamento enviado para análise! Aguarde confirmação.',
      data: {
        transactionId: transaction.rows[0].id,
        principalAmount,
        interestAmount: totalInterest,
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
    const { loanId, installmentAmount, useBalance } = repayInstallmentSchema.parse(body);

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
    const remainingAmount = parseFloat(loan.total_repayment) - paidAmount;

    // Validar valor da parcela
    if (installmentAmount > remainingAmount) {
      return c.json({ success: false, message: 'Valor da parcela excede o valor restante' }, 400);
    }

    // Calcular novo valor pago (incluindo esta parcela)
    const newPaidAmount = paidAmount + installmentAmount;

    // Se for pagamento via PIX (não usa saldo), criar transação PENDENTE e NÃO registrar parcela ainda
    if (!useBalance) {
      const transaction = await pool.query(
        `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
         VALUES ($1, 'LOAN_PAYMENT', $2, $3, 'PENDING', $4)
         RETURNING id`,
        [
          user.id,
          installmentAmount,
          `Pagamento parcela (PIX Externo) - Aguardando Confirmação`,
          JSON.stringify({
            loanId,
            installmentAmount,
            useBalance: false,
            paymentType: 'installment', // Identificador importante para o admin
            isInstallment: true,
            remainingAmount: remainingAmount - installmentAmount
          })
        ]
      );

      return c.json({
        success: true,
        message: 'Código de pagamento gerado via PIX! Aguarde confirmação do administrador.',
        data: {
          transactionId: transaction.rows[0].id,
          remainingAmount: remainingAmount, // Valor não muda visualmente até aprovação
          isFullyPaid: false
        },
      });
    }

    // Se estiver usando saldo, verificar se tem saldo suficiente
    if (user.balance < installmentAmount) {
      return c.json({ success: false, message: 'Saldo insuficiente para pagar esta parcela' }, 400);
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
        `Pagamento parcela (Saldo) - ${newPaidAmount >= parseFloat(loan.total_repayment) ? 'Empréstimo Quitado' : 'Restante: R$ ' + (parseFloat(loan.total_repayment) - newPaidAmount).toFixed(2)}`,
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