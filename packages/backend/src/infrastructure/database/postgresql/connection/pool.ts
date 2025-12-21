import { Pool } from 'pg';
// Importações comentadas para evitar dependência circular
// import { initializeAuditTable } from '../../../logging/audit.middleware';
// import { initializeRateLimitTable } from '../../../presentation/http/middleware/rate-limit.middleware';
// import { createIndexes } from '../../../../utils/indexes';

// Configuração do pool de conexões PostgreSQL
// Configuração do pool de conexões PostgreSQL
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.DATABASE_URL;

const poolConfig: any = {
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
  poolConfig.ssl = { rejectUnauthorized: false };
} else {
  // Configuração local de fallback
  poolConfig.host = process.env.DB_HOST || 'localhost';
  poolConfig.port = parseInt(process.env.DB_PORT || '5432');
  poolConfig.user = process.env.DB_USER || 'admin';
  poolConfig.password = process.env.DB_PASSWORD || 'password';
  poolConfig.database = process.env.DB_DATABASE || 'cred30_local';
}

// Criar o pool de conexões
export const pool = new Pool(poolConfig);

// Variável global para armazenar o pool de conexões
let dbPool: Pool | null = null;

export const getDbPool = (c?: any): Pool => {
  // Se o pool já foi injetado no contexto pelo Hono, use-o
  if (c && c.get && c.get('dbPool')) {
    return c.get('dbPool');
  }

  // Se não, use o pool global
  if (!dbPool) {
    throw new Error('Pool PostgreSQL não inicializado. Use getDbPool apenas em rotas Hono.');
  }

  return dbPool;
};

export const setDbPool = (pool: Pool) => {
  dbPool = pool;
};

// Função para gerar IDs únicos (UUID via PostgreSQL)
export const generateId = () => {
  // Gera um UUID v4 formatado como string
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Função para gerar código de indicação
export const generateReferralCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// Função para inicializar o banco de dados (criar tabelas se não existirem)
export const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('Conectado ao PostgreSQL com sucesso!');

    // Criar extensão UUID se não existir
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Verificar se a tabela users existe e recriar se necessário (mudança de schema password -> password_hash)
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      );
    `);

    if (tableExists.rows[0].exists) {
      // Verificar se tem a coluna password (schema antigo)
      const oldColumnExists = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'password'
      `);

      if (oldColumnExists.rows.length > 0) {
        console.log('Detectado schema antigo (coluna password). Recriando tabela users...');
        // Drop cascade para remover referências de outras tabelas
        await client.query('DROP TABLE users CASCADE');
        // Também dropar tabelas dependentes que podem ter ficado inconsistentes
        await client.query('DROP TABLE IF EXISTS quotas CASCADE');
        await client.query('DROP TABLE IF EXISTS loans CASCADE');
        await client.query('DROP TABLE IF EXISTS transactions CASCADE');
      } else {
        // Se a tabela existe, verificar se tem as colunas necessárias
        // Verificar individualmente as colunas críticas e adicionar se faltarem (mais seguro que DROP TABLE)
        const scoreColumn = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'score'
        `);

        if (scoreColumn.rows.length === 0) {
          console.log('Adicionando coluna score à tabela users...');
          await client.query('ALTER TABLE users ADD COLUMN score INTEGER DEFAULT 300');
        }

        const verifiedColumn = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_email_verified'
        `);

        if (verifiedColumn.rows.length === 0) {
          console.log('Adicionando colunas de verificação de email...');
          await client.query('ALTER TABLE users ADD COLUMN is_email_verified BOOLEAN DEFAULT FALSE');
          await client.query('ALTER TABLE users ADD COLUMN verification_code VARCHAR(10)');
          await client.query('ALTER TABLE users ADD COLUMN reset_password_token VARCHAR(255)');
        }

        const tfaColumn = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'two_factor_secret'
        `);

        if (tfaColumn.rows.length === 0) {
          console.log('Adicionando colunas de 2FA à tabela users...');
          await client.query('ALTER TABLE users ADD COLUMN two_factor_secret TEXT');
          await client.query('ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE');
        }

        const termsColumn = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'accepted_terms_at'
        `);

        if (termsColumn.rows.length === 0) {
          console.log('Adicionando coluna accepted_terms_at à tabela users...');
          await client.query('ALTER TABLE users ADD COLUMN accepted_terms_at TIMESTAMP');
        }

        console.log('Tabela users verificada e atualizada com sucesso');
      }
    }

    // Criar tabela de usuários (usando SERIAL para auto-incremento)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        secret_phrase VARCHAR(255) NOT NULL,
        pix_key VARCHAR(255) NOT NULL,
        balance DECIMAL(10,2) DEFAULT 0,
        referral_code VARCHAR(10) UNIQUE,
        referred_by VARCHAR(10),
        is_admin BOOLEAN DEFAULT FALSE,
        score INTEGER DEFAULT 300,
        is_email_verified BOOLEAN DEFAULT FALSE,
        verification_code VARCHAR(10),
        reset_password_token VARCHAR(255),
        two_factor_secret TEXT,
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        accepted_terms_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Verificar o tipo da coluna id da tabela users para garantir integridade das chaves estrangeiras
    const userIdTypeResult = await client.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'id'
    `);

    let userIdType = 'INTEGER'; // Default para SERIAL
    if (userIdTypeResult.rows.length > 0) {
      const type = userIdTypeResult.rows[0].data_type;
      console.log(`Tipo de dado detectado para users.id: ${type}`);
      if (type === 'uuid') {
        userIdType = 'UUID';
      }
    }

    // Criar tabela de cotas (usando SERIAL para consistência)
    // Atualizado: Removida coluna quantity, unit_price e total_amount pois agora é 1 linha por cota
    // Atualizado: Usa o tipo correto para user_id (UUID ou INTEGER)
    await client.query(`
      CREATE TABLE IF NOT EXISTS quotas (
        id SERIAL PRIMARY KEY,
        user_id ${userIdType} REFERENCES users(id),
        purchase_price DECIMAL(10,2) NOT NULL,
        current_value DECIMAL(10,2) NOT NULL,
        purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'ACTIVE'
      );
    `);

    // Verificar se a tabela quotas tem a estrutura antiga
    const quotasTableInfo = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'quotas' AND column_name = 'quantity'
    `);

    if (quotasTableInfo.rows.length > 0) {
      console.log('Detectado schema antigo na tabela quotas (com coluna quantity). Recriando tabela...');
      await client.query('DROP TABLE quotas CASCADE');
      await client.query(`
        CREATE TABLE IF NOT EXISTS quotas (
          id SERIAL PRIMARY KEY,
          user_id ${userIdType} REFERENCES users(id),
          purchase_price DECIMAL(10,2) NOT NULL,
          current_value DECIMAL(10,2) NOT NULL,
          purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(20) DEFAULT 'ACTIVE'
        );
      `);
      console.log('Tabela quotas recriada com novo schema.');
    }

    // Verificar se a tabela loans existe
    const loansTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'loans'
      );
    `);

    if (loansTableExists.rows[0].exists) {
      // Verificar se a coluna installments existe na tabela loans
      const installmentsColumnExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'loans'
          AND column_name = 'installments'
        );
      `);

      // Se a coluna installments não existir, adicioná-la
      if (!installmentsColumnExists.rows[0].exists) {
        await client.query('ALTER TABLE loans ADD COLUMN installments INTEGER DEFAULT 1');
        console.log('Coluna installments adicionada à tabela loans');
      }

      // Verificar se a coluna pix_key_to_receive existe na tabela loans
      const pixKeyColumnExists = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'loans'
          AND column_name = 'pix_key_to_receive'
        );
      `);

      if (!pixKeyColumnExists.rows[0].exists) {
        await client.query('ALTER TABLE loans ADD COLUMN pix_key_to_receive VARCHAR(255)');
        console.log('Coluna pix_key_to_receive adicionada à tabela loans');
      }

      // Verificar se a coluna penalty_rate existe na tabela loans
      const penaltyRateColumnExists = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'loans'
          AND column_name = 'penalty_rate'
        );
      `);

      if (!penaltyRateColumnExists.rows[0].exists) {
        // Adicionar penalty_rate como nullable inicialmente para evitar erro, depois update com default
        await client.query('ALTER TABLE loans ADD COLUMN penalty_rate DECIMAL(5,2) DEFAULT 0.4');
        console.log('Coluna penalty_rate adicionada à tabela loans');
      }

      // Verificar se a coluna term_days existe na tabela loans
      const termDaysColumnExists = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'loans'
          AND column_name = 'term_days'
        );
      `);

      if (!termDaysColumnExists.rows[0].exists) {
        await client.query('ALTER TABLE loans ADD COLUMN term_days INTEGER DEFAULT 30');
        console.log('Coluna term_days adicionada à tabela loans');
      }
    }

    // Criar tabela de empréstimos (usando SERIAL para consistência)
    // Atualizado para incluir todas as colunas
    await client.query(`
      CREATE TABLE IF NOT EXISTS loans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        amount DECIMAL(10,2) NOT NULL,
        interest_rate DECIMAL(5,2) NOT NULL,
        penalty_rate DECIMAL(5,2) DEFAULT 0.4,
        total_repayment DECIMAL(10,2) NOT NULL,
        installments INTEGER DEFAULT 1,
        term_days INTEGER DEFAULT 30,
        status VARCHAR(20) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        due_date TIMESTAMP,
        payout_status VARCHAR(20) DEFAULT 'NONE',
        pix_key_to_receive VARCHAR(255)
      );
    `);

    // Garantir que as colunas novas existam em bancos já criados
    await client.query(`
      ALTER TABLE loans ADD COLUMN IF NOT EXISTS payout_status VARCHAR(20) DEFAULT 'NONE';
    `);

    // Verificar se a tabela loan_installments existe
    const loanInstallmentsTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'loan_installments'
      );
    `);

    if (!loanInstallmentsTableExists.rows[0].exists) {
      // Criar tabela de parcelas de empréstimos (usando SERIAL para consistência)
      await client.query(`
        CREATE TABLE loan_installments (
          id SERIAL PRIMARY KEY,
          loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
          amount DECIMAL(10,2) NOT NULL,
          use_balance BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Tabela loan_installments criada com sucesso!');
    } else {
      // Verificar se a coluna use_balance existe na tabela loan_installments (migração para tabelas antigas)
      const useBalanceColumnExists = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'loan_installments'
          AND column_name = 'use_balance'
        );
      `);

      if (!useBalanceColumnExists.rows[0].exists) {
        await client.query('ALTER TABLE loan_installments ADD COLUMN use_balance BOOLEAN DEFAULT FALSE');
        console.log('Coluna use_balance adicionada à tabela loan_installments');
      }
    }

    // Verificar se a tabela transactions existe
    const transactionsTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'transactions'
      );
    `);

    if (transactionsTableExists.rows[0].exists) {
      // Verificar se a coluna metadata existe na tabela transactions
      const metadataColumnExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'transactions'
          AND column_name = 'metadata'
        );
      `);

      // Se a coluna metadata não existir, adicioná-la
      if (!metadataColumnExists.rows[0].exists) {
        await client.query('ALTER TABLE transactions ADD COLUMN metadata JSONB');
        console.log('Coluna metadata adicionada à tabela transactions');
      }
    }

    // Criar tabela de transações (usando SERIAL para consistência)
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        type VARCHAR(20) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        gateway_cost DECIMAL(10,2) DEFAULT 0,
        description TEXT,
        status VARCHAR(20) DEFAULT 'PENDING',
        metadata JSONB,
        payout_status VARCHAR(20) DEFAULT 'NONE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP
      );
    `);

    // Garantir que as colunas novas existam em bancos já criados
    await client.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payout_status VARCHAR(20) DEFAULT 'NONE';
    `);

    // Verificar se a coluna gateway_cost existe na tabela transactions
    const gatewayCostColumnExists = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'transactions' AND column_name = 'gateway_cost'
      );
    `);

    if (!gatewayCostColumnExists.rows[0].exists) {
      await client.query('ALTER TABLE transactions ADD COLUMN gateway_cost DECIMAL(10,2) DEFAULT 0');
      console.log('Coluna gateway_cost adicionada à tabela transactions');
    }

    // Criar tabela de configuração do sistema
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        id SERIAL PRIMARY KEY,
        system_balance DECIMAL(15,2) DEFAULT 0,
        profit_pool DECIMAL(15,2) DEFAULT 0,
        total_gateway_costs DECIMAL(15,2) DEFAULT 0,
        total_tax_reserve DECIMAL(15,2) DEFAULT 0,
        total_operational_reserve DECIMAL(15,2) DEFAULT 0,
        total_owner_profit DECIMAL(15,2) DEFAULT 0,
        quota_price DECIMAL(10,2) DEFAULT 100,
        loan_interest_rate DECIMAL(5,2) DEFAULT 0.2,
        penalty_rate DECIMAL(5,2) DEFAULT 0.4,
        vesting_period_ms BIGINT DEFAULT 31536000000,
        total_manual_costs DECIMAL(15,2) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Garantir que as colunas novas existam em bancos já criados
    await client.query(`
      ALTER TABLE system_config ADD COLUMN IF NOT EXISTS total_tax_reserve DECIMAL(15,2) DEFAULT 0;
      ALTER TABLE system_config ADD COLUMN IF NOT EXISTS total_operational_reserve DECIMAL(15,2) DEFAULT 0;
      ALTER TABLE system_config ADD COLUMN IF NOT EXISTS total_owner_profit DECIMAL(15,2) DEFAULT 0;
    `);

    // Verificar se a coluna total_gateway_costs existe na tabela system_config
    const totalGatewayCostsColumnExists = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'system_config' AND column_name = 'total_gateway_costs'
      );
    `);

    // Criar tabela de códigos de indicação (Sistema Admin)
    await client.query(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        created_by ${userIdType} REFERENCES users(id),
        max_uses INTEGER,
        current_uses INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    if (!totalGatewayCostsColumnExists.rows[0].exists) {
      await client.query('ALTER TABLE system_config ADD COLUMN total_gateway_costs DECIMAL(15,2) DEFAULT 0');
      console.log('Coluna total_gateway_costs adicionada à tabela system_config');
    }

    // Verificar se a coluna total_manual_costs existe na tabela system_config
    const totalManualCostsColumnExists = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'system_config' AND column_name = 'total_manual_costs'
      );
    `);

    if (!totalManualCostsColumnExists.rows[0].exists) {
      await client.query('ALTER TABLE system_config ADD COLUMN total_manual_costs DECIMAL(15,2) DEFAULT 0');
      console.log('Coluna total_manual_costs adicionada à tabela system_config');
    }

    // Verificar se a coluna updated_at existe na tabela system_config
    const updatedAtColumnExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'system_config'
        AND column_name = 'updated_at'
      );
    `);

    // Se a coluna updated_at não existir, adicioná-la
    if (!updatedAtColumnExists.rows[0].exists) {
      await client.query('ALTER TABLE system_config ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      console.log('Coluna updated_at adicionada à tabela system_config');
    }

    // Criar tabela de auditoria (admin_logs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES users(id),
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(20) NOT NULL,
        entity_id VARCHAR(50),
        old_values JSONB,
        new_values JSONB,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar tabela de rate limiting (rate_limit_logs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_logs (
        id SERIAL PRIMARY KEY,
        identifier VARCHAR(100) NOT NULL,
        user_id INTEGER REFERENCES users(id),
        count INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        endpoint VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar tabela de produtos (Loja de Afiliados - Deprecated em favor do Marketplace P2P)
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        image_url TEXT,
        affiliate_url TEXT NOT NULL,
        price DECIMAL(10, 2),
        category VARCHAR(50) DEFAULT 'geral',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- NOVO MERCADO CRED30 (P2P MARKETPLACE) ---

    // Tabela de Anúncios (OLX STYLE) com suporte a impulsionamento
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_listings (
        id SERIAL PRIMARY KEY,
        seller_id INTEGER REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        category VARCHAR(50) DEFAULT 'OUTROS',
        image_url TEXT,
        status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, SOLD, PAUSED, DELETED
        is_boosted BOOLEAN DEFAULT FALSE,
        boost_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Garantir que as colunas de impulsionamento existem (para bancos legados)
    await client.query(`
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT FALSE;
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMP;
    `);

    // Tabela de Pedidos / Escrow (Garantia Cred30)
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_orders (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER REFERENCES marketplace_listings(id),
        buyer_id INTEGER REFERENCES users(id),
        seller_id INTEGER REFERENCES users(id),
        amount DECIMAL(10, 2) NOT NULL,
        fee_amount DECIMAL(10, 2) NOT NULL, -- Taxa de 5-10% da Cred30 pela garantia
        seller_amount DECIMAL(10, 2) NOT NULL, -- Valor que o vendedor receberá (amount - fee)
        status VARCHAR(30) DEFAULT 'WAITING_PAYMENT', -- WAITING_PAYMENT, WAITING_SHIPPING, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED, DISPUTE
        payment_method VARCHAR(20), -- BALANCE, PIX, etc
        delivery_address TEXT,
        contact_phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tracking_code VARCHAR(100),
        dispute_reason TEXT
      )
    `);

    // --- SISTEMA DE SUPORTE VIA CHAT (IA + HUMANO) ---
    console.log('Verificando tabelas de suporte...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS support_chats (
        id SERIAL PRIMARY KEY,
        user_id ${userIdType} REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'AI_ONLY', -- AI_ONLY, PENDING_HUMAN, ACTIVE_HUMAN, CLOSED
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS support_messages (
        id SERIAL PRIMARY KEY,
        chat_id INTEGER REFERENCES support_chats(id) ON DELETE CASCADE,
        sender_id ${userIdType} REFERENCES users(id), -- NULL se for IA
        role VARCHAR(20) NOT NULL, -- user, assistant, admin
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_support_chats_user ON support_chats(user_id);
      CREATE INDEX IF NOT EXISTS idx_support_chats_status ON support_chats(status);
      CREATE INDEX IF NOT EXISTS idx_support_messages_chat ON support_messages(chat_id);
    `);

    console.log('Tabelas de suporte criadas/verificadas com sucesso!');

    console.log('Tabelas criadas/verificadas com sucesso!');

    // Criar índices de performance
    console.log('Criando índices de performance...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
      CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
      CREATE INDEX IF NOT EXISTS idx_quotas_user_id ON quotas(user_id);
      CREATE INDEX IF NOT EXISTS idx_quotas_status ON quotas(status);
      CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
      CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
    `);

    // Adicionar campos de monetização na tabela de usuários
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_type VARCHAR(20) DEFAULT 'FREE'; -- FREE, PRO
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_reward_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS total_dividends_earned DECIMAL(12, 2) DEFAULT 0;
    `);

    // Criar tabelas de auditoria e webhooks
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          action VARCHAR(100) NOT NULL,
          entity_type VARCHAR(50),
          entity_id VARCHAR(100),
          old_values JSONB,
          new_values JSONB,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS webhook_logs (
          id SERIAL PRIMARY KEY,
          provider VARCHAR(50) NOT NULL,
          payload JSONB NOT NULL,
          status VARCHAR(20) DEFAULT 'PENDING',
          error_message TEXT,
          processed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_webhook_status ON webhook_logs(status);
    `);

    console.log('Audit logs and performance indexes updated successfully!');

    // Inicializar tabelas de auditoria e rate limiting
    // Comentado para evitar dependência circular
    // await initializeAuditTable(pool);
    // await initializeRateLimitTable(pool);

    // Criar índices de performance
    // Comentado para evitar dependência circular
    // await createIndexes(pool);

  } catch (error) {
    console.error('Erro ao inicializar o banco de dados:', error);
    throw error;
  } finally {
    client.release();
  }
};