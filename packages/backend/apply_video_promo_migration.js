// Script para aplicar migration de vídeos promocionais
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyVideoPromotionMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log('📺 Aplicando migration de vídeos promocionais (Cred Views)...\n');

        // Ler o arquivo SQL
        const migrationPath = path.join(__dirname, 'src/infrastructure/database/postgresql/migrations/011_video_promotion.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');

        // Executar migration
        await pool.query(sql);

        console.log('✅ Tabela promo_videos criada!');
        console.log('✅ Tabela promo_video_views criada!');
        console.log('✅ Índices criados!');

        // Verificar estrutura
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'promo_videos'
            ORDER BY ordinal_position
        `);

        console.log('\n📋 Estrutura da tabela promo_videos:');
        console.log('─'.repeat(50));
        result.rows.forEach(col => {
            console.log(`  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(15)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });

        console.log('\n🎉 Sistema Cred Views pronto!');
        console.log('\n📌 Endpoints disponíveis:');
        console.log('   GET  /api/promo-videos/feed         - Feed de vídeos para assistir');
        console.log('   POST /api/promo-videos/create       - Criar campanha de vídeo');
        console.log('   POST /api/promo-videos/:id/start-view   - Iniciar visualização');
        console.log('   POST /api/promo-videos/:id/complete-view - Completar e receber');
        console.log('   GET  /api/promo-videos/my-campaigns - Listar minhas campanhas');
        console.log('   GET  /api/promo-videos/my-earnings  - Histórico de ganhos');

    } catch (error) {
        if (error.code === '42P07') {
            console.log('ℹ️  Tabelas já existem, pulando...');
        } else {
            console.error('❌ Erro ao aplicar migration:', error.message);
        }
    } finally {
        await pool.end();
    }
}

applyVideoPromotionMigration();
