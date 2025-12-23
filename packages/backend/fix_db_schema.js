const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_ItsW94lidRHU@ep-fragrant-bird-adl8rnm6.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function fixDatabase() {
    try {
        console.log('Aplicando correções no banco de dados...');

        // 1. Adicionar colunas que faltam em marketplace_orders
        // Usamos DO block para evitar erros se a coluna já existir (alternativa ao IF NOT EXISTS em versões antigas do PG, mas IF NOT EXISTS é melhor se suportado)
        await pool.query(`
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES users(id);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'NONE';
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(10);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS courier_rating INT CHECK (courier_rating >= 1 AND courier_rating <= 5);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
    `);

        console.log('Colunas de Delivery adicionadas com sucesso.');

        // 2. Adicionar type AFFILIATE em marketplace_listings para compatibilidade futura (opcional)
        // Mas o erro principal deve ser as colunas acima.

    } catch (err) {
        console.error('Erro ao corrigir banco:', err);
    } finally {
        pool.end();
    }
}

fixDatabase();
