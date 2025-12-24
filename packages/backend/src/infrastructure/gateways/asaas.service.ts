import { v4 as uuidv4 } from 'uuid';

// Asaas API Configuration
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';
const ASAAS_BASE_URL = process.env.ASAAS_SANDBOX === 'true'
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/v3';

export interface PaymentRequest {
    amount: number;
    description: string;
    email: string;
    external_reference?: string;
    cpf?: string;
    name?: string;
    installments?: number;
    billingType?: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
    // Campos legados (compatibilidade com código existente)
    token?: string;
    payment_method_id?: string;
    issuer_id?: number;
    // Dados do cartão (para checkout transparente Asaas)
    creditCard?: {
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        ccv: string;
    };
    creditCardHolderInfo?: {
        name: string;
        email: string;
        cpfCnpj: string;
        postalCode: string;
        addressNumber: string;
        phone: string;
    };
}

export interface PaymentResponse {
    id: string;
    qr_code?: string;
    qr_code_base64?: string;
    status: string;
    external_reference: string;
    payment_method_id?: string;
    invoiceUrl?: string;
    pixCopiaECola?: string;
    expirationDate?: string;
}

export interface PayoutRequest {
    pixKey: string;
    pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
    amount: number;
    description?: string;
}

export interface PayoutResponse {
    id: string;
    status: string;
    value: number;
    dateCreated: string;
}

/**
 * Helper para fazer requisições à API Asaas
 */
const asaasRequest = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
    const url = `${ASAAS_BASE_URL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout

    try {
        console.log(`[ASAAS] Requesting ${endpoint}...`);
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY,
                ...options.headers,
            },
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
            console.error('Asaas API Error:', JSON.stringify(data));
            throw new Error(data.errors?.[0]?.description || data.message || 'Erro na API Asaas');
        }

        return data;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Timeout: Asaas API took too long to respond');
        }
        console.error(`Error in Asaas request to ${endpoint}:`, error);
        throw error;
    }
};

/**
 * Busca ou cria um cliente no Asaas (e atualiza CPF se necessário)
 */
const getOrCreateCustomer = async (email: string, name: string, cpf?: string): Promise<string> => {
    try {
        // Buscar cliente existente
        const searchResult = await asaasRequest(`/customers?email=${encodeURIComponent(email)}`);

        if (searchResult.data && searchResult.data.length > 0) {
            const existingCustomer = searchResult.data[0];

            // Se o cliente existe mas não tem CPF, e temos CPF para atualizar
            if (cpf && !existingCustomer.cpfCnpj) {
                console.log(`[ASAAS] Atualizando CPF do cliente ${existingCustomer.id}...`);
                await asaasRequest(`/customers/${existingCustomer.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        cpfCnpj: cpf.replace(/\D/g, ''), // Apenas números
                    }),
                });
                console.log(`[ASAAS] CPF atualizado com sucesso para cliente ${existingCustomer.id}`);
            }

            return existingCustomer.id;
        }

        // Criar novo cliente
        const newCustomer = await asaasRequest('/customers', {
            method: 'POST',
            body: JSON.stringify({
                name: name || email.split('@')[0],
                email: email,
                cpfCnpj: cpf ? cpf.replace(/\D/g, '') : undefined,
                notificationDisabled: true,
            }),
        });

        return newCustomer.id;
    } catch (error: any) {
        console.error('Erro ao buscar/criar cliente Asaas:', error);
        throw error;
    }
};

/**
 * Cria um pagamento via PIX
 */
export const createPixPayment = async (data: PaymentRequest): Promise<PaymentResponse> => {
    try {
        const external_reference = data.external_reference || uuidv4();

        // Buscar ou criar cliente
        const customerId = await getOrCreateCustomer(data.email, data.name || '', data.cpf);

        // Criar cobrança PIX
        const payment = await asaasRequest('/payments', {
            method: 'POST',
            body: JSON.stringify({
                customer: customerId,
                billingType: 'PIX',
                value: data.amount,
                description: data.description,
                externalReference: external_reference,
                dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Vence em 24h
            }),
        });

        // Buscar QR Code do PIX
        const pixQrCode = await asaasRequest(`/payments/${payment.id}/pixQrCode`);

        return {
            id: payment.id,
            qr_code: pixQrCode.payload,
            qr_code_base64: pixQrCode.encodedImage,
            status: payment.status,
            external_reference: external_reference,
            payment_method_id: 'pix',
            invoiceUrl: payment.invoiceUrl,
            pixCopiaECola: pixQrCode.payload,
            expirationDate: pixQrCode.expirationDate,
        };
    } catch (error: any) {
        console.error('Erro Asaas PIX:', error);
        throw new Error(error.message || 'Falha ao processar pagamento PIX com Asaas');
    }
};

/**
 * Cria um pagamento via Cartão de Crédito
 */
export const createCardPayment = async (data: PaymentRequest): Promise<PaymentResponse> => {
    try {
        const external_reference = data.external_reference || uuidv4();

        // Buscar ou criar cliente
        const customerId = await getOrCreateCustomer(data.email, data.name || '', data.cpf);

        if (!data.creditCard || !data.creditCardHolderInfo) {
            throw new Error('Dados do cartão são obrigatórios');
        }

        // Criar cobrança com cartão
        const payment = await asaasRequest('/payments', {
            method: 'POST',
            body: JSON.stringify({
                customer: customerId,
                billingType: 'CREDIT_CARD',
                value: data.amount,
                description: data.description,
                externalReference: external_reference,
                installmentCount: data.installments || 1,
                installmentValue: data.installments ? data.amount / data.installments : data.amount,
                creditCard: {
                    holderName: data.creditCard.holderName,
                    number: data.creditCard.number,
                    expiryMonth: data.creditCard.expiryMonth,
                    expiryYear: data.creditCard.expiryYear,
                    ccv: data.creditCard.ccv,
                },
                creditCardHolderInfo: {
                    name: data.creditCardHolderInfo.name,
                    email: data.creditCardHolderInfo.email,
                    cpfCnpj: data.creditCardHolderInfo.cpfCnpj,
                    postalCode: data.creditCardHolderInfo.postalCode,
                    addressNumber: data.creditCardHolderInfo.addressNumber,
                    phone: data.creditCardHolderInfo.phone,
                },
            }),
        });

        return {
            id: payment.id,
            status: payment.status,
            external_reference: external_reference,
            payment_method_id: 'credit_card',
            invoiceUrl: payment.invoiceUrl,
        };
    } catch (error: any) {
        console.error('Erro Asaas Cartão:', error);
        throw new Error(error.message || 'Falha ao processar cartão com Asaas');
    }
};

/**
 * Consulta status de um pagamento
 */
export const checkPaymentStatus = async (paymentId: string): Promise<string> => {
    try {
        const payment = await asaasRequest(`/payments/${paymentId}`);
        return payment.status;
    } catch (error) {
        console.error('Erro consulta Asaas:', error);
        throw error;
    }
};

/**
 * Cria um payout (transferência PIX para o usuário) - SAQUE AUTOMÁTICO
 */
export const createPayout = async (data: PayoutRequest): Promise<PayoutResponse> => {
    try {
        const transfer = await asaasRequest('/transfers', {
            method: 'POST',
            body: JSON.stringify({
                value: data.amount,
                pixAddressKey: data.pixKey,
                pixAddressKeyType: data.pixKeyType,
                description: data.description || 'Saque Cred30',
            }),
        });

        return {
            id: transfer.id,
            status: transfer.status,
            value: transfer.value,
            dateCreated: transfer.dateCreated,
        };
    } catch (error: any) {
        console.error('Erro Asaas Payout:', error);
        throw new Error(error.message || 'Falha ao processar saque via Asaas');
    }
};

/**
 * Consulta saldo disponível na conta Asaas
 */
export const getAccountBalance = async (): Promise<{ balance: number; pendingBalance: number }> => {
    try {
        const balance = await asaasRequest('/finance/balance');
        return {
            balance: balance.balance,
            pendingBalance: balance.pendingBalance || 0,
        };
    } catch (error: any) {
        console.error('Erro ao consultar saldo Asaas:', error);
        throw error;
    }
};

/**
 * Detecta o tipo de chave PIX automaticamente
 */
export const detectPixKeyType = (pixKey: string): 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP' => {
    // Remove caracteres especiais
    const cleanKey = pixKey.replace(/[.\-\/\s()]/g, '');

    // CPF: 11 dígitos numéricos
    if (/^\d{11}$/.test(cleanKey)) {
        return 'CPF';
    }

    // CNPJ: 14 dígitos numéricos
    if (/^\d{14}$/.test(cleanKey)) {
        return 'CNPJ';
    }

    // Telefone: começa com +55 ou tem formato de celular
    if (/^(\+55)?\d{10,11}$/.test(cleanKey) || /^\d{10,11}$/.test(cleanKey)) {
        return 'PHONE';
    }

    // Email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pixKey)) {
        return 'EMAIL';
    }

    // Chave aleatória (EVP) - UUID format
    return 'EVP';
};

/**
 * Simula aprovação de pagamento (apenas para sandbox)
 */
export const simulatePaymentApproval = async (paymentId: string): Promise<string> => {
    if (ASAAS_BASE_URL.includes('sandbox')) {
        // No sandbox, podemos confirmar pagamentos manualmente
        try {
            const result = await asaasRequest(`/payments/${paymentId}/receiveInCash`, {
                method: 'POST',
                body: JSON.stringify({
                    paymentDate: new Date().toISOString().split('T')[0],
                    value: undefined, // Usar o valor original
                }),
            });
            return result.status;
        } catch (error) {
            console.error('Erro ao simular aprovação Asaas:', error);
            throw error;
        }
    }
    throw new Error('Simulação só disponível em ambiente sandbox');
};
