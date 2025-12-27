require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkIndexes() {
    const result = await pool.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'transactions'");
    console.log(JSON.stringify(result.rows, null, 2));
    await pool.end();
}
checkIndexes();
