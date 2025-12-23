import { MARKETPLACE_ESCROW_FEE_RATE } from '../constants/app.constants';

// Taxas do Asaas (Gateway de Pagamento) - Sincronizadas com o Backend
export const MERCADO_PAGO_PIX_FEE_PERCENT = 0.0099; // 0.99% para PIX
export const MERCADO_PAGO_FIXED_FEE = 0.00; // R$ 0,00 fixo

// Cartão de Crédito: 2.99% + R$ 0.49 (Asaas - mais barato que MP)
export const MERCADO_PAGO_CARD_FEE_PERCENT = 0.0299; // 2.99% para Cartão (Asaas)
export const MERCADO_PAGO_CARD_FIXED_FEE = 0.49; // R$ 0,49 fixo (Asaas)

export type PaymentMethod = 'pix' | 'card' | 'balance';

/**
 * Calcula o valor total que o usuário deve pagar com repasse de taxas (Gross-up)
 * Sincronizado com a lógica de proteção do caixa da cooperativa.
 */
export const calculateTotalToPay = (amount: number, method: PaymentMethod = 'pix'): {
    baseAmount: number;
    fee: number;
    total: number;
} => {
    if (method === 'balance') {
        return {
            baseAmount: amount,
            fee: 0,
            total: amount
        };
    }

    // Para métodos externos (PIX e Cartão), usamos a fórmula de Gross-up 
    // para que o valor LÍQUIDO recebido seja exatamente o amount.
    // Fórmula: Total = (Valor + TaxaFixa) / (1 - TaxaPercentual)

    const percent = method === 'pix' ? MERCADO_PAGO_PIX_FEE_PERCENT : MERCADO_PAGO_CARD_FEE_PERCENT;
    const fixed = method === 'pix' ? MERCADO_PAGO_FIXED_FEE : MERCADO_PAGO_CARD_FIXED_FEE;

    const total = (amount + fixed) / (1 - percent);
    const fee = total - amount;

    return {
        baseAmount: amount,
        fee: Number(fee.toFixed(2)),
        total: Number(total.toFixed(2))
    };
};
