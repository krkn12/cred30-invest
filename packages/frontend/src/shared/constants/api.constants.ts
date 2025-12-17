/**
 * Constantes utilizadas no frontend
 */

export const API_BASE_URL = '';

export const CACHE_DURATION = {
  SHORT: 5000,      // 5 segundos para dados críticos
  MEDIUM: 10000,    // 10 segundos para itens pendentes
  LONG: 15000       // 15 segundos para dashboard
};

export const TRANSACTION_TYPES = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  BUY_QUOTA: 'BUY_QUOTA',
  SELL_QUOTA: 'SELL_QUOTA',
  LOAN_RECEIVED: 'LOAN_RECEIVED',
  LOAN_PAYMENT: 'LOAN_PAYMENT',
  REFERRAL_BONUS: 'REFERRAL_BONUS'
} as const;

export const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
} as const;

export const LOAN_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  DEFAULTED: 'DEFAULTED',
  REJECTED: 'REJECTED',
  PAYMENT_PENDING: 'PAYMENT_PENDING'
} as const;

export const FINANCIAL_CONSTANTS = {
  QUOTA_PRICE: 50,
  LOAN_INTEREST_RATE: 0.2,
  PENALTY_RATE: 0.4,
  VESTING_PERIOD_DAYS: 365,
  PROFIT_DISTRIBUTION_RATE: 0.85 // 85% para cotistas
} as const;

export const STATUS_COLORS = {
  APPROVED: 'text-green-600',
  REJECTED: 'text-red-600',
  PENDING: 'text-yellow-600',
  PAID: 'text-green-600',
  DEFAULTED: 'text-red-600',
  PAYMENT_PENDING: 'text-blue-600'
} as const;

export const STATUS_BADGES = {
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  DEFAULTED: 'bg-red-100 text-red-800',
  PAYMENT_PENDING: 'bg-blue-100 text-blue-800'
} as const;