require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Add yield_rate to quotas if not exists
        console.log('Verificando yield_rate em quotas...');
        await client.query(`
      ALTER TABLE quotas ADD COLUMN IF NOT EXISTS yield_rate DECIMAL(10,4) DEFAULT 1.001
    `);

        // 2. Add composite indexes for /sync performance
        console.log('Criando índices de performance...');

        // Transactions: user_id + created_at (for recent tx list)
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id_created_at_v2 
      ON transactions(user_id, created_at DESC)
    `);

        // Quotas: user_id + purchase_date (for active quotas list)
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_quotas_user_id_purchase_date 
      ON quotas(user_id, purchase_date DESC)
    `);

        // Loans: user_id + created_at (for active loans list)
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_loans_user_id_created_at 
      ON loans(user_id, created_at DESC)
    `);

        // 3. User stats optimization index
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_id_stats 
      ON users(id) INCLUDE (balance, score, membership_type, is_verified, security_lock_until)
    `).catch(e => console.log('Note: INCLUDE columns might not be supported on this PG version, skipping.'));

        await client.query('COMMIT');
        console.log('✅ Migração de performance concluída com sucesso!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Erro na migração:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
