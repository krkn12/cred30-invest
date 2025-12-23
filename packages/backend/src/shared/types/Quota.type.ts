export interface Quota {
  id: number;
  user_id: number;
  quantity: number;
  purchase_price: number;
  current_value: number;
  purchase_date: string;
  status: 'ACTIVE' | 'LIQUIDATED';
}
