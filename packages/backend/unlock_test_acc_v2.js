const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_ItsW94lidRHU@ep-fragrant-bird-adl8rnm6.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function unlockAccount() {
    try {
        console.log('Liberando conta milene@gmail.com...');
        // Ajustado para usar 'created_at' em vez de 'joined_at', e 'security_lock_until' para limpar o bloqueio
        const result = await pool.query(`
      UPDATE users 
      SET 
        created_at = NOW() - INTERVAL '30 days', 
        security_lock_until = NULL,
        is_under_duress = false 
      WHERE email = 'milene@gmail.com'
    `);
        console.log('Conta liberada/atualizada com sucesso!', result.rowCount, 'linhas afetadas.');
    } catch (err) {
        console.error('Erro ao liberar conta:', err);
    } finally {
        await pool.end();
    }
}

unlockAccount();
