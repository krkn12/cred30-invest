export interface User {
  id: string;
  name: string;
  email: string;
  pixKey: string;
  balance: number;
  joinedAt: string;
  referralCode: string;
  isAdmin?: boolean;
  score?: number;
  secretPhrase?: string;
}

export interface Quota {
  id: string;
  userId: string;
  purchasePrice: number;
  currentValue: number;
  purchaseDate: string | number;
  status: 'ACTIVE' | 'SOLD' | 'PENDING';
  yieldRate?: number;
}

export interface Loan {
  id: string;
  userId: string;
  amount: number;
  totalRepayment: number;
  installments: number;
  interestRate: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'PAYMENT_PENDING';
  createdAt: string;
  dueDate?: string;
  pixKeyToReceive?: string;
  totalPaid?: number;
  remainingAmount?: number;
  paidInstallmentsCount?: number;
  isFullyPaid?: boolean;
  userName?: string;
  userEmail?: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  created_at?: string;
  requestDate?: number; // timestamp
}

export interface Transaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  date?: string;
  created_at?: string;
  metadata?: any;
  user_name?: string;
  user_email?: string;
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  quotas: Quota[];
  loans: Loan[];
  transactions: Transaction[];
  systemBalance: number;
  profitPool: number;
  isLoading?: boolean;
  pendingItems?: any[];
  serverTime?: number;
  lastDividendDistribution?: any;
  stats?: {
    quotasCount?: number;
    totalLoaned?: number;
    totalToReceive?: number;
  };
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  affiliateUrl: string;
  price?: number;
  category: string;
  active: boolean;
  createdAt: string;
}