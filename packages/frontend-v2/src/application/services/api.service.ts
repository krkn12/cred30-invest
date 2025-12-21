// URL base da API - detecta se está acessando via ngrok
const getApiBaseUrl = () => {
  const currentUrl = window.location.origin;
  if (currentUrl.includes('ngrok-free.app')) {
    // Se estiver acessando via ngrok, usa a mesma URL base para a API
    return currentUrl + '/api';
  }
  return (import.meta as any).env.VITE_API_URL || '/api';
};

const API_BASE_URL = getApiBaseUrl();

// Tipos para respostas da API
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
}

interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    pixKey: string;
    balance: number;
    joinedAt: number;
    referralCode: string;
    isAdmin?: boolean;
  };
  token: string;
}

// Classe para gerenciar requisições à API
class ApiService {
  private token: string | null = null;

  constructor() {
    // Recuperar token do localStorage ao inicializar
    this.token = localStorage.getItem('authToken');
  }

  // Verificar se o usuário está autenticado
  isAuthenticated(): boolean {
    return !!this.token;
  }

  // Método privado para obter headers comuns
  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Método privado para fazer requisições
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);

      // Tentar fazer parse do JSON apenas se o content-type for application/json
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // Se não for JSON, tentar obter como texto
        const text = await response.text();
        try {
          // Tentar fazer parse do texto como JSON (fallback)
          data = JSON.parse(text);
        } catch {
          // Se não for JSON, criar um objeto de erro padrão
          data = { message: text || 'Erro na requisição' };
        }
      }

      if (!response.ok) {
        // Se for erro 401 (Não autorizado), limpar token e redirecionar para login
        // Se for erro 404 (Não encontrado) NA ROTA DE PERFIL ou BALANCE, significa que o usuário do token foi deletado
        if (response.status === 401 || (response.status === 404 && (endpoint === '/users/profile' || endpoint === '/users/balance'))) {
          console.log(`Erro ${response.status} detectado em ${endpoint}. Forçando logout.`);
          this.token = null;
          localStorage.removeItem('authToken');
          // Disparar evento para notificar o app sobre o logout
          window.dispatchEvent(new CustomEvent('auth-expired'));
        }
        // Lançar um erro que contenha as informações extras da resposta (ex: requiresVerification)
        const error: any = new Error(data.message || 'Erro na requisição');
        Object.assign(error, data);
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('Erro na requisição:', error);
      // alert(error.message); // Removido para evitar alerts do sistema
      throw error;
    }
  }

  // Método genérico para POST
  async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Método genérico para GET
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
    });
  }

  // Método genérico para PUT
  async put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // Método genérico para DELETE
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  // Método para login
  async login(email: string, password: string, secretPhrase?: string, twoFactorCode?: string): Promise<AuthResponse & { requires2FA?: boolean }> {
    const response = await this.request<AuthResponse & { requires2FA?: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, secretPhrase, twoFactorCode }),
    });

    if (response.data?.requires2FA) {
      return response.data;
    }

    // Armazenar token
    this.token = response.data?.token || null;
    if (this.token) {
      localStorage.setItem('authToken', this.token);
    }

    return response.data!;
  }

  // Método para registro
  async register(
    name: string,
    email: string,
    password: string,
    secretPhrase: string,
    pixKey: string,
    referralCode?: string
  ): Promise<AuthResponse & { twoFactor?: { secret: string, qrCode: string, otpUri: string } }> {
    const requestBody: any = { name, email, password, secretPhrase, pixKey };
    if (referralCode && referralCode.trim() !== '') {
      requestBody.referralCode = referralCode;
    }

    const response = await this.request<AuthResponse & { twoFactor?: { secret: string, qrCode: string, otpUri: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    // Armazenar token
    this.token = response.data?.token || null;
    if (this.token) {
      localStorage.setItem('authToken', this.token);
    }

    return response.data!;
  }

  // Obter dados de configuração 2FA
  async get2FASetup(): Promise<any> {
    const response = await this.request<any>('/auth/2fa/setup');
    return response.data;
  }

  // Método para reset de senha
  async resetPassword(email: string, secretPhrase: string, newPassword: string): Promise<void> {
    await this.request<void>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, secretPhrase, newPassword }),
    });
  }

  // Método para logout
  async logout(): Promise<void> {
    await this.request<void>('/auth/logout', {
      method: 'POST',
    });

    // Remover token
    this.token = null;
    localStorage.removeItem('authToken');
  }

  // Método para obter perfil do usuário
  async getUserProfile(): Promise<any> {
    const response = await this.request<any>('/users/profile');
    return response.data;
  }

  // Método para atualizar perfil do usuário
  async updateUserProfile(data: {
    name?: string;
    pixKey?: string;
    secretPhrase?: string;
  }): Promise<any> {
    const response = await this.request<any>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  // Método para obter saldo do usuário
  async getUserBalance(): Promise<{ balance: number }> {
    const response = await this.request<{ balance: number }>('/users/balance');
    return response.data!;
  }

  // Método para obter transações do usuário
  async getUserTransactions(): Promise<{ transactions: any[] }> {
    const response = await this.request<{ transactions: any[] }>('/users/transactions');
    return response.data!;
  }

  // Método para obter cotas do usuário
  async getUserQuotas(): Promise<{ quotas: any[] }> {
    const response = await this.request<{ quotas: any[] }>('/quotas');
    return response.data!;
  }

  // Método para reivindicar recompensa por anúncio
  async claimAdReward(): Promise<any> {
    const response = await this.request<any>('/users/reward-ad', { method: 'POST' });
    return response.data!;
  }

  // Método para comprar cotas
  async buyQuotas(quantity: number, useBalance: boolean, paymentMethod?: 'pix' | 'card', cardData?: any): Promise<any> {
    const response = await this.request<any>('/quotas/buy', {
      method: 'POST',
      body: JSON.stringify({
        quantity,
        useBalance,
        paymentMethod,
        ...cardData
      }),
    });
    return response.data;
  }

  // Método para vender uma cota
  async sellQuota(quotaId: string): Promise<any> {
    const response = await this.request<any>('/quotas/sell', {
      method: 'POST',
      body: JSON.stringify({ quotaId }),
    });
    return response.data;
  }

  // Método para vender todas as cotas
  async sellAllQuotas(): Promise<any> {
    const response = await this.request<any>('/quotas/sell-all', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return response.data;
  }

  // Método para obter empréstimos do usuário
  async getUserLoans(): Promise<{ loans: any[] }> {
    const response = await this.request<{ loans: any[] }>('/loans');
    return response.data!;
  }

  // Método para solicitar empréstimo
  async requestLoan(amount: number, installments: number): Promise<any> {
    const response = await this.request<any>('/loans/request', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        installments,
      }),
    });
    return response.data;
  }

  // Método para pagar empréstimo
  async repayLoan(loanId: string, useBalance: boolean, paymentMethod?: 'pix' | 'card', cardData?: any): Promise<any> {
    const response = await this.request<any>('/loans/repay', {
      method: 'POST',
      body: JSON.stringify({ loanId, useBalance, paymentMethod, ...cardData }),
    });
    return response.data;
  }

  // Método para pagar parcela de empréstimo
  async repayInstallment(loanId: string, amount: number, useBalance: boolean, paymentMethod?: 'pix' | 'card', cardData?: any): Promise<any> {
    const response = await this.request<any>('/loans/repay-installment', {
      method: 'POST',
      body: JSON.stringify({
        loanId,
        installmentAmount: amount,
        useBalance,
        paymentMethod,
        ...cardData
      }),
    });
    return response.data;
  }

  // Método para solicitar saque
  async requestWithdrawal(amount: number, pixKey: string): Promise<any> {
    const response = await this.request<any>('/withdrawals/request', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        pixKey
      }),
    });
    return response; // Return full response to check requiresConfirmation
  }

  // Método para jogar Caça-Níquel
  async spinSlot(): Promise<any> {
    // Retorna a resposta completa, pois o componente espera verificar result.success
    return this.request<any>('/games/slot/spin', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Método para excluir conta
  async deleteAccount(twoFactorCode?: string): Promise<any> {
    const response = await this.request<any>('/users/me', {
      method: 'DELETE',
      body: JSON.stringify({ twoFactorCode }),
    });
    return response;
  }

  // Métodos administrativos
  async getAdminDashboard(): Promise<any> {
    const response = await this.request<any>('/admin/dashboard');
    return response.data;
  }



  async addProfitToPool(amountToAdd: number): Promise<void> {
    await this.request<void>('/admin/profit-pool', {
      method: 'POST',
      body: JSON.stringify({ amountToAdd }),
    });
  }



  async distributeDividends(): Promise<any> {
    const response = await this.request<any>('/admin/distribute-dividends', {
      method: 'POST',
    });
    return response.data;
  }





  // Fila de Pagamentos (Payout Queue)
  async getPayoutQueue(): Promise<any> {
    const response = await this.request<any>('/admin/payout-queue');
    return response.data;
  }

  async confirmPayout(id: string, type: 'TRANSACTION' | 'LOAN'): Promise<void> {
    await this.request<void>('/admin/confirm-payout', {
      method: 'POST',
      body: JSON.stringify({ id, type }),
    });
  }







  // Obter limite de crédito disponível (Estilo Nubank)
  async getAvailableLimit(): Promise<{ totalLimit: number; activeDebt: number; remainingLimit: number }> {
    const response = await this.request<any>('/loans/available-limit', {
      method: 'GET',
    });
    return response.data;
  }

  // Obter carteira de crédito do cliente
  async getCreditPortfolio(userId: string): Promise<any> {
    const response = await this.request<any>(`/admin/credit-portfolio/${userId}`);
    return response.data;
  }

  // --- Loja de Produtos (Afiliados) ---

  async getProducts(category?: string): Promise<any[]> {
    const params = category ? `?category=${category}` : '';
    const response = await this.request<any[]>('/products' + params);
    return response.data || [];
  }

  async getAllProductsAdmin(): Promise<any[]> {
    const response = await this.request<any[]>('/products/admin/all');
    return response.data || [];
  }

  // Método para verificar 2FA (Ativação)
  async verify2FA(email: string, code: string): Promise<any> {
    return this.request<any>('/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ email, code })
    });
  }

  // Método para confirmar saque via 2FA
  async confirmWithdrawal(transactionId: number, code: string): Promise<any> {
    return this.request<any>('/withdrawals/confirm', {
      method: 'POST',
      body: JSON.stringify({ transactionId, code })
    });
  }

  async createProduct(data: any): Promise<any> {
    const response = await this.request<any>('/products', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.data!;
  }

  async updateProduct(id: string, data: any): Promise<any> {
    const response = await this.request<any>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return response.data!;
  }

  async deleteProduct(id: string): Promise<void> {
    await this.request<void>(`/products/${id}`, {
      method: 'DELETE'
    });
  }

  async fetchProductMetadata(url: string): Promise<{ title: string; description: string; imageUrl: string; price?: number }> {
    const response = await this.request<any>('/products/fetch-metadata', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
    return response.data;
  }

  // Alterar senha
  async changePassword(oldPassword: string, newPassword: string): Promise<any> {
    return this.request<any>('/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword })
    });
  }

  // --- Suporte via Chat ---
  async getChatHistory(): Promise<any> {
    const response = await this.request<any>('/support/history');
    return response.data;
  }

  async sendChatMessage(content: string): Promise<any> {
    const response = await this.request<any>('/support/message', {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    return response.data;
  }

  async escalateChat(): Promise<any> {
    const response = await this.request<any>('/support/escalate', {
      method: 'POST'
    });
    return response;
  }

  // --- Admin Support ---
  async getPendingSupportChats(): Promise<any> {
    const response = await this.request<any>('/support/admin/pending');
    return response.data;
  }

  async getAdminChatHistory(chatId: string | number): Promise<any> {
    const response = await this.request<any>(`/support/admin/chat/${chatId}`);
    return response.data;
  }

  async respondSupportChat(chatId: string | number, content: string): Promise<any> {
    const response = await this.request<any>('/support/admin/respond', {
      method: 'POST',
      body: JSON.stringify({ chatId, content })
    });
    return response.data;
  }

  // Notificações em tempo real (SSE) - DESATIVADO TEMPORARIAMENTE PARA ESTABILIDADE
  listenToNotifications(_onNotification: (data: any) => void): () => void {
    /* 
    if (!this.token) return () => { };

    const url = `${API_BASE_URL}/notifications/stream?token=${this.token}`;
    const eventSource = new EventSource(url);

    ...
    */
    return () => { };
  }
  async closeSupportChat(chatId: string | number): Promise<any> {
    const response = await this.request<any>('/support/admin/close', {
      method: 'POST',
      body: JSON.stringify({ chatId })
    });
    return response.data;
  }

  async sendSupportFeedback(chatId: string | number, rating: number, comment?: string): Promise<any> {
    const response = await this.request<any>('/support/feedback', {
      method: 'POST',
      body: JSON.stringify({ chatId, rating, comment })
    });
    return response.data;
  }

  async getSupportFeedbacks(): Promise<any> {
    const response = await this.request<any>('/support/admin/feedback');
    return response.data;
  }
}

// Exportar instância única do serviço
export const apiService = new ApiService();