import { User } from './User.type';
import { Quota } from './Quota.type';
import { Loan } from './Loan.type';
import { Transaction } from './Transaction.type';

export interface AppState {
  currentUser: User | null;
  users: User[];
  quotas: Quota[];
  loans: Loan[];
  transactions: Transaction[];
  systemBalance: number; // Caixa Operacional (Depósitos, Capital de Giro)
  profitPool: number; // Caixa de Excedentes (Taxa de manutenção recebida de apoios mútuos)
}

export interface SystemConfig {
  systemBalance: number;
  profitPool: number;
  quotaPrice: number;
  loanInterestRate: number;
  penaltyRate: number;
  vestingPeriodMs: number;
}

export interface AdminDashboard {
  pendingTransactions: Transaction[];
  pendingLoans: Loan[];
  systemConfig: SystemConfig;
}