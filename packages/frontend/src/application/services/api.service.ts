// URL base da API - usa caminho relativo (proxy Vite redireciona para backend)
const API_BASE_URL = '/api';

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

  // Método privado para obter headers comuns
  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Expires': '0',
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
        throw new Error(data.message || 'Erro na requisição');
      }

      return data;
    } catch (error) {
      console.error('Erro na requisição:', error);
      throw error;
    }
  }

  // Método para login
  async login(email: string, password: string, secretPhrase: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, secretPhrase }),
    });

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
  ): Promise<AuthResponse> {
    const requestBody: any = { name, email, password, secretPhrase, pixKey };
    if (referralCode && referralCode.trim() !== '') {
      requestBody.referralCode = referralCode;
    }

    const response = await this.request<AuthResponse>('/auth/register', {
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

  // Método para comprar cotas
  async buyQuotas(quantity: number, useBalance: boolean): Promise<any> {
    const response = await this.request<any>('/quotas/buy', {
      method: 'POST',
      body: JSON.stringify({
        quantity,
        useBalance
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
  async requestLoan(amount: number, installments: number, receivePixKey: string): Promise<any> {
    // DEBUG: Log para verificar o PIX sendo enviado na requisição
    console.log('DEBUG - API Service - Enviando requisição de empréstimo:', {
      amount,
      installments,
      receivePixKey,
      pixVazio: !receivePixKey,
      pixTipo: typeof receivePixKey
    });

    const response = await this.request<any>('/loans/request', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        installments,
        receivePixKey
      }),
    });
    return response.data;
  }

  // Método para pagar empréstimo
  async repayLoan(loanId: string, useBalance: boolean): Promise<any> {
    const response = await this.request<any>('/loans/repay', {
      method: 'POST',
      body: JSON.stringify({ loanId, useBalance }),
    });
    return response.data;
  }

  // Método para solicitar saque
  async requestWithdrawal(amount: number, pixKey: string): Promise<any> {
    const response = await this.request<any>('/transactions/withdraw', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        pixKey
      }),
    });
    return response.data;
  }

  // Métodos administrativos
  async getAdminDashboard(): Promise<any> {
    const response = await this.request<any>('/admin/dashboard');
    return response.data;
  }

  async updateSystemBalance(newBalance: number): Promise<void> {
    await this.request<void>('/admin/system-balance', {
      method: 'POST',
      body: JSON.stringify({ newBalance }),
    });
  }

  async addProfitToPool(amountToAdd: number): Promise<void> {
    await this.request<void>('/admin/profit-pool', {
      method: 'POST',
      body: JSON.stringify({ amountToAdd }),
    });
  }

  async processAdminAction(id: string, type: 'TRANSACTION' | 'LOAN', action: 'APPROVE' | 'REJECT'): Promise<void> {
    console.log('Enviando para API:', { id, type, action });
    // Enviar ID como string conforme esperado pelo schema
    const requestBody = JSON.stringify({ id, type, action });
    console.log('Corpo da requisição:', requestBody);

    await this.request<void>('/admin/process-action', {
      method: 'POST',
      body: requestBody,
    });
  }

  async distributeDividends(): Promise<any> {
    const response = await this.request<any>('/admin/distribute-dividends', {
      method: 'POST',
    });
    return response.data;
  }

  // Função temporária para corrigir PIX de empréstimos existentes
  async fixLoanPix(loanId: string, pixKey: string): Promise<any> {
    const response = await this.request<any>('/admin/fix-loan-pix', {
      method: 'POST',
      body: JSON.stringify({ loanId, pixKey }),
    });
    return response.data;
  }

  // Aprovar pagamento de empréstimo
  async approvePayment(transactionId: string): Promise<any> {
    const response = await this.request<any>('/admin/approve-payment', {
      method: 'POST',
      body: JSON.stringify({ transactionId }),
    });
    return response.data;
  }

  // Rejeitar pagamento de empréstimo
  async rejectPayment(transactionId: string): Promise<any> {
    const response = await this.request<any>('/admin/reject-payment', {
      method: 'POST',
      body: JSON.stringify({ transactionId }),
    });
    return response.data;
  }

  // Aprovar saque
  async approveWithdrawal(transactionId: string): Promise<any> {
    const response = await this.request<any>('/admin/approve-withdrawal', {
      method: 'POST',
      body: JSON.stringify({ transactionId }),
    });
    return response.data;
  }

  // Rejeitar saque
  async rejectWithdrawal(transactionId: string): Promise<any> {
    const response = await this.request<any>('/admin/reject-withdrawal', {
      method: 'POST',
      body: JSON.stringify({ transactionId }),
    });
    return response.data;
  }

  // Obter carteira de crédito do cliente
  async getCreditPortfolio(userId: string): Promise<any> {
    const response = await this.request<any>(`/admin/credit-portfolio/${userId}`);
    return response.data;
  }



  // Verificar se o usuário está autenticado
  isAuthenticated(): boolean {
    return !!this.token;
  }

  // Obter token atual
  getToken(): string | null {
    return this.token;
  }
}

// Exportar instância única do serviço
export const apiService = new ApiService();