import { User, Quota, Loan, Transaction, AppState } from '../../domain/types/common.types';
import { apiService } from './api.service';
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
    pixKeyToReceive: apiLoan.pixKeyToReceive,
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

    // DEBUG: Log para verificar o saldo do usuário
    console.log('DEBUG - Saldo do usuário carregado:', {
      userId: currentUser.id,
      userName: currentUser.name,
      balance: currentUser.balance,
      balanceType: typeof currentUser.balance
    });

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

export const updateSystemBalance = async (newBalance: number): Promise<void> => {
  await apiService.updateSystemBalance(newBalance);
  // Limpar cache após atualização
  clearPendingItemsCache();
};

export const updateProfitPool = async (amountToAdd: number): Promise<void> => {
  await apiService.addProfitToPool(amountToAdd);
  // Limpar cache após atualização
  clearPendingItemsCache();
};

// Cache para evitar múltiplas chamadas ao dashboard
let cachedPendingItems: { transactions: any[], loans: any[] } | null = null;
let lastCacheTime = 0;
const CACHE_DURATION = 10000; // 10 segundos de cache (aumentado para reduzir chamadas)

// Cache para dashboard administrativo
let cachedDashboard: any = null;
let lastDashboardCacheTime = 0;
const DASHBOARD_CACHE_DURATION = 15000; // 15 segundos de cache para dashboard

export const getPendingItems = async () => {
  try {
    const now = Date.now();

    // Limpar cache temporariamente para forçar nova chamada
    cachedPendingItems = null;
    lastCacheTime = 0;

    // Sempre buscar dados novos para garantir atualização
    console.log('Forçando nova busca de itens pendentes (sem cache)');

    console.log('Buscando itens pendentes do dashboard...');
    const dashboard = await apiService.getAdminDashboard();
    console.log('Dashboard recebido:', dashboard);

    // Acessar dados aninhados corretamente
    const pendingTransactionsRaw = dashboard.data?.pendingTransactions || dashboard.pendingTransactions || [];
    const pendingLoansRaw = dashboard.data?.pendingLoans || dashboard.pendingLoans || [];

    // Converter transações com descrição melhorada
    const pendingTransactions = pendingTransactionsRaw.map((apiTransaction: any) => {
      const amount = typeof apiTransaction.amount === 'string'
        ? parseFloat(apiTransaction.amount)
        : apiTransaction.amount;

      // Descrição melhorada para transações pendentes
      let description = apiTransaction.description;
      if (!description) {
        if (apiTransaction.type === 'BUY_QUOTA') {
          description = `Compra de ${apiTransaction.quantity || 1} cota(s) - Aguardando Aprovação`;
        } else if (apiTransaction.type === 'WITHDRAWAL') {
          description = `Solicitacao de Saque - Aguardando Aprovação`;
        } else {
          description = `${apiTransaction.type} - Aguardando Aprovação`;
        }
      }

      return {
        id: apiTransaction.id,
        userId: apiTransaction.user_id,
        type: apiTransaction.type,
        amount: amount || 0,
        description: description,
        status: apiTransaction.status,
        date: apiTransaction.created_at || apiTransaction.createdAt || apiTransaction.date,
        createdAt: apiTransaction.created_at || apiTransaction.createdAt,
        updatedAt: apiTransaction.updated_at || apiTransaction.updatedAt,
        metadata: apiTransaction.metadata, // Incluir metadata na conversão
        user_name: apiTransaction.user_name,
        user_email: apiTransaction.user_email
      };
    });

    // Converter empréstimos com cálculo correto do totalRepayment
    const pendingLoans = pendingLoansRaw.map((apiLoan: any) => {
      const amount = typeof apiLoan.amount === 'string'
        ? parseFloat(apiLoan.amount)
        : apiLoan.amount;
      const totalRepayment = typeof apiLoan.total_repayment === 'string'
        ? parseFloat(apiLoan.total_repayment)
        : (typeof apiLoan.totalRepayment === 'string' ? parseFloat(apiLoan.totalRepayment) : apiLoan.totalRepayment);

      // Calcular totalRepayment se não estiver presente ou for inválido
      const calculatedTotalRepayment = totalRepayment && totalRepayment > 0
        ? totalRepayment
        : (amount * (1 + 0.2 * (apiLoan.installments || 1)));

      // DEBUG: Log para verificar dados do empréstimo
      console.log('DEBUG - Dados do empréstimo pendente:', {
        id: apiLoan.id,
        user_id: apiLoan.user_id,
        user_name: apiLoan.user_name,
        user_email: apiLoan.user_email,
        pix_key_to_receive: apiLoan.pix_key_to_receive,
        created_at: apiLoan.created_at,
        amount: apiLoan.amount,
        totalRepayment: apiLoan.totalRepayment,
        installments: apiLoan.installments,
        calculatedTotalRepayment
      });

      return {
        id: apiLoan.id,
        userId: apiLoan.user_id || apiLoan.userId,
        amount: amount || 0,
        totalRepayment: calculatedTotalRepayment,
        installments: apiLoan.installments || 1,
        status: apiLoan.status,
        pixKeyToReceive: apiLoan.pix_key_to_receive || apiLoan.pixKeyToReceive || apiLoan.pixKey || 'Não informado',
        createdAt: apiLoan.created_at || apiLoan.createdAt,
        updatedAt: apiLoan.updated_at || apiLoan.updatedAt,
        // Adicionar campos do usuário em ambos os formatos para compatibilidade
        userName: apiLoan.user_name || apiLoan.userName,
        userEmail: apiLoan.user_email || apiLoan.userEmail,
        user_name: apiLoan.user_name || apiLoan.userName,
        user_email: apiLoan.user_email || apiLoan.userEmail,
        user_id: apiLoan.user_id || apiLoan.userId
      };
    });

    // Atualizar cache
    cachedPendingItems = { transactions: pendingTransactions, loans: pendingLoans };
    lastCacheTime = now;

    console.log('Transações pendentes convertidas:', pendingTransactions);
    console.log('Empréstimos pendentes convertidos:', pendingLoans);

    return cachedPendingItems;
  } catch (error) {
    console.error('Erro ao obter itens pendentes:', error);
    return { transactions: [], loans: [] };
  }
};

// Função para limpar o cache quando necessário (ex: após aprovar/rejeitar)
export const clearPendingItemsCache = (): void => {
  cachedPendingItems = null;
  lastCacheTime = 0;
  cachedDashboard = null;
  lastDashboardCacheTime = 0;
  console.log('Cache de itens pendentes e dashboard limpo');
};

// Função para limpar apenas o cache do dashboard
export const clearDashboardCache = (): void => {
  cachedDashboard = null;
  lastDashboardCacheTime = 0;
  console.log('Cache do dashboard limpo');
};

// Função para limpar cache globalmente
export const clearAllCache = (): void => {
  cachedPendingItems = null;
  lastCacheTime = 0;
  cachedDashboard = null;
  lastDashboardCacheTime = 0;
  console.log('Todo o cache foi limpo');
};

export const processAdminAction = async (
  itemId: string,
  itemType: 'TRANSACTION' | 'LOAN',
  action: 'APPROVE' | 'REJECT'
): Promise<void> => {
  try {
    await apiService.processAdminAction(itemId, itemType, action);
    // Limpar cache após ação administrativa
    clearPendingItemsCache();
  } catch (error) {
    console.error('Erro ao processar ação administrativa:', error);
    throw error;
  }
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
  installments: number,
  receivePixKey: string
): Promise<any> => {
  return await apiService.requestLoan(amount, installments, receivePixKey);
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
): Promise<User> => {
  const response = await apiService.register(
    name,
    email,
    password,
    secretPhrase,
    pixKey,
    referralCodeInput
  );
  return convertApiUserToUser(response.user);
};

export const changePassword = async (oldPass: string, newPass: string): Promise<void> => {
  await apiService.changePassword(oldPass, newPass);
};

export const loginUser = async (
  email: string,
  password: string,
  secretPhrase: string
): Promise<User> => {
  const response = await apiService.login(email, password, secretPhrase);
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

export const fixLoanPix = async (loanId: string, pixKey: string): Promise<any> => {
  return await apiService.fixLoanPix(loanId, pixKey);
};

export const verifyEmail = (email: string, code: string) => apiService.verifyEmail(email, code);

export const confirmWithdrawal = (transactionId: number, code: string) => apiService.confirmWithdrawal(transactionId, code);

export const deleteUserAccount = async (): Promise<any> => {
  const result = await apiService.deleteAccount();
  if (result.success) {
    await logoutUser();
  }
  return result;
};