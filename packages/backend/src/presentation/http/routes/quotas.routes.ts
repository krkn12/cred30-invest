import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { QUOTA_PRICE, VESTING_PERIOD_MS, PENALTY_RATE, QUOTA_PURCHASE_FEE_RATE } from '../../../shared/constants/business.constants';
import { Quota } from '../../../domain/entities/quota.entity';
import { UserContext } from '../../../shared/types/hono.types';
import { executeInTransaction, lockUserBalance, updateUserBalance, createTransaction } from '../../../domain/services/transaction.service';
import { updateScore, SCORE_REWARDS } from '../../../application/services/score.service';
import { financialRateLimit } from '../middleware/rate-limit.middleware';
import { createPixPayment, createCardPayment } from '../../../infrastructure/gateways/mercadopago.service';
import { calculateTotalToPay, PaymentMethod } from '../../../shared/utils/financial.utils';

// Função auxiliar para registrar auditoria financeira
const logFinancialAudit = (operation: string, userId: string, details: any) => {
  console.log(`[AUDIT_FINANCEIRA] ${operation}`, {
    timestamp: new Date().toISOString(),
    userId,
    operation,
    details: JSON.stringify(details),
  });
};

const quotaRoutes = new Hono();

// Aplicar rate limiting a operações financeiras de cotas
quotaRoutes.use('/buy', financialRateLimit);
quotaRoutes.use('/sell', financialRateLimit);
quotaRoutes.use('/sell-all', financialRateLimit);

// Esquema de validação para compra de cotas
const buyQuotaSchema = z.object({
  quantity: z.number().int().positive(),
  useBalance: z.boolean(),
  paymentMethod: z.enum(['pix', 'card']).optional().default('pix'),
  token: z.string().optional(),
  issuer_id: z.union([z.string(), z.number()]).optional(),
  installments: z.number().optional(),
  payment_method_id: z.string().optional(),
});

// Esquema de validação para venda de cotas
const sellQuotaSchema = z.object({
  quotaId: z.string(),
});

// Listar cotas do usuário
quotaRoutes.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // Buscar cotas do usuário
    const result = await pool.query(
      'SELECT id, user_id, purchase_price, current_value, purchase_date FROM quotas WHERE user_id = $1',
      [user.id]
    );

    // Formatar cotas para resposta
    const formattedQuotas = result.rows.map(quota => ({
      id: quota.id,
      userId: quota.user_id,
      purchasePrice: parseFloat(quota.purchase_price),
      purchaseDate: new Date(quota.purchase_date).getTime(),
      currentValue: parseFloat(quota.current_value),
      yieldRate: 1.001, // Taxa fixa por enquanto
    }));

    return c.json({
      success: true,
      data: {
        quotas: formattedQuotas,
      },
    });
  } catch (error) {
    console.error('Erro ao listar cotas:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Comprar cotas
quotaRoutes.post('/buy', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { quantity, useBalance, paymentMethod, token, issuer_id, installments } = buyQuotaSchema.parse(body);

    // Calcular valores com taxas conforme o método
    const baseCost = quantity * QUOTA_PRICE;
    const serviceFee = baseCost * QUOTA_PURCHASE_FEE_RATE; // Taxa da plataforma
    const totalWithServiceFee = baseCost + serviceFee;

    const method: PaymentMethod = useBalance ? 'balance' : (paymentMethod as PaymentMethod);
    const { total: finalCost, fee: userFee } = calculateTotalToPay(totalWithServiceFee, method);

    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // Validar limites
    if (quantity > 100) {
      return c.json({
        success: false,
        message: 'Quantidade máxima por ativação é 100 licenças'
      }, 400);
    }

    if (baseCost > 50000) {
      return c.json({
        success: false,
        message: 'Valor máximo por ativação é R$ 50.000,00'
      }, 400);
    }

    // Executar operação dentro de transação ACID
    const result = await executeInTransaction(pool, async (client) => {
      // Se estiver usando saldo, verificar e bloquear
      if (useBalance) {
        const balanceCheck = await lockUserBalance(client, user.id, totalWithServiceFee);
        if (!balanceCheck.success) {
          throw new Error(balanceCheck.error);
        }

        // Deduzir saldo (Custo base + Taxa da plataforma)
        const updateResult = await updateUserBalance(client, user.id, totalWithServiceFee, 'debit');
        if (!updateResult.success) {
          throw new Error(updateResult.error);
        }

        // Destinar a taxa de serviço (Regra 85/15)
        const feeForOperational = serviceFee * 0.85;
        const feeForProfit = serviceFee * 0.15;

        await client.query(
          'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
          [feeForOperational, feeForProfit]
        );

        // Criar cotas imediatamente (compra com saldo)
        for (let i = 0; i < quantity; i++) {
          await client.query(
            `INSERT INTO quotas (user_id, purchase_price, current_value, purchase_date, status)
             VALUES ($1, $2, $3, $4, 'ACTIVE')`,
            [user.id, QUOTA_PRICE, QUOTA_PRICE, new Date()]
          );
        }

        // Criar transação APROVADA (compra com saldo)
        const transactionResult = await createTransaction(
          client,
          user.id,
          'BUY_QUOTA',
          totalWithServiceFee,
          `Aquisição de ${quantity} participação(ões) (+ R$ ${serviceFee.toFixed(2)} taxa de sustentabilidade) - APROVADA`,
          'APPROVED',
          { quantity, useBalance, paymentMethod: 'balance', serviceFee }
        );

        if (!transactionResult.success) {
          throw new Error(transactionResult.error);
        }

        // 5. Pagamento de Bônus de Indicação (Sustentável: Sai da Receita da Cota)
        // Se o usuário foi indicado por alguém, pagamos R$ 5,00 ao indicador agora.
        const currentUserRes = await client.query('SELECT referred_by FROM users WHERE id = $1', [user.id]);
        const referredByCode = currentUserRes.rows[0]?.referred_by;

        if (referredByCode) {
          // Tentar achar usuário dono do código
          const referrerRes = await client.query('SELECT id, name FROM users WHERE referral_code = $1', [referredByCode]);

          if (referrerRes.rows.length > 0) {
            const referrerId = referrerRes.rows[0].id;
            const bonusAmount = 5.00; // Valor fixo por conversão (CPA)

            // Creditar bônus
            await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [bonusAmount, referrerId]);

            // Registrar Custo de Marketing (Indicação) no Sistema
            // Isso garante que o caixa reflete a saída dos R$ 5,00 (50 entrou - 5 saiu = 45 líquido)
            await client.query('UPDATE system_config SET total_manual_costs = total_manual_costs + $1', [bonusAmount]);

            // Registrar transação
            await createTransaction(
              client,
              referrerId,
              'REFERRAL_BONUS',
              bonusAmount,
              `Bônus por indicação: ${user.name} ativou licença(s)`,
              'APPROVED'
            );
          }
        }

        // 6. Atualizar Score por participação
        await updateScore(client, user.id, SCORE_REWARDS.QUOTA_PURCHASE * quantity, `Aquisição de ${quantity} participações`);

        return {
          transactionId: transactionResult.transactionId,
          cost: baseCost,
          quantity,
          immediateApproval: true
        };
      } else {
        // Criar transação pendente (compra via PIX/Cartão)
        const external_reference = `BUY_QUOTA_${user.id}_${Date.now()}`;

        let mpData = null;
        try {
          if (paymentMethod === 'card' && token) {
            mpData = await createCardPayment({
              amount: finalCost,
              description: `Aquisição de ${quantity} participação(ões) no sistema Cred30`,
              email: user.email,
              external_reference,
              token,
              issuer_id: issuer_id ? Number(issuer_id) : undefined,
              installments: installments,
              payment_method_id: 'master' // O Brick enviará o ID correto se necessário, mas para o SDKv2 o token já contém a info
            });
          } else {
            mpData = await createPixPayment({
              amount: finalCost,
              description: `Aquisição de ${quantity} participação(ões) no sistema Cred30`,
              email: user.email,
              external_reference
            });
          }
        } catch (mpError) {
          console.error('Erro ao gerar cobrança Mercado Pago:', mpError);
          // Prosseguir mesmo sem MP automático, admin verá como pendente normal
        }

        const transactionResult = await createTransaction(
          client,
          user.id,
          'BUY_QUOTA',
          finalCost,
          `Aquisição de ${quantity} participação(ões) - ${mpData ? 'Mercado Pago' : 'Aguardando Aprovação'}`,
          'PENDING',
          {
            quantity,
            useBalance,
            paymentMethod: paymentMethod,
            mp_id: mpData?.id,
            qr_code: mpData?.qr_code,
            qr_code_base64: mpData?.qr_code_base64,
            external_reference,
            baseCost,
            userFee
          }
        );

        if (!transactionResult.success) {
          throw new Error(transactionResult.error);
        }

        return {
          transactionId: transactionResult.transactionId,
          cost: baseCost,
          finalCost: finalCost,
          userFee: userFee,
          quantity,
          immediateApproval: false,
          pixData: mpData?.qr_code ? mpData : null,
          cardData: paymentMethod === 'card' ? mpData : null
        };
      }
    });

    if (!result.success) {
      return c.json({
        success: false,
        message: result.error
      }, 400);
    }

    const message = result.data?.immediateApproval
      ? `Aquisição de ${result.data?.quantity} participação(ões) aprovada imediatamente!`
      : 'Solicitação de participação enviada! Aguarde a confirmação do Clube.';

    return c.json({
      success: true,
      message,
      data: {
        transactionId: result.data?.transactionId,
        cost: result.data?.cost,
        finalCost: result.data?.finalCost,
        userFee: result.data?.userFee,
        quantity: result.data?.quantity,
        immediateApproval: result.data?.immediateApproval,
        pixData: result.data?.pixData,
        cardData: result.data?.cardData
      },
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

// Vender uma cota
quotaRoutes.post('/sell', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { quotaId } = sellQuotaSchema.parse(body);

    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // Verificar se o usuário tem empréstimos ativos
    const activeLoansResult = await pool.query(
      "SELECT COUNT(*) FROM loans WHERE user_id = $1 AND status IN ('PENDING', 'APPROVED', 'PAYMENT_PENDING')",
      [user.id]
    );

    const activeLoans = parseInt(activeLoansResult.rows[0].count);

    if (activeLoans > 0) {
      return c.json({
        success: false,
        message: 'Operação bloqueada: Você possui compromissos ativos. Quite seus débitos antes de ceder participações.'
      }, 400);
    }

    // Buscar cota
    const quotaResult = await pool.query(
      'SELECT * FROM quotas WHERE id = $1 AND user_id = $2',
      [quotaId, user.id]
    );

    if (quotaResult.rows.length === 0) {
      return c.json({ success: false, message: 'Participação não encontrada' }, 404);
    }

    const quota = quotaResult.rows[0];

    // Calcular valor de resgate
    const now = Date.now();
    const timeDiff = now - new Date(quota.purchase_date).getTime();
    const isEarlyExit = timeDiff < VESTING_PERIOD_MS;

    const originalAmount = parseFloat(quota.purchase_price);
    let finalAmount = originalAmount;
    let penaltyAmount = 0;
    let profitAmount = 0;

    if (isEarlyExit) {
      penaltyAmount = originalAmount * PENALTY_RATE;
      finalAmount = originalAmount - penaltyAmount;
      // NOVA REGRA: A multa de 40% é direcionada para o lucro de juros
      // Isso transforma a penalidade em receita para o sistema
      profitAmount = penaltyAmount; // 100% da multa vai para o lucro de juros
    }

    // Registrar auditoria antes da transação
    const systemStateBefore = await pool.query(`
      SELECT
        (SELECT COALESCE(system_balance, 0) FROM system_config LIMIT 1) as system_balance,
        (SELECT COALESCE(profit_pool, 0) FROM system_config LIMIT 1) as profit_pool,
        0 as operational_cash
    `);

    const auditBefore = {
      quotaId,
      originalAmount,
      penaltyAmount,
      finalAmount,
      profitAmount,
      isEarlyExit,
      systemBalance: systemStateBefore.rows[0]?.system_balance,
      profitPool: systemStateBefore.rows[0]?.profit_pool,
      operationalCash: systemStateBefore.rows[0]?.operational_cash
    };
    logFinancialAudit('VENDA_COTA_ANTES', user.id, auditBefore);

    // Executar dentro de transação para consistência
    await executeInTransaction(pool, async (client) => {
      // Remover cota
      await client.query(
        'DELETE FROM quotas WHERE id = $1 AND user_id = $2',
        [quotaId, user.id]
      );

      // Adicionar valor ao saldo do usuário
      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [finalAmount, user.id]
      );

      // Adicionar multa ao lucro de juros (se houver multa)
      if (profitAmount > 0) {
        await client.query(
          'UPDATE system_config SET profit_pool = profit_pool + $1',
          [profitAmount]
        );
      }

      // Criar transação de cessão
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
         VALUES ($1, 'SELL_QUOTA', $2, $3, 'APPROVED', $4)`,
        [
          user.id,
          finalAmount,
          `Cessão de participação ${isEarlyExit ? '(Multa 40%)' : '(Integral)'}`,
          JSON.stringify({
            originalAmount,
            penaltyAmount: isEarlyExit ? penaltyAmount : 0,
            profitAmount: isEarlyExit ? penaltyAmount : 0, // Multa vai para o lucro
            isEarlyExit,
            note: isEarlyExit ? 'Multa de 40% aplicada (direcionada para lucro de juros)' : 'Cessão integral sem penalidade'
          })
        ]
      );
    });

    // Registrar auditoria após a transação
    const systemStateAfter = await pool.query(`
      SELECT
        (SELECT COALESCE(system_balance, 0) FROM system_config LIMIT 1) as system_balance,
        (SELECT COALESCE(profit_pool, 0) FROM system_config LIMIT 1) as profit_pool,
        0 as operational_cash
    `);

    const auditAfter = {
      ...auditBefore,
      newSystemBalance: systemStateAfter.rows[0]?.system_balance,
      newProfitPool: systemStateAfter.rows[0]?.profit_pool,
      newOperationalCash: systemStateAfter.rows[0]?.operational_cash
    };
    logFinancialAudit('VENDA_COTA_APOS', user.id, auditAfter);

    return c.json({
      success: true,
      message: 'Participação cedida com sucesso! Valor creditado no saldo.',
      data: {
        finalAmount,
        penaltyAmount: isEarlyExit ? penaltyAmount : 0,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }

    console.error('Erro ao vender cota:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Vender todas as cotas
quotaRoutes.post('/sell-all', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // Verificar se o usuário tem empréstimos ativos
    const activeLoansResult = await pool.query(
      "SELECT COUNT(*) FROM loans WHERE user_id = $1 AND status IN ('PENDING', 'APPROVED', 'PAYMENT_PENDING')",
      [user.id]
    );

    const activeLoans = parseInt(activeLoansResult.rows[0].count);

    if (activeLoans > 0) {
      return c.json({
        success: false,
        message: 'Operação bloqueada: Você possui compromissos ativos. Quite seus débitos antes de ceder participações.'
      }, 400);
    }

    // Buscar todas as cotas do usuário
    const userQuotasResult = await pool.query(
      'SELECT * FROM quotas WHERE user_id = $1',
      [user.id]
    );

    const userQuotas = userQuotasResult.rows;

    if (userQuotas.length === 0) {
      return c.json({ success: false, message: 'Você não possui participações para cessão' }, 400);
    }

    // Calcular valores
    let totalReceived = 0;
    let totalPenalty = 0;
    let totalProfit = 0;
    const now = Date.now();

    for (const quota of userQuotas) {
      const timeDiff = now - new Date(quota.purchase_date).getTime();
      const isEarlyExit = timeDiff < VESTING_PERIOD_MS;

      const originalAmount = parseFloat(quota.purchase_price);
      let amount = originalAmount;
      let penalty = 0;

      if (isEarlyExit) {
        penalty = originalAmount * PENALTY_RATE;
        amount = originalAmount - penalty;
        // CORREÇÃO: A multa é uma PERDA para o usuário, não lucro para o sistema
        // O dinheiro da multa simplesmente "desaparece" do sistema (é uma penalidade real)
        // Não adicionamos ao lucro de juros, pois isso criaria dinheiro do nada
        totalPenalty += penalty;
      }

      totalReceived += amount;
    }

    // Registrar auditoria antes da transação
    const systemStateBefore = await pool.query(`
      SELECT
        (SELECT COALESCE(system_balance, 0) FROM system_config LIMIT 1) as system_balance,
        (SELECT COALESCE(profit_pool, 0) FROM system_config LIMIT 1) as profit_pool,
        0 as operational_cash
    `);

    const auditBefore = {
      totalReceived,
      totalPenalty,
      totalProfit,
      quotasSold: userQuotas.length,
      hasEarlyExit: totalPenalty > 0,
      systemBalance: systemStateBefore.rows[0]?.system_balance,
      profitPool: systemStateBefore.rows[0]?.profit_pool,
      operationalCash: systemStateBefore.rows[0]?.operational_cash
    };
    logFinancialAudit('VENDA_TODAS_COTAS_ANTES', user.id, auditBefore);

    // Executar dentro de transação para consistência
    await executeInTransaction(pool, async (client) => {
      // Remover todas as cotas do usuário
      await client.query(
        'DELETE FROM quotas WHERE user_id = $1',
        [user.id]
      );

      // Adicionar valor ao saldo do usuário
      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [totalReceived, user.id]
      );

      // CORREÇÃO: Não adicionamos multas ao lucro de juros, pois isso criaria dinheiro do nada
      // As multas são penalidades reais que reduzem o dinheiro em circulação
      // if (totalProfit > 0) {
      //   await client.query(
      //     'UPDATE system_config SET profit_pool = profit_pool + $1',
      //     [totalProfit]
      //   );
      // }

      // Criar transação de venda
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
         VALUES ($1, 'SELL_QUOTA', $2, $3, 'APPROVED', $4)`,
        [
          user.id,
          totalReceived,
          'Resgate total de licenças',
          JSON.stringify({
            totalPenalty,
            totalProfit: 0, // Sempre 0, multas não geram lucro
            quotasSold: userQuotas.length,
            hasEarlyExit: totalPenalty > 0,
            note: totalPenalty > 0 ? 'Multas aplicadas (penalidade, não lucro)' : 'Resgate integral sem penalidade'
          })
        ]
      );
    });

    // Registrar auditoria após a transação
    const systemStateAfter = await pool.query(`
      SELECT
        (SELECT COALESCE(system_balance, 0) FROM system_config LIMIT 1) as system_balance,
        (SELECT COALESCE(profit_pool, 0) FROM system_config LIMIT 1) as profit_pool,
        0 as operational_cash
    `);

    const auditAfter = {
      ...auditBefore,
      newSystemBalance: systemStateAfter.rows[0]?.system_balance,
      newProfitPool: systemStateAfter.rows[0]?.profit_pool,
      newOperationalCash: systemStateAfter.rows[0]?.operational_cash
    };
    logFinancialAudit('VENDA_TODAS_COTAS_APOS', user.id, auditAfter);

    return c.json({
      success: true,
      message: `Resgate total realizado! R$ ${totalReceived.toFixed(2)} creditados.`,
      data: {
        totalReceived,
        totalPenalty,
        quotasSold: userQuotas.length,
      },
    });
  } catch (error) {
    console.error('Erro ao vender todas as cotas:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

export { quotaRoutes };