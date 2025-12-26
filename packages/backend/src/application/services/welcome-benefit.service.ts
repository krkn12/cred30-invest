/**
 * Serviço de Benefício de Boas-Vindas
 * 
 * Gerencia o desconto nas taxas para usuários indicados.
 * O benefício consiste em:
 * - Taxa de empréstimo de 3.5% (ao invés de 20%)
 * - 50% de desconto em todas as outras taxas
 * - Válido por 3 usos de qualquer serviço (empréstimo, saque, marketplace)
 * 
 * Após 3 usos, as taxas voltam ao normal.
 */

import { Pool, PoolClient } from 'pg';
import {
    WELCOME_BENEFIT_MAX_USES,
    WELCOME_LOAN_INTEREST_RATE,
    WELCOME_LOAN_ORIGINATION_FEE_RATE,
    WELCOME_WITHDRAWAL_FIXED_FEE,
    WELCOME_MARKETPLACE_ESCROW_FEE_RATE,
    LOAN_INTEREST_RATE,
    LOAN_ORIGINATION_FEE_RATE,
    WITHDRAWAL_FIXED_FEE,
    MARKETPLACE_ESCROW_FEE_RATE
} from '../../shared/constants/business.constants';

export interface WelcomeBenefit {
    hasDiscount: boolean;
    usesRemaining: number;
    loanInterestRate: number;
    loanOriginationFeeRate: number;
    withdrawalFee: number;
    marketplaceEscrowFeeRate: number;
}

/**
 * Verifica se o usuário foi indicado e quantos usos de benefício ainda tem
 */
export async function getWelcomeBenefit(
    pool: Pool | PoolClient,
    userId: number | string
): Promise<WelcomeBenefit> {
    // Valores padrão (sem desconto)
    const defaultRates: WelcomeBenefit = {
        hasDiscount: false,
        usesRemaining: 0,
        loanInterestRate: LOAN_INTEREST_RATE,
        loanOriginationFeeRate: LOAN_ORIGINATION_FEE_RATE,
        withdrawalFee: WITHDRAWAL_FIXED_FEE,
        marketplaceEscrowFeeRate: MARKETPLACE_ESCROW_FEE_RATE
    };

    try {
        // Verificar se o usuário foi indicado (tem referred_by)
        const userResult = await pool.query(
            `SELECT referred_by, welcome_benefit_uses FROM users WHERE id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return defaultRates;
        }

        const user = userResult.rows[0];

        // Se não foi indicado, não tem benefício
        if (!user.referred_by) {
            return defaultRates;
        }

        // Calcular usos restantes (padrão é 0 se a coluna ainda não existir)
        const usesCount = user.welcome_benefit_uses || 0;
        const usesRemaining = Math.max(0, WELCOME_BENEFIT_MAX_USES - usesCount);

        // Se já usou todas as vezes, não tem mais benefício
        if (usesRemaining <= 0) {
            return defaultRates;
        }

        // Retornar taxas com desconto
        return {
            hasDiscount: true,
            usesRemaining,
            loanInterestRate: WELCOME_LOAN_INTEREST_RATE,
            loanOriginationFeeRate: WELCOME_LOAN_ORIGINATION_FEE_RATE,
            withdrawalFee: WELCOME_WITHDRAWAL_FIXED_FEE,
            marketplaceEscrowFeeRate: WELCOME_MARKETPLACE_ESCROW_FEE_RATE
        };
    } catch (error) {
        console.error('Erro ao verificar benefício de boas-vindas:', error);
        return defaultRates;
    }
}

/**
 * Consome um uso do benefício de boas-vindas
 * Deve ser chamado após cada uso de serviço com desconto
 */
export async function consumeWelcomeBenefitUse(
    pool: Pool | PoolClient,
    userId: number | string,
    serviceType: 'LOAN' | 'WITHDRAWAL' | 'MARKETPLACE'
): Promise<{ success: boolean; usesRemaining: number }> {
    try {
        // Incrementar o contador de usos
        const result = await pool.query(
            `UPDATE users 
       SET welcome_benefit_uses = COALESCE(welcome_benefit_uses, 0) + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING welcome_benefit_uses`,
            [userId]
        );

        if (result.rows.length === 0) {
            return { success: false, usesRemaining: 0 };
        }

        const newUsesCount = result.rows[0].welcome_benefit_uses;
        const usesRemaining = Math.max(0, WELCOME_BENEFIT_MAX_USES - newUsesCount);

        console.log(`[WELCOME_BENEFIT] Usuário ${userId} usou benefício (${serviceType}). Usos restantes: ${usesRemaining}`);

        return { success: true, usesRemaining };
    } catch (error) {
        console.error('Erro ao consumir benefício de boas-vindas:', error);
        return { success: false, usesRemaining: 0 };
    }
}

/**
 * Verifica se um usuário específico ainda tem benefício disponível
 */
export async function hasWelcomeBenefit(
    pool: Pool | PoolClient,
    userId: number | string
): Promise<boolean> {
    const benefit = await getWelcomeBenefit(pool, userId);
    return benefit.hasDiscount;
}

/**
 * Retorna uma descrição amigável do benefício para exibir ao usuário
 */
export function getWelcomeBenefitDescription(benefit: WelcomeBenefit): string {
    if (!benefit.hasDiscount) {
        return '';
    }

    return `🎁 Benefício de Boas-Vindas ativo! Taxa especial de ${(benefit.loanInterestRate * 100).toFixed(1)}% em empréstimos e 50% de desconto em outras taxas. Usos restantes: ${benefit.usesRemaining}/${WELCOME_BENEFIT_MAX_USES}`;
}
