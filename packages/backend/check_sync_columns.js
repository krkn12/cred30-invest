require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkColumns() {
    const tables = ['users', 'quotas', 'loans', 'transactions'];
    for (const table of tables) {
        const r = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [table]);
        console.log(`\nColunas de ${table}:`);
        r.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));
    }
    await pool.end();
}
checkColumns();
