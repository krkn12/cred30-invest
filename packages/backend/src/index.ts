import packageJson from '../package.json';
import 'dotenv/config';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { authRoutes } from './presentation/http/routes/auth.routes';
import { userRoutes } from './presentation/http/routes/users.routes';
import { quotaRoutes } from './presentation/http/routes/quotas.routes';
import { loanRoutes } from './presentation/http/routes/loans.routes';
import { transactionRoutes } from './presentation/http/routes/transactions.routes';
import { adminRoutes } from './presentation/http/routes/admin.routes';
import { withdrawalRoutes } from './presentation/http/routes/withdrawals.routes';
import { gamesRoutes } from './presentation/http/routes/games.routes';
import { productsRoutes } from './presentation/http/routes/products.routes';
import { webhookRoutes } from './presentation/http/routes/webhooks.routes';
import { notificationRoutes } from './presentation/http/routes/notifications.routes';
import { marketplaceRoutes } from './presentation/http/routes/marketplace.routes';
import { educationRoutes } from './presentation/http/routes/education.routes';
import { votingRoutes } from './presentation/http/routes/voting.routes';
import { initializeScheduler } from './scheduler';

import { logger } from 'hono/logger';
import { monetizationRoutes } from './presentation/http/routes/monetization.routes';
import { supportRoutes } from './presentation/http/routes/support.routes';
import { monetizationRoutes as monetizationRoutesAlt } from './presentation/http/routes/monetization.routes'; // Caso haja conflito
import { initializeDatabase, pool } from './infrastructure/database/postgresql/connection/pool';

const app = new Hono();

// Middlewares Globais
app.use('*', cors());
app.use('*', compress());
app.use('*', logger());

async function startServer() {
  try {
    // Inicialização do Banco de Dados e Tabelas
    console.log('--- Iniciando Cred30 Backend ---');
    await initializeDatabase();

    // Inicialização do Agendador (Scheduler)
    initializeScheduler(pool);

    // Rotas
    app.route('/api/auth', authRoutes);
    app.route('/api/users', userRoutes);
    app.route('/api/quotas', quotaRoutes);
    app.route('/api/loans', loanRoutes);
    app.route('/api/transactions', transactionRoutes);
    app.route('/api/admin', adminRoutes);
    app.route('/api/withdrawals', withdrawalRoutes);
    app.route('/api/games', gamesRoutes);
    app.route('/api/products', productsRoutes);
    app.route('/api/webhooks', webhookRoutes);
    app.route('/api/notifications', notificationRoutes);
    app.route('/api/marketplace', marketplaceRoutes);
    app.route('/api/monetization', monetizationRoutes);
    app.route('/api/support', supportRoutes);
    app.route('/api/education', educationRoutes);
    app.route('/api/voting', votingRoutes);

    // Rota de health check
    app.get('/api/health', (c) => {
      return c.json({
        status: 'ok',
        version: packageJson.version,
        db: 'connected',
        timestamp: new Date().toISOString()
      });
    });

    const port = process.env.PORT || 3001;
    console.log(`🚀 Servidor pronto na porta ${port}`);

    serve({
      fetch: app.fetch,
      port: Number(port),
    });
  } catch (error) {
    console.error('❌ Erro fatal no boot do servidor:', error);
    process.exit(1);
  }
}

startServer();
