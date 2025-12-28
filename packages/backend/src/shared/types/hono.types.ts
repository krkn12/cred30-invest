// Definir o tipo de usuário para o contexto do Hono
export interface UserContext {
  id: string; // ID como UUID string (compatível com PostgreSQL)
  name: string;
  email: string;
  balance: number;
  joinedAt: number; // Timestamp em milissegundos
  referralCode: string;
  isAdmin: boolean;
  role: 'MEMBER' | 'ATTENDANT' | 'ADMIN';
  status: 'ACTIVE' | 'BLOCKED';
  score: number;
  pixKey?: string; // Adicionado para compatibilidade
  twoFactorEnabled?: boolean;
  cpf?: string | null; // CPF do usuário (opcional, obrigatório para saque)
  securityLockUntil?: number; // Timestamp em milissegundos
  membership_type?: string;
}

// Estender o tipo de variáveis do Hono
declare module 'hono' {
  interface ContextVariableMap {
    user: UserContext;
    dbPool: any; // Pool de conexões PostgreSQL
  }
}