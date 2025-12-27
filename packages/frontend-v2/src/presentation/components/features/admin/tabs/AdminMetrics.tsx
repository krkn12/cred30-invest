import React, { useState, useEffect } from 'react';
import { Activity, Cpu, Database, Search, Clock, HardDrive } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';
import { useDebounce } from '../../../../hooks/use-performance';

export const AdminMetrics: React.FC = () => {
    const [healthMetrics, setHealthMetrics] = useState<any>(null);
    const [isMetricsLoading, setIsMetricsLoading] = useState(false);
    const [metricsSearch, setMetricsSearch] = useState('');
    const debouncedMetricsSearch = useDebounce(metricsSearch, 300);

    useEffect(() => {
        fetchHealthMetrics();
        const metricsInterval = setInterval(fetchHealthMetrics, 10000);
        return () => clearInterval(metricsInterval);
    }, []);

    const fetchHealthMetrics = async () => {
        if (!healthMetrics) setIsMetricsLoading(true);
        try {
            const data = await apiService.getHealthMetrics();
            if (data) setHealthMetrics(data);
        } catch (e) {
            console.error('Erro ao buscar métricas:', e);
        } finally {
            setIsMetricsLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {!healthMetrics && isMetricsLoading ? (
                <div className="py-20 text-center">
                    <div className="w-16 h-16 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Coletando dados do servidor...</p>
                </div>
            ) : healthMetrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Status do Servidor */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                            <div className="p-2 bg-primary-500/10 rounded-lg"><Cpu className="text-primary-400" size={20} /></div>
                            Recursos do Sistema
                        </h3>
                        <div className="space-y-4 mb-6">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={16} />
                                <input
                                    type="text"
                                    placeholder="Filtrar métricas..."
                                    value={metricsSearch}
                                    onChange={(e) => setMetricsSearch(e.target.value)}
                                    className="w-full bg-black/40 border border-zinc-800 rounded-2xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none focus:border-primary-500/50 transition-all"
                                />
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div className="flex justify-between items-center p-4 bg-black/20 rounded-2xl border border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <Activity size={18} className="text-emerald-400" />
                                    <span className="text-sm font-bold text-zinc-300">Latência do Banco</span>
                                </div>
                                <span className="text-xl font-black text-white">{healthMetrics.health.dbLatency}</span>
                            </div>
                            <div className="flex justify-between items-center p-4 bg-black/20 rounded-2xl border border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <Clock size={18} className="text-primary-400" />
                                    <span className="text-sm font-bold text-zinc-300">Uptime do Servidor</span>
                                </div>
                                <span className="text-xl font-black text-white">{healthMetrics.health.uptime}</span>
                            </div>
                            <div className="p-6 bg-black/20 rounded-2xl border border-zinc-800">
                                <div className="flex items-center gap-3 mb-4">
                                    <HardDrive size={18} className="text-orange-400" />
                                    <span className="text-sm font-bold text-zinc-300">Uso de Memória RAM</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Heap Usado</p>
                                        <p className="text-lg font-bold text-white">{healthMetrics.health.memory.heapUsed}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Total RSS</p>
                                        <p className="text-lg font-bold text-white">{healthMetrics.health.memory.rss}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Carga de Dados */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg"><Database className="text-emerald-400" size={20} /></div>
                            Volume de Dados
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-black/20 rounded-2xl border border-zinc-800">
                                <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Transações</p>
                                <p className="text-xl font-bold text-white">{healthMetrics.database.total_transactions}</p>
                            </div>
                            <div className="p-4 bg-black/20 rounded-2xl border border-zinc-800">
                                <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Audit Logs</p>
                                <p className="text-xl font-bold text-white">{healthMetrics.database.total_audit_logs}</p>
                            </div>
                            <div className="p-4 bg-black/20 rounded-2xl border border-zinc-800">
                                <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Tabela: Users</p>
                                <p className="text-xl font-bold text-white">{healthMetrics.database.tables.users}</p>
                            </div>
                            <div className="p-4 bg-black/20 rounded-2xl border border-zinc-800">
                                <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Tabela: Quotas</p>
                                <p className="text-xl font-bold text-white">{healthMetrics.database.tables.quotas}</p>
                            </div>
                        </div>
                        <div className="mt-8 p-6 bg-primary-500/5 rounded-2xl border border-primary-500/10">
                            <div className="flex items-center gap-3 mb-4">
                                <Activity size={18} className="text-primary-400" />
                                <span className="text-sm font-bold text-zinc-300">Atividade Recente (24h)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl">
                                    <span className="text-[10px] text-zinc-500 font-black uppercase">Novos Usuários</span>
                                    <span className="text-lg font-black text-white">+{healthMetrics.activity.new_users_24h}</span>
                                </div>
                                <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl">
                                    <span className="text-[10px] text-zinc-500 font-black uppercase">Logs Registrados</span>
                                    <span className="text-lg font-black text-white">+{healthMetrics.activity.audit_logs_24h}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
