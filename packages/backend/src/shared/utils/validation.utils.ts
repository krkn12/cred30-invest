import { z } from 'zod';

// Schema para validação de valores monetários
const monetaryValue = z.number()
  .positive("Valor deve ser maior que zero")
  .max(999999.99, "Valor máximo permitido é R$ 999.999,99")
  .refine((val) => Number.isFinite(val), "Valor deve ser um número válido");

// Schema para validação de email
const emailSchema = z.string()
  .email("Email inválido")
  .min(5, "Email deve ter pelo menos 5 caracteres")
  .max(255, "Email deve ter no máximo 255 caracteres");

// Schema para validação de senha
const passwordSchema = z.string()
  .min(8, "Senha deve ter pelo menos 8 caracteres")
  .max(128, "Senha deve ter no máximo 128 caracteres")
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número");

// Schema para validação de nome
const nameSchema = z.string()
  .min(3, "Nome deve ter pelo menos 3 caracteres")
  .max(100, "Nome deve ter no máximo 100 caracteres")
  .regex(/^[a-zA-ZÀ-ÿ\s']+$/, "Nome deve conter apenas letras e espaços");

// Schema para validação de PIX
const pixSchema = z.string()
  .min(5, "Chave PIX deve ter pelo menos 5 caracteres")
  .max(140, "Chave PIX deve ter no máximo 140 caracteres");

// Schema para validação de frase secreta
const secretPhraseSchema = z.string()
  .min(3, "Frase secreta deve ter pelo menos 3 caracteres")
  .max(100, "Frase secreta deve ter no máximo 100 caracteres");

// Schemas de requisição
export const schemas = {
  // Autenticação
  login: z.object({
    email: emailSchema,
    password: z.string().min(1, "Senha é obrigatória"),
    secretPhrase: secretPhraseSchema
  }),

  register: z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    secretPhrase: secretPhraseSchema,
    pixKey: pixSchema,
    referralCode: z.string().optional()
  }),

  resetPassword: z.object({
    email: emailSchema,
    secretPhrase: secretPhraseSchema,
    newPassword: passwordSchema
  }),

  // Operações de cotas
  buyQuota: z.object({
    quantity: z.number()
      .int("Quantidade deve ser um número inteiro")
      .positive("Quantidade deve ser maior que zero")
      .min(1, "Quantidade mínima é 1 cota")
      .max(100, "Quantidade máxima por compra é 100 cotas"),
    useBalance: z.boolean()
  }),

  sellQuota: z.object({
    quotaId: z.string()
      .uuid("ID da cota inválido")
      .min(1, "ID da cota é obrigatório")
  }),

  // Operações de apoio mútuo
  requestLoan: z.object({
    amount: z.number()
      .positive("Valor deve ser maior que zero")
      .min(50, "Valor mínimo de apoio é R$ 50,00")
      .max(10000, "Valor máximo de apoio é R$ 10.000,00"),
    installments: z.number()
      .int("Número de parcelas deve ser inteiro")
      .min(1, "Mínimo 1 parcela")
      .max(12, "Máximo 12 parcelas"),
    receivePixKey: pixSchema
  }),

  repayLoan: z.object({
    loanId: z.string()
      .uuid("ID do apoio inválido")
      .min(1, "ID do apoio é obrigatório"),
    useBalance: z.boolean()
  }),

  // Operações de transações
  withdraw: z.object({
    amount: z.number()
      .positive("Valor deve ser maior que zero")
      .min(10, "Valor mínimo de saque é R$ 10,00")
      .max(10000, "Valor máximo de saque é R$ 10.000,00"),
    pixKey: pixSchema
  }),

  // Operações administrativas
  updateBalance: z.object({
    newBalance: z.number()
      .nonnegative("Saldo não pode ser negativo")
      .max(999999999.99, "Valor máximo permitido é R$ 999.999.999,99")
  }),

  addProfit: z.object({
    amountToAdd: z.number()
      .nonnegative("Valor não pode ser negativo")
      .min(0.01, "Valor mínimo é R$ 0,01")
      .max(999999999.99, "Valor máximo permitido é R$ 999.999.999,99")
  }),

  processAction: z.object({
    id: z.string().min(1, "ID é obrigatório"),
    type: z.enum(['TRANSACTION', 'LOAN']),
    action: z.enum(['APPROVE', 'REJECT'])
  }),

  // Atualização de perfil
  updateProfile: z.object({
    name: nameSchema.optional(),
    pixKey: pixSchema.optional(),
    secretPhrase: secretPhraseSchema.optional()
  }).refine((data) => Object.keys(data).length > 0, {
    message: "Pelo menos um campo deve ser fornecido para atualização"
  })
};

// Função de validação genérica
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: string[];
} {
  try {
    const validatedData = schema.parse(data);
    return {
      success: true,
      data: validatedData
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => err.message);
      return {
        success: false,
        errors
      };
    }
    return {
      success: false,
      errors: ['Erro de validação desconhecido']
    };
  }
}

// Middleware de validação para Hono
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return async (c: any, next: any) => {
    try {
      const body = await c.req.json();
      const validation = validateRequest(schema, body);

      if (!validation.success) {
        return c.json({
          success: false,
          message: 'Dados inválidos',
          errors: validation.errors
        }, 400);
      }

      // Adicionar dados validados ao contexto
      c.set('validatedData', validation.data);
      await next();
    } catch (error) {
      return c.json({
        success: false,
        message: 'Erro ao processar requisição'
      }, 400);
    }
  };
}