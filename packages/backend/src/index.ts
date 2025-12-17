import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './presentation/http/routes/auth.routes';
import { userRoutes } from './presentation/http/routes/users.routes';
import { quotaRoutes } from './presentation/http/routes/quotas.routes';
import { loanRoutes } from './presentation/http/routes/loans.routes';
import { transactionRoutes } from './presentation/http/routes/transactions.routes';
import { adminRoutes } from './presentation/http/routes/admin.routes';
import { withdrawalRoutes } from './presentation/http/routes/withdrawals.routes';
import { pool, initializeDatabase, setDbPool } from './infrastructure/database/postgresql/connection/pool';
import { initializeScheduler } from './scheduler';

const app = new Hono();

// Middleware para CORS
app.use('*', cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3002',
    'http://localhost:3003',
    'http://127.0.0.1:3003',
    'https://33efd838e74b.ngrok-free.app',
    'https://cred30-prod-app-2025.web.app',
    'https://cred30-prod-app-2025.firebaseapp.com',
    'https://cred30-backend.onrender.com'
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires'],
  credentials: true,
}));

async function startServer() {
  try {
    // Inicializar o banco de dados e criar tabelas
    await initializeDatabase();

    // Disponibilizar o pool de conexões PostgreSQL para as rotas
    setDbPool(pool);

    // Inicializar agendador de tarefas (Cron Jobs)
    initializeScheduler(pool);

    /*
    // Rota para limpar dados de teste e preparar para produção (MANTÉM ESTRUTURA, LIMPA DADOS)
    // COMENTADA POR SEGURANÇA APÓS USO
    app.post('/api/clear-test-data', async (c) => {
      try {
        console.log('Limpando dados de teste para produção...');

        // Usar DELETE em ordem reversa de dependência
        await pool.query('DELETE FROM rate_limit_logs');
        await pool.query('DELETE FROM admin_logs');
        await pool.query('DELETE FROM transactions');
        await pool.query('DELETE FROM loan_installments');
        await pool.query('DELETE FROM loans');
        await pool.query('DELETE FROM quotas');
        await pool.query('DELETE FROM users');
        await pool.query('DELETE FROM system_config');

        // CORREÇÃO CRÍTICA: Garantir que vesting_period_ms seja BIGINT para suportar valores > 2.1 bilhões
        // 30 dias em ms = 2,592,000,000 (maior que max Integer 2,147,483,647)
        try {
          await pool.query('ALTER TABLE system_config ALTER COLUMN vesting_period_ms TYPE BIGINT');
        } catch (e) {
          console.log('Aviso: Não foi possível alterar coluna vesting_period_ms (pode já ser bigint ou tabela bloqueada)', e);
        }

        await pool.query(`
          INSERT INTO system_config (system_balance, profit_pool, quota_price, loan_interest_rate, penalty_rate, vesting_period_ms)
          VALUES (0, 0, 50, 0.2, 0.4, 30 * 24 * 60 * 60 * 1000::BIGINT)
        `);

        console.log('Banco de dados pronto para produção (Zero KM).');

        return c.json({
          success: true,
          message: 'Ambiente de produção preparado! Todos os dados de teste foram removidos e schema ajustado.'
        });
      } catch (error: any) {
        console.error('Erro ao limpar dados:', error);
        return c.json({
          success: false,
          message: 'Erro ao preparar ambiente de produção: ' + (error.message || String(error))
        }, 500);
      }
    });
    */

    // Rotas
    app.route('/api/auth', authRoutes);
    app.route('/api/users', userRoutes);
    app.route('/api/quotas', quotaRoutes);
    app.route('/api/loans', loanRoutes);
    app.route('/api/transactions', transactionRoutes);
    app.route('/api/admin', adminRoutes);
    app.route('/api/withdrawals', withdrawalRoutes);
    // Rota de health check
    app.get('/api/health', (c) => {
      return c.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    const port = process.env.PORT || 3001;
    console.log(`Servidor rodando na porta ${port}`);

    serve({
      fetch: app.fetch,
      port: Number(port),
    });
  } catch (error) {
    console.error('Erro ao conectar ao PostgreSQL:', error);
    process.exit(1);
  }
}

startServer();