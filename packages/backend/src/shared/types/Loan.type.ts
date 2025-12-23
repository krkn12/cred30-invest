export interface Loan {
  id: number;
  user_id: number;
  amount: number;
  maintenance_fee: number;
  total_amount: number;
  installments: number;
  current_installment: number;
  collateral_quotas: number;
  status: 'PENDING' | 'ACTIVE' | 'PAID' | 'LATE' | 'LIQUIDATED';
  request_date: string;
  approval_date?: string;
  due_date?: string;
  paid_date?: string;
}
