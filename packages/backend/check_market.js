const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_ItsW94lidRHU@ep-fragrant-bird-adl8rnm6.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function listColumns() {
    try {
        const resOrders = await pool.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'marketplace_orders'
    `);
        console.log('Colunas marketplace_orders:', resOrders.rows.map(r => r.column_name).join(', '));

        const resListings = await pool.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'marketplace_listings'
    `);
        console.log('Colunas marketplace_listings:', resListings.rows.map(r => r.column_name).join(', '));

    } catch (err) {
        console.error('Erro ao listar colunas:', err);
    } finally {
        pool.end();
    }
}

listColumns();
