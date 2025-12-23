export interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  secretPhrase?: string;
  role: 'MEMBER' | 'ATTENDANT' | 'ADMIN';
  status: 'ACTIVE' | 'BLOCKED';
  balance: number;
  score: number;
  quotas: number;
  created_at: string;
  pix_key: string;
  isAdmin?: boolean;
}
