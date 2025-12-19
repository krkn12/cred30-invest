
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Serviço responsável por gerar backups dos dados críticos do sistema
 */
export const backupDatabase = async (pool: Pool): Promise<{ success: boolean; filePath?: string; error?: string }> => {
    try {
        console.log('📦 Iniciando backup de dados críticos...');

        // Tabelas para backup
        const tables = ['users', 'quotas', 'loans', 'transactions', 'system_config', 'admin_logs'];
        const backupData: Record<string, any[]> = {};

        for (const table of tables) {
            const result = await pool.query(`SELECT * FROM ${table}`);
            backupData[table] = result.rows;
        }

        // Criar diretório de backup se não existir
        const backupDir = path.join(process.cwd(), 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Nome do arquivo com timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `backup-${timestamp}.json`;
        const filePath = path.join(backupDir, fileName);

        // Salvar JSON
        fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

        console.log(`✅ Backup concluído com sucesso: ${filePath}`);

        // Opcional: Limpar backups antigos (manter apenas os últimos 7)
        const files = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('backup-'))
            .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);

        if (files.length > 7) {
            files.slice(7).forEach(f => {
                fs.unlinkSync(path.join(backupDir, f.name));
                console.log(`🗑️ Backup antigo removido: ${f.name}`);
            });
        }

        return { success: true, filePath };
    } catch (error) {
        console.error('❌ Erro ao realizar backup:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
};
