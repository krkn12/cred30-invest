// Preço da cota
export const QUOTA_PRICE = Number(process.env.QUOTA_PRICE) || 50;

// Taxa de juros de empréstimo (20%)
export const LOAN_INTEREST_RATE = Number(process.env.LOAN_INTEREST_RATE) || 0.2;

// Taxa de multa por resgate antecipado (40%)
export const PENALTY_RATE = Number(process.env.PENALTY_RATE) || 0.4;

// Período de carência em milissegundos (1 ano)
export const VESTING_PERIOD_MS = (Number(process.env.VESTING_PERIOD_DAYS) || 365) * 24 * 60 * 60 * 1000;

// Taxa diária de atraso (0.5% ao dia de multa por atraso)
export const DAILY_LATE_FEE = 0.005;

// Um mês em milissegundos (para simulação de tempo)
export const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// Chave PIX do administrador
// Porcentagens para distribuição de dividendos
export const DIVIDEND_USER_SHARE = 0.85; // 85% para os usuários
export const DIVIDEND_MAINTENANCE_SHARE = 0.15; // 15% para manutenção

// Bônus por indicação
export const REFERRAL_BONUS = 5.00; // R$ 5,00

// Taxas do Mercado Pago (Gateway)
export const MERCADO_PAGO_PIX_FEE_PERCENT = 0.0099; // 0.99% para PIX
export const MERCADO_PAGO_FIXED_FEE = 0.00; // R$ 0,00 fixo

export const MERCADO_PAGO_CARD_FEE_PERCENT = 0.0499; // 4.99% para Cartão
export const MERCADO_PAGO_CARD_FIXED_FEE = 0.40; // R$ 0,40 fixo

// Níveis VIP
export const VIP_LEVELS = {
    BRONZE: { name: 'Bronze', minQuotas: 0, multiplier: 1.2 },
    PRATA: { name: 'Prata', minQuotas: 10, multiplier: 1.5 },
    OURO: { name: 'Ouro', minQuotas: 50, multiplier: 2.0 },
    FOUNDER: { name: 'Fundador', minQuotas: 100, multiplier: 3.0 }
};
