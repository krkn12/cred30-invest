// Estrutura de preço da cota (Total R$ 50,00)
export const QUOTA_PRICE = 50.00; // Preço de aquisição total
export const QUOTA_SHARE_VALUE = 42.00; // Valor que vai para o Capital Social (Resgatável)
export const QUOTA_ADM_FEE = 8.00;   // Taxa de Manutenção Administrativa (Não resgatável)

// Taxa de sustentabilidade do apoio mútuo (20%)
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
// Porcentagens para distribuição de excedentes operacionais
export const DIVIDEND_USER_SHARE = 0.85; // 85% para os usuários
export const DIVIDEND_MAINTENANCE_SHARE = 0.15; // 15% para manutenção total

// Detalhamento do DIVIDEND_MAINTENANCE_SHARE (A soma deve ser 0.15)
export const MAINTENANCE_TAX_SHARE = 0.06;      // 6% para Impostos (Simples Nacional/MEI)
export const MAINTENANCE_OPERATIONAL_SHARE = 0.04; // 4% para Servidores/APIs
export const MAINTENANCE_OWNER_SHARE = 0.05;    // 5% para Seu Pró-labore (Salário)

// Bônus por indicação
export const REFERRAL_BONUS = 5.00; // R$ 5,00

// --- Taxas de Monetização (Caixa da Cooperativa) ---
export const QUOTA_PURCHASE_FEE_RATE = 0.0; // Desativado (Substituído pela taxa fixa QUOTA_ADM_FEE)
export const LOAN_ORIGINATION_FEE_RATE = 0.03; // 3% de taxa de originação (seguro)
export const WITHDRAWAL_FIXED_FEE = 2.00; // Taxa fixa de R$ 2,00 por saque
export const MARKETPLACE_ESCROW_FEE_RATE = 0.05; // 5% de taxa de garantia (Escrow) no Mercado Cred30
export const MARKET_CREDIT_INTEREST_RATE = 0.015; // 1.5% ao mês (Mais barato que o apoio mútuo padrão)
export const MARKET_CREDIT_MAX_INSTALLMENTS = 24; // Até 24x para facilitar compras grandes
export const MARKET_CREDIT_MIN_SCORE = 450; // Score mínimo para comprar parcelado
export const MARKET_CREDIT_MIN_QUOTAS = 1; // Mínimo de 1 cota ativa (Skin in the Game) para parcelar

// --- Novas Fontes de Receita (Alta Margem) ---
export const VERIFIED_BADGE_PRICE = 9.90; // Taxa única para selo de confiança
export const PRIORITY_WITHDRAWAL_FEE = 5.00; // Taxa para saque expresso
export const SCORE_BOOST_PRICE = 15.00; // Preço do pacote de +100 Score
export const SCORE_BOOST_POINTS = 100; // Pontos ganhos no pacote
export const REPUTATION_CHECK_PRICE = 35.00; // Preço da consulta de reputação (Serasa Standard)

// Taxas do Asaas (Gateway de Pagamento)
// PIX: 0,99% (taxa padrão Asaas)
export const MERCADO_PAGO_PIX_FEE_PERCENT = 0.0099; // 0.99% para PIX (mantido compatibilidade)
export const MERCADO_PAGO_FIXED_FEE = 0.00; // R$ 0,00 fixo

// Cartão de Crédito: 2,99% + R$ 0,49 (taxa padrão Asaas - mais barato que MP)
export const MERCADO_PAGO_CARD_FEE_PERCENT = 0.0299; // 2.99% para Cartão (Asaas)
export const MERCADO_PAGO_CARD_FIXED_FEE = 0.49; // R$ 0,49 fixo (Asaas)

// Alias com nomes corretos para Asaas
export const ASAAS_PIX_FEE_PERCENT = 0.0099; // 0.99%
export const ASAAS_PIX_FIXED_FEE = 0.00;
export const ASAAS_CARD_FEE_PERCENT = 0.0299; // 2.99%
export const ASAAS_CARD_FIXED_FEE = 0.49; // R$ 0,49

// Níveis VIP
export const VIP_LEVELS = {
    BRONZE: { name: 'Bronze', minQuotas: 0, multiplier: 1.2 },
    PRATA: { name: 'Prata', minQuotas: 10, multiplier: 1.5 },
    OURO: { name: 'Ouro', minQuotas: 50, multiplier: 2.0 },
    FOUNDER: { name: 'Fundador', minQuotas: 100, multiplier: 3.0 }
};
