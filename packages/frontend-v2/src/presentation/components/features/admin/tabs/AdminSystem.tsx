import React, { useState, useEffect } from 'react';
import { TrendingUp, Coins, Activity, ArrowUpRight, ArrowDownLeft, Trash2, Check, Settings as SettingsIcon, AlertTriangle } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';
import { AppState } from '../../../../../domain/types/common.types';
import { updateProfitPool } from '../../../../../application/services/storage.service';

interface AdminSystemProps {
    state: AppState;
    onRefresh: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const AdminSystem: React.FC<AdminSystemProps> = ({ state, onRefresh, onSuccess, onError }) => {
    const [systemCosts, setSystemCosts] = useState<any[]>([]);
    const [newCostDescription, setNewCostDescription] = useState('');
    const [newCostAmount, setNewCostAmount] = useState('');
    const [financeHistory, setFinanceHistory] = useState<any[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [newProfit, setNewProfit] = useState('');

    useEffect(() => {
        fetchSystemCosts();
        fetchFinanceHistory();
    }, []);

    const fetchSystemCosts = async () => {
        try {
            const res = await apiService.get<any>('/admin/costs');
            if (res.success) {
                setSystemCosts(res.data || []);
            }
        } catch (e) {
            console.error('Erro ao buscar custos:', e);
        }
    };

    const fetchFinanceHistory = async () => {
        setIsHistoryLoading(true);
        try {
            const res = await apiService.get<any>('/admin/finance-history');
            if (res.success) {
                setFinanceHistory(res.data || []);
            }
        } catch (e) {
            console.error('Erro ao buscar histórico financeiro:', e);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const handleAddCost = async () => {
        if (!newCostDescription || !newCostAmount) return;
        try {
            const res = await apiService.post<any>('/admin/costs', {
                description: newCostDescription,
                amount: parseFloat(newCostAmount)
            });
            if (res.success) {
                onSuccess('Sucesso', 'Custo adicionado!');
                setNewCostDescription('');
                setNewCostAmount('');
                fetchSystemCosts();
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handlePayCost = async (id: number, desc: string) => {
        if (!window.confirm(`Deseja marcar '${desc}' como pago e deduzir do saldo do sistema?`)) return;
        try {
            const res = await apiService.post<any>(`/admin/costs/${id}/pay`, {});
            if (res.success) {
                onSuccess('Pago', 'Custo deduzido do saldo do sistema.');
                fetchSystemCosts();
                fetchFinanceHistory();
                onRefresh();
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleDeleteCost = async (id: number) => {
        if (!window.confirm('Excluir este custo?')) return;
        try {
            await apiService.delete(`/admin/costs/${id}`);
            onSuccess('Sucesso', 'Custo removido.');
            fetchSystemCosts();
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleUpdateProfit = async () => {
        if (!newProfit) return;
        try {
            const amount = parseFloat(newProfit);
            const res = await updateProfitPool(amount);
            if (res.success) {
                onSuccess('Sucesso', 'Fundo de recompensas atualizado!');
                setNewProfit('');
                fetchFinanceHistory();
                onRefresh();
            } else {
                onError('Erro', res.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleRunLiquidation = async () => {
        if (!window.confirm('Iniciar varredura de garantias agora? O sistema executará o lastro de todos os apoios em atraso há mais de 5 dias.')) return;
        try {
            const res = await apiService.post<any>('/admin/run-liquidation', {});
            if (res.success) {
                onSuccess('Varredura Concluída', res.message);
                onRefresh();
            } else {
                onError('Erro na Liquidação', res.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const formatCurrency = (val: number | string) => {
        const numVal = typeof val === 'string' ? parseFloat(val) : val;
        if (typeof numVal !== 'number' || isNaN(numVal)) return 'R$ 0,00';
        return numVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Gestão de Custos Fixos */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                        <div className="p-2 bg-primary-500/10 rounded-lg"><TrendingUp className="text-primary-400" size={20} /></div>
                        Custos Fixos Mensais
                    </h3>
                    <div className="space-y-6">
                        <div className="bg-black/20 p-6 rounded-2xl border border-zinc-800">
                            <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Total de Despesas/Mês</p>
                            <p className="text-4xl font-black text-red-400 tracking-tighter">
                                -{formatCurrency(state.stats?.systemConfig?.monthly_fixed_costs || 0)}
                            </p>
                        </div>

                        <div className="space-y-3">
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Adicionar Nova Despesa</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Descrição (ex: MEI)"
                                    value={newCostDescription}
                                    onChange={(e) => setNewCostDescription(e.target.value)}
                                    className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary-500/50"
                                />
                                <input
                                    type="text"
                                    placeholder="Valor"
                                    value={newCostAmount}
                                    onChange={(e) => setNewCostAmount(e.target.value)}
                                    className="w-24 bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary-500/50"
                                />
                                <button
                                    onClick={handleAddCost}
                                    className="bg-primary-500 hover:bg-primary-400 p-3 rounded-xl text-black transition-all"
                                >
                                    <Check size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                            {systemCosts.map((cost) => (
                                <div key={cost.id} className="group bg-black/40 border border-zinc-800/50 p-4 rounded-2xl flex justify-between items-center transition-all hover:border-zinc-700">
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-zinc-300">{cost.description}</p>
                                        <p className="text-sm font-black text-white">{formatCurrency(parseFloat(cost.amount))}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handlePayCost(cost.id, cost.description)}
                                            className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all"
                                        >
                                            PAGAR
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCost(cost.id)}
                                            className="p-2 text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {systemCosts.length === 0 && (
                                <p className="text-center py-4 text-xs text-zinc-600 font-bold uppercase">Nenhum custo fixo lançado.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Fundo de Recompensas */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg"><Coins className="text-emerald-400" size={20} /></div>
                        Fundo de Recompensas
                    </h3>
                    <div className="space-y-6">
                        <div className="bg-black/20 p-6 rounded-2xl border border-zinc-800">
                            <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Acumulado p/ Distribuição</p>
                            <p className="text-4xl font-black text-white tracking-tighter">{formatCurrency(state.profitPool)}</p>
                        </div>
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Valor a adicionar (R$)"
                                value={newProfit}
                                onChange={(e) => setNewProfit(e.target.value)}
                                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-emerald-500/50 font-bold"
                            />
                            <button
                                onClick={handleUpdateProfit}
                                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-2xl transition-all shadow-xl"
                            >
                                Lançar Excedente
                            </button>
                        </div>
                    </div>
                </div>

                {/* Extrato Financeiro Administrativo */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl col-span-1 md:col-span-2">
                    <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                        <div className="p-2 bg-primary-500/10 rounded-lg"><Activity className="text-primary-400" size={20} /></div>
                        Extrato de Movimentações Administrativas
                    </h3>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-3 custom-scrollbar">
                        {isHistoryLoading && <div className="text-center py-10 text-zinc-500 text-xs font-bold uppercase animate-pulse">Carregando extrato...</div>}

                        {financeHistory.map((log) => (
                            <div key={log.id} className="bg-black/30 border border-zinc-800/50 p-4 rounded-2xl flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl ${log.action === 'PAY_COST' ? 'bg-red-500/10 text-red-400' :
                                        log.action === 'MANUAL_PROFIT_ADD' ? 'bg-emerald-500/10 text-emerald-400' :
                                            'bg-zinc-800 text-zinc-400'
                                        }`}>
                                        {log.action === 'PAY_COST' ? <ArrowUpRight size={18} /> :
                                            log.action === 'MANUAL_PROFIT_ADD' ? <ArrowDownLeft size={18} /> :
                                                <SettingsIcon size={18} />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-white uppercase tracking-tight">
                                            {log.action === 'PAY_COST' ? 'PAGAMENTO REALIZADO' :
                                                log.action === 'MANUAL_PROFIT_ADD' ? 'EXCEDENTE ADICIONADO' :
                                                    log.action.replace('_', ' ')}
                                        </p>
                                        <p className="text-[10px] text-zinc-500 font-bold uppercase">{new Date(log.created_at).toLocaleString('pt-BR')}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-sm font-black ${log.action === 'PAY_COST' ? 'text-red-400' :
                                        log.action === 'MANUAL_PROFIT_ADD' ? 'text-emerald-400' :
                                            'text-white'
                                        }`}>
                                        {log.action === 'PAY_COST' ? '-' : '+'}{formatCurrency(log.new_values?.amount || log.new_values?.amountToAdd || log.new_values?.addedAmount || 0)}
                                    </p>
                                    <p className="text-[9px] text-zinc-600 font-bold uppercase">POR: {log.admin_name}</p>
                                </div>
                            </div>
                        ))}

                        {!isHistoryLoading && financeHistory.length === 0 && (
                            <div className="py-20 text-center opacity-30">
                                <Activity size={48} className="mx-auto mb-4" />
                                <p className="text-xs font-bold uppercase">Nenhuma movimentação registrada</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Varredura de Inadimplência */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl col-span-1 md:col-span-2">
                    <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg"><AlertTriangle className="text-red-400" size={20} /></div>
                        Varredura de Atraso de Reposição
                    </h3>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <p className="text-sm text-zinc-400 leading-relaxed max-w-xl">
                            Clique abaixo para executar manualmente a proteção de lastro. Membros com atraso superior a 5 dias terão suas licenças executadas para cobrir o compromisso social.
                        </p>
                        <button
                            onClick={handleRunLiquidation}
                            className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-black border border-red-500/30 font-black px-8 py-5 rounded-2xl transition-all uppercase tracking-widest text-xs whitespace-nowrap"
                        >
                            Iniciar Varredura de Garantias
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
