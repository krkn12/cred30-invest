import { User, Quota, Loan, Transaction, AppState } from '../../domain/types/common.types';
import { apiService } from './api.service';
export { apiService };
import { QUOTA_PRICE, LOAN_INTEREST_RATE, PENALTY_RATE, VESTING_PERIOD_MS } from '../../shared/constants/app.constants';

// Função para converter dados da API para o formato esperado pelo frontend
const convertApiUserToUser = (apiUser: any): User => {
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    secretPhrase: '', // Não é retornado pela API
    pixKey: apiUser.pixKey,
    balance: apiUser.balance,
    joinedAt: apiUser.joinedAt,
    referralCode: apiUser.referralCode,
    isAdmin: apiUser.isAdmin || false,
    score: apiUser.score || 300,
    twoFactorEnabled: apiUser.twoFactorEnabled || false,
  };
};

const convertApiQuotaToQuota = (apiQuota: any): Quota => {
  return {
    id: apiQuota.id,
    userId: apiQuota.userId,
    purchasePrice: apiQuota.purchasePrice,
    purchaseDate: apiQuota.purchaseDate,
    currentValue: apiQuota.currentValue,
    yieldRate: apiQuota.yieldRate,
    status: apiQuota.status || 'ACTIVE', // Default status if missing
  };
};

const convertApiLoanToLoan = (apiLoan: any): Loan => {
  // Garantir que os valores monetários sejam números válidos
  const amount = typeof apiLoan.amount === 'string'
    ? parseFloat(apiLoan.amount)
    : apiLoan.amount;
  const totalRepayment = typeof apiLoan.totalRepayment === 'string'
    ? parseFloat(apiLoan.totalRepayment)
    : apiLoan.totalRepayment;
  const interestRate = typeof apiLoan.interestRate === 'string'
    ? parseFloat(apiLoan.interestRate)
    : apiLoan.interestRate;

  return {
    id: apiLoan.id,
    userId: apiLoan.userId,
    amount: amount || 0,
    totalRepayment: totalRepayment || 0,
    installments: apiLoan.installments || 1,
    interestRate: interestRate || 0,
    requestDate: apiLoan.requestDate,
    status: apiLoan.status,
    dueDate: apiLoan.dueDate,
    createdAt: apiLoan.createdAt || apiLoan.created_at || new Date().toISOString(), // Map createdAt
  };
};

const convertApiTransactionToTransaction = (apiTransaction: any): Transaction => {
  // Garantir que o amount seja um número válido
  const amount = typeof apiTransaction.amount === 'string'
    ? parseFloat(apiTransaction.amount)
    : apiTransaction.amount;

  return {
    id: apiTransaction.id,
    userId: apiTransaction.userId,
    type: apiTransaction.type,
    amount: amount || 0,
    date: apiTransaction.date,
    description: apiTransaction.description,
    status: apiTransaction.status,
    metadata: apiTransaction.metadata,
  };
};

// Carregar estado da aplicação da API
export const loadState = async (): Promise<AppState> => {
  try {
    // Verificar se o usuário está autenticado
    if (!apiService.isAuthenticated()) {
      return {
        currentUser: null,
        users: [],
        quotas: [],
        loans: [],
        transactions: [],
        systemBalance: 0,
        profitPool: 0,
      };
    }

    // Obter dados do usuário
    const userProfile = await apiService.getUserProfile();
    const currentUser = convertApiUserToUser(userProfile.user);


    // Obter transações do usuário
    const transactionsResponse = await apiService.getUserTransactions();
    const transactions = transactionsResponse.transactions.map(convertApiTransactionToTransaction);

    // Obter cotas do usuário
    const quotasResponse = await apiService.getUserQuotas();
    const quotas = quotasResponse.quotas.map(convertApiQuotaToQuota);

    // Obter empréstimos do usuário
    const loansResponse = await apiService.getUserLoans();
    const loans = loansResponse.loans.map(convertApiLoanToLoan);

    // Se for administrador, obter dados do dashboard
    let systemBalance = 0;
    let profitPool = 0;
    let stats: any = null;

    if (currentUser.isAdmin) {
      try {
        const now = Date.now();

        // Forçar sempre busca nova para garantir dados atualizados
        if (cachedDashboard && (now - lastDashboardCacheTime) < DASHBOARD_CACHE_DURATION) {
          console.log('Usando cache do dashboard administrativo');
          systemBalance = cachedDashboard.systemBalance || 0;
          profitPool = cachedDashboard.profitPool || 0;
          stats = cachedDashboard.stats || null;
        } else {
          console.log('Buscando dashboard administrativo...');
          const dashboard = await apiService.getAdminDashboard();

          // DEBUG: Log completo da resposta
          console.log('DEBUG - Resposta completa do dashboard:', JSON.stringify(dashboard, null, 2));

          // Acessar dados aninhados corretamente
          systemBalance = dashboard.data?.systemConfig?.system_balance || dashboard.systemConfig?.system_balance || 0;
          profitPool = dashboard.data?.systemConfig?.profit_pool || dashboard.systemConfig?.profit_pool || 0;
          stats = dashboard.data?.stats || dashboard.stats || null;

          if (stats) {
            stats.totalGatewayCosts = dashboard.data?.systemConfig?.total_gateway_costs || dashboard.systemConfig?.total_gateway_costs || 0;
            stats.totalManualCosts = dashboard.data?.systemConfig?.total_manual_costs || dashboard.systemConfig?.total_manual_costs || 0;
            stats.totalTaxReserve = dashboard.data?.systemConfig?.total_tax_reserve || dashboard.systemConfig?.total_tax_reserve || 0;
            stats.totalOperationalReserve = dashboard.data?.systemConfig?.total_operational_reserve || dashboard.systemConfig?.total_operational_reserve || 0;
            stats.totalOwnerProfit = dashboard.data?.systemConfig?.total_owner_profit || dashboard.systemConfig?.total_owner_profit || 0;
          }

          // DEBUG: Verificar valores extraídos
          console.log('DEBUG - Valores extraídos:', {
            systemBalance,
            profitPool,
            stats,
            'dashboard.data?.systemConfig?.systemBalance': dashboard.data?.systemConfig?.systemBalance,
            'dashboard.systemConfig?.systemBalance': dashboard.systemConfig?.systemBalance
          });

          // Atualizar cache do dashboard
          cachedDashboard = { systemBalance, profitPool, stats };
          lastDashboardCacheTime = now;

          console.log('Dashboard completo recebido e cache atualizado:', dashboard);
        }
      } catch (error) {
        console.error('Erro ao carregar dashboard administrativo:', error);
        // Limpar cache em caso de erro para forçar nova busca
        cachedDashboard = null;
        lastDashboardCacheTime = 0;
      }
    }

    return {
      currentUser,
      users: [currentUser], // Simplificado - apenas o usuário atual
      quotas,
      loans,
      transactions,
      systemBalance,
      profitPool,
      stats,
    };
  } catch (error) {
    console.error('Erro ao carregar estado da aplicação:', error);

    // Em caso de erro, retornar estado padrão
    return {
      currentUser: null,
      users: [],
      quotas: [],
      loans: [],
      transactions: [],
      systemBalance: 0,
      profitPool: 0,
    };
  }
};

// Salvar estado da aplicação (não necessário com API, mas mantido para compatibilidade)
export const saveState = (state: AppState): void => {
  // Com a API, não precisamos salvar o estado no localStorage
  // Esta função é mantida apenas para compatibilidade com o código existente
  console.log('saveState chamado, mas não é necessário com API');
};

// --- Admin Logic ---



export const updateProfitPool = async (amountToAdd: number): Promise<void> => {
  await apiService.addProfitToPool(amountToAdd);
  // Limpar cache após atualização
  clearPendingItemsCache();
};

const CACHE_DURATION = 10000; // 10 segundos de cache (mantido para compatibilidade se necessário)

// Cache para dashboard administrativo
let cachedDashboard: any = null;
let lastDashboardCacheTime = 0;
const DASHBOARD_CACHE_DURATION = 15000; // 15 segundos de cache para dashboard



// Função para limpar o cache quando necessário (ex: após atualização de dividendos)
export const clearPendingItemsCache = (): void => {
  cachedDashboard = null;
  lastDashboardCacheTime = 0;
  console.log('Cache do dashboard limpo');
};

// Função para limpar apenas o cache do dashboard
export const clearDashboardCache = (): void => {
  cachedDashboard = null;
  lastDashboardCacheTime = 0;
  console.log('Cache do dashboard limpo');
};

// Função para limpar cache globalmente
export const clearAllCache = (): void => {
  cachedDashboard = null;
  lastDashboardCacheTime = 0;
  console.log('Todo o cache foi limpo');
};



export const distributeMonthlyDividends = async () => {
  const result = await apiService.distributeDividends();
  return result;
};

// --- User Logic ---

export const buyQuota = async (quantity: number, useBalance: boolean = false, paymentMethod?: 'pix' | 'card', cardData?: any): Promise<any> => {
  return await apiService.buyQuotas(quantity, useBalance, paymentMethod, cardData);
};

export const sellQuota = async (quotaId: string): Promise<void> => {
  await apiService.sellQuota(quotaId);
};

export const sellAllQuotas = async (): Promise<number> => {
  const result = await apiService.sellAllQuotas();
  return result.totalReceived || 0;
};

export const requestLoan = async (
  amount: number,
  installments: number
): Promise<any> => {
  return await apiService.requestLoan(amount, installments);
};

export const repayLoan = async (loanId: string, useBalance: boolean, paymentMethod?: 'pix' | 'card', cardData?: any): Promise<any> => {
  return await apiService.repayLoan(loanId, useBalance, paymentMethod, cardData);
};

export const repayInstallment = async (loanId: string, amount: number, useBalance: boolean, paymentMethod?: 'pix' | 'card', cardData?: any): Promise<any> => {
  return await apiService.repayInstallment(loanId, amount, useBalance, paymentMethod, cardData);
};

export const requestWithdrawal = async (amount: number, pixKey: string): Promise<void> => {
  await apiService.requestWithdrawal(amount, pixKey);
};

export const claimAdReward = async (): Promise<any> => {
  return await apiService.claimAdReward();
};

export const upgradePro = async (method: 'pix' | 'card' | 'balance', cardData?: any): Promise<any> => {
  return await apiService.post<any>('/monetization/upgrade-pro', { method, ...cardData });
};

export const fastForwardTime = async (months: number): Promise<void> => {
  console.log('Simulação de tempo desativada.');
};

// --- Auth ---

export const registerUser = async (
  name: string,
  email: string,
  password: string,
  pixKey: string,
  secretPhrase: string,
  referralCodeInput?: string
): Promise<any> => {
  const response = await apiService.register(
    name,
    email,
    password,
    secretPhrase,
    pixKey,
    referralCodeInput
  );
  return {
    user: convertApiUserToUser(response.user),
    twoFactor: response.twoFactor
  };
};

export const changePassword = async (oldPass: string, newPass: string): Promise<void> => {
  await apiService.changePassword(oldPass, newPass);
};

export const loginUser = async (
  email: string,
  password: string,
  secretPhrase?: string,
  twoFactorCode?: string
): Promise<any> => {
  const response = await apiService.login(email, password, secretPhrase, twoFactorCode);
  if (response.requires2FA) return response;
  return convertApiUserToUser(response.user);
};

export const resetPassword = async (
  email: string,
  secretPhrase: string,
  newPassword: string
): Promise<void> => {
  await apiService.resetPassword(email, secretPhrase, newPassword);
};

export const logoutUser = async (): Promise<void> => {
  await apiService.logout();
};

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    if (!apiService.isAuthenticated()) {
      return null;
    }

    const userProfile = await apiService.getUserProfile();
    return convertApiUserToUser(userProfile.user);
  } catch (error) {
    console.error('Erro ao obter usuário atual:', error);
    return null;
  }
};



export const get2FASetup = () => apiService.get2FASetup();

export const verify2FA = (email: string, code: string) => apiService.verify2FA(email, code);

export const confirmWithdrawal = (transactionId: number, code: string) => apiService.confirmWithdrawal(transactionId, code);

export const deleteUserAccount = async (twoFactorCode?: string): Promise<any> => {
  const result = await apiService.deleteAccount(twoFactorCode);
  if (result.success) {
    await logoutUser();
  }
  return result;
};