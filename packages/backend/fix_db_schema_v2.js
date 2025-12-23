const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_ItsW94lidRHU@ep-fragrant-bird-adl8rnm6.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function fixDatabase() {
    try {
        console.log('Verificando tipo de dados e corrigindo...');

        // Verificar tipo do ID
        const res = await pool.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id'");
        const idType = res.rows[0]?.data_type;
        console.log('Tipo de ID da tabela users:', idType);

        // Se for INTEGER, a chave estrangeira deve ser INTEGER. Se for UUID, deve ser UUID.
        // O erro anterior disse: "Key columns \"id\" and \"courier_id\" are of incompatible types: integer and uuid."
        // Isso significa que USERS.ID é INTEGER, mas tentamos criar COURIER_ID como UUID.

        // Vamos criar courier_id como INTEGER se o user.id for integer
        if (idType === 'integer') {
            console.log('Detectado ID Integer. Criando colunas compatíveis...');
            await pool.query(`
          ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
          ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0;
          
          -- Correção aqui: courier_id como INTEGER
          ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS courier_id INTEGER REFERENCES users(id);
          
          ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'NONE';
          ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(10);
          ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS courier_rating INT CHECK (courier_rating >= 1 AND courier_rating <= 5);
          ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
        `);
        } else {
            console.log('Detectado ID UUID ou outro. Tentando criação padrão...');
            await pool.query(`
          ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
          ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0;
          ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES users(id);
          ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'NONE';
          ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(10);
          ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS courier_rating INT CHECK (courier_rating >= 1 AND courier_rating <= 5);
          ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
        `);
        }

        console.log('Banco corrigido com sucesso.');

    } catch (err) {
        console.error('Erro ao corrigir banco:', err);
    } finally {
        pool.end();
    }
}

fixDatabase();
