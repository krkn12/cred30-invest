
import cron from 'node-cron';
import { Pool } from 'pg';
import { distributeProfits } from './application/services/profit-distribution.service';
import { backupDatabase } from './application/services/backup.service';
import { runAutoLiquidation } from './application/services/auto-liquidation.service';
import { decreaseDailyScore } from './application/services/score.service';
import { processDisbursementQueue } from './application/services/disbursement-queue.service';

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

    // 3. Liquidação Automática de inadimplentes às 02:00 (Madrugada)
    cron.schedule('0 2 * * *', async () => {
        console.log('🕒 [CRON] Iniciando varredura de liquidação automática...');
        try {
            const result = await runAutoLiquidation(pool);
            if (result.liquidatedCount > 0) {
                console.log(`✅ [CRON] Liquidação finalizada: ${result.liquidatedCount} empréstimos processados.`);
            }
        } catch (error) {
            console.error('❌ [CRON] Erro fatal na liquidação automática:', error);
        }
    });

    // 4. Decaimento Diário de Score às 03:00 (Madrugada)
    // Reduz 10 pontos de todos para forçar engajamento
    cron.schedule('0 3 * * *', async () => {
        console.log('🕒 [CRON] Iniciando decaimento diário de score...');
        try {
            const result = await decreaseDailyScore(pool);
            if (result.success) {
                console.log(`✅ [CRON] Decaimento de score aplicado a ${result.affectedUsers} usuários.`);
            }
        } catch (error) {
            console.error('❌ [CRON] Erro fatal no decaimento de score:', error);
        }
    });

    // 5. Processar Fila de Desembolso Diariamente às 00:05
    // Garante que o sistema prioriza membros VIP acumulando a liquidez do dia
    cron.schedule('5 0 * * *', async () => {
        try {
            await processDisbursementQueue(pool);
        } catch (error) {
            console.error('❌ [CRON] Erro na fila de desembolso:', error);
        }
    });

    console.log('✅ Agendador inicializado: Distrib (00:00), Fila (00:05), Backup (01:00), Liq (02:00), Score (03:00).');
};
