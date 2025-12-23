const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_ItsW94lidRHU@ep-fragrant-bird-adl8rnm6.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function listColumns() {
    try {
        const res = await pool.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
        console.log('Colunas encontradas na tabela users:', res.rows.map(r => r.column_name).join(', '));
    } catch (err) {
        console.error('Erro ao listar colunas:', err);
    } finally {
        pool.end();
    }
}

listColumns();
