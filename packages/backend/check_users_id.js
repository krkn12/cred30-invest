// Check users table id type
const { Pool } = require('pg');
require('dotenv').config();

async function check() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const result = await pool.query(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'id'
    `);

    console.log('Users ID column:', result.rows);

    await pool.end();
}

check();
