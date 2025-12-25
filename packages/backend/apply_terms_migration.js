// Script para aplicar migration de aceite de termos
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyTermsAcceptanceMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log('🔐 Aplicando migration de aceite de termos (blindagem jurídica)...\n');

        // Ler o arquivo SQL
        const migrationPath = path.join(__dirname, 'src/infrastructure/database/postgresql/migrations/010_terms_acceptance.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');

        // Executar migration
        await pool.query(sql);

        console.log('✅ Tabela terms_acceptance criada com sucesso!');
        console.log('✅ Índices criados!');

        // Verificar estrutura
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'terms_acceptance'
            ORDER BY ordinal_position
        `);

        console.log('\n📋 Estrutura da tabela terms_acceptance:');
        console.log('─'.repeat(50));
        result.rows.forEach(col => {
            console.log(`  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(15)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });

        console.log('\n🎉 Migration aplicada com sucesso!');
        console.log('\n📌 Endpoints disponíveis:');
        console.log('   POST /api/auth/accept-terms  - Registrar aceite de termos');
        console.log('   GET  /api/auth/terms-status  - Verificar status de aceite');

    } catch (error) {
        if (error.code === '42P07') {
            console.log('ℹ️  Tabela terms_acceptance já existe, pulando...');
        } else {
            console.error('❌ Erro ao aplicar migration:', error.message);
        }
    } finally {
        await pool.end();
    }
}

applyTermsAcceptanceMigration();
