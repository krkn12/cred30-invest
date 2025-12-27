require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkIndexes() {
    const tables = ['quotas', 'loans', 'users'];
    for (const table of tables) {
        const result = await pool.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1`, [table]);
        console.log(`\n--- Indexes for ${table} ---`);
        console.log(JSON.stringify(result.rows, null, 2));
    }
    await pool.end();
}
checkIndexes();
