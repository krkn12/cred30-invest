export const MP_PUBLIC_KEY = (import.meta as any).env.VITE_MP_PUBLIC_KEY || 'TEST-2c2e7204-2706-4caa-8c8d-9241534bd123';
export const QUOTA_PRICE = 50;
export const VESTING_PERIOD_MS = 365 * 24 * 60 * 60 * 1000;

// API Constants
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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

// Fee Constants
export const WITHDRAWAL_FEE_PERCENTAGE = 0.02;
export const WITHDRAWAL_FEE_FIXED = 5.00;
export const LOAN_INTEREST_RATE = 0.20;
export const PENALTY_RATE = 0.40;

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
  PROFIT_DISTRIBUTION_RATE: 0.85
};