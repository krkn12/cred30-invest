export const MP_PUBLIC_KEY = (import.meta as any).env.VITE_MP_PUBLIC_KEY || 'TEST-2c2e7204-2706-4caa-8c8d-9241534bd123';
export const QUOTA_PRICE = 50;
export const QUOTA_SHARE_VALUE = 42;
export const QUOTA_ADM_FEE = 8;
export const VESTING_PERIOD_MS = 365 * 24 * 60 * 60 * 1000;

// API Constants
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Status Constants
export const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED'
} as const;

export const LOAN_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAID: 'PAID',
  PAYMENT_PENDING: 'PAYMENT_PENDING'
} as const;

export const QUOTA_STATUS = {
  ACTIVE: 'ACTIVE',
  SOLD: 'SOLD',
  PENDING: 'PENDING'
} as const;

// Fee Constants (Sincronizado com Asaas / business.constants.ts)
export const WITHDRAWAL_FEE_PERCENTAGE = 0; // Taxa percentual removida (Asaas é fixo)
export const WITHDRAWAL_FEE_FIXED = 2.00;   // Taxa de manutenção da cooperativa por saque
export const WELCOME_WITHDRAWAL_FIXED_FEE = 1.00; // Taxa reduzida para indicados (Boas-vindas)
export const WITHDRAWAL_MIN_AMOUNT = 50.00; // Valor mínimo para saque
export const LOAN_INTEREST_RATE = 0.20;
export const PENALTY_RATE = 0.40;
export const MARKETPLACE_ESCROW_FEE_RATE = 0.05;
export const MARKET_CREDIT_INTEREST_RATE = 0.015;
export const MARKET_CREDIT_MAX_INSTALLMENTS = 24;
export const MARKET_CREDIT_MIN_SCORE = 450;

// VIP Levels
export const VIP_LEVELS = {
  BRONZE: { name: 'Bronze', minQuotas: 0, color: 'orange' },
  PRATA: { name: 'Prata', minQuotas: 10, color: 'gray' },
  OURO: { name: 'Ouro', minQuotas: 50, color: 'yellow' }
} as const;

export const FINANCIAL_CONSTANTS = {
  QUOTA_PRICE,
  LOAN_INTEREST_RATE,
  PENALTY_RATE,
  VESTING_PERIOD_DAYS: 365,
  PROFIT_DISTRIBUTION_RATE: 0.85,
  QUOTA_SHARE_VALUE,
  QUOTA_ADM_FEE
};