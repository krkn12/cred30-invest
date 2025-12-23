export interface Transaction {
  id: number;
  user_id: number;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'PROFIT_DISTRIBUTION' | 'QUOTA_PURCHASE' | 'QUOTA_LIQUIDATION' | 'MAINTENANCE_FEE' | 'GAME_BET';
  amount: number;
  description?: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  updated_at?: string;
  pix_key?: string;
  user_name?: string;
  user_email?: string;
}
