
import cron from 'node-cron';
import { Pool } from 'pg';
import { distributeProfits } from './application/services/profit-distribution.service';
import { backupDatabase } from './application/services/backup.service';

/**
 * Inicializa os agendadores de tarefas (Cron Jobs)
 */
export const initializeScheduler = (pool: Pool) => {
    console.log('Inicializando agendador de tarefas...');

    // 1. Distribuir lucros diariamente às 00:00 (Meia-noite)
    cron.schedule('0 0 * * *', async () => {
        console.log('🕒 [CRON] Iniciando distribuição diária de lucros...');
        try {
            const result = await distributeProfits(pool);
            if (result.success) {
                console.log('✅ [CRON] Distribuição de lucros realizada com sucesso:', result);
            } else {
                console.log('ℹ️ [CRON] Distribuição de lucros finalizada (sem ação):', result.message);
            }
        } catch (error) {
            console.error('❌ [CRON] Erro fatal na distribuição de lucros:', error);
        }
    });

    // 2. Realizar Backup de dados diariamente às 01:00 (Madrugada)
    cron.schedule('0 1 * * *', async () => {
        console.log('🕒 [CRON] Iniciando backup automático dos dados...');
        try {
            const result = await backupDatabase(pool);
            if (result.success) {
                console.log(`✅ [CRON] Backup realizado: ${result.filePath}`);
            }
        } catch (error) {
            console.error('❌ [CRON] Erro fatal no backup automático:', error);
        }
    });

    console.log('✅ Agendador de tarefas inicializado: Distribuição (00:00) e Backup (01:00) configurados.');
};
