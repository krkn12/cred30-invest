import React, { useState, useEffect } from 'react';
import packageJson from '../../../../package.json';
import {
    ShieldCheck, RefreshCw, LogOut, Users, PieChart, DollarSign, PiggyBank, Coins, ArrowUpFromLine, ArrowDownLeft, TrendingUp, Clock, ArrowUpRight, Check, X as XIcon, AlertTriangle, Settings as SettingsIcon, ShoppingBag as ShoppingBagIcon, UserPlus, Trash2, MessageSquare
} from 'lucide-react';
import { ConfirmModal } from '../ui/ConfirmModal';
import { PromptModal } from '../ui/PromptModal';
import { AppState } from '../../../domain/types/common.types';
import {
    getPendingItems, updateProfitPool, clearAllCache, processAdminAction, distributeMonthlyDividends, fixLoanPix
} from '../../../application/services/storage.service';
import { apiService } from '../../../application/services/api.service';
import { AdminStoreManager } from '../features/store/admin-store.component';
import { SupportAdminView } from './SupportAdminView';

interface AdminViewProps {
    state: AppState;
    onRefresh: () => void;
    onLogout: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

const MetricCard = ({ title, value, subtitle, icon: Icon, color }: any) => {
    const colorClasses: any = {
        blue: "from-blue-600 to-blue-700 border-blue-500/30 shadow-blue-500/10",
        cyan: "from-primary-600 to-primary-700 border-primary-500/30 shadow-primary-500/10",
        emerald: "from-emerald-600 to-emerald-700 border-emerald-500/30 shadow-emerald-500/10",
        yellow: "from-amber-600 to-amber-700 border-amber-500/30 shadow-amber-500/10",
        red: "from-red-600 to-red-700 border-red-500/30 shadow-red-500/10",
        orange: "from-orange-600 to-orange-700 border-orange-500/30 shadow-orange-500/10",
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-2xl p-6 text-white border shadow-lg transition-transform hover:scale-[1.02] duration-300`}>
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon size={20} className="text-white" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">{title}</span>
            </div>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            <p className="text-[10px] opacity-70 mt-1 font-medium uppercase">{subtitle}</p>
        </div>
    );
};

export const AdminView = ({ state, onRefresh, onLogout, onSuccess, onError }: AdminViewProps) => {
    const [pending, setPending] = useState<{ transactions: any[], loans: any[] }>({ transactions: [], loans: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [confirmMP, setConfirmMP] = useState<{ id: string, tid: string } | null>(null);
    const [showFixPix, setShowFixPix] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'approvals' | 'system' | 'store' | 'referrals' | 'support'>('overview');
    const [pendingChatsCount, setPendingChatsCount] = useState(0);
    const [referralCodes, setReferralCodes] = useState<any[]>([]);
    const [newReferralCode, setNewReferralCode] = useState('');
    const [referralMaxUses, setReferralMaxUses] = useState('');

    useEffect(() => {
        const fetchPending = async () => {
            try {
                const result = await getPendingItems();
                setPending(result);
            } catch (error) {
                console.error('Erro ao carregar itens pendentes:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPending();
        fetchPendingChatsCount();
        const interval = setInterval(fetchPendingChatsCount, 15000); // Poll a cada 15s

        if (activeTab === 'referrals') {
            fetchReferralCodes();
        }

        return () => clearInterval(interval);
    }, [state, activeTab]);

    const fetchPendingChatsCount = async () => {
        try {
            const data = await apiService.getPendingSupportChats();
            setPendingChatsCount(data.chats?.filter((c: any) => c.status === 'PENDING_HUMAN').length || 0);
        } catch (e) {
            console.error('Erro ao contar chats pendentes:', e);
        }
    };

    const fetchReferralCodes = async () => {
        try {
            const response = await apiService.get<any[]>('/admin/referral-codes');
            if (response.success) {
                setReferralCodes(response.data || []);
            }
        } catch (error) {
            console.error('Erro ao buscar códigos:', error);
        }
    };

    const handleCreateReferralCode = async () => {
        if (!newReferralCode) return;
        try {
            const response = await apiService.post('/admin/referral-codes', {
                code: newReferralCode,
                maxUses: referralMaxUses ? parseInt(referralMaxUses) : null
            });
            if (response.success) {
                onSuccess('Sucesso', 'Código criado!');
                setNewReferralCode('');
                setReferralMaxUses('');
                fetchReferralCodes();
            } else {
                onError('Erro', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleToggleReferralCode = async (id: number) => {
        try {
            const response = await apiService.post(`/admin/referral-codes/${id}/toggle`, {});
            if (response.success) {
                fetchReferralCodes();
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleDeleteReferralCode = async (id: number) => {
        if (!window.confirm('Excluir este código definitivamente?')) return;
        try {
            const response = await apiService.delete(`/admin/referral-codes/${id}`);
            if (response.success) {
                onSuccess('Removido', 'Código excluído com sucesso');
                fetchReferralCodes();
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const [newProfit, setNewProfit] = useState('');
    const [newManualCost, setNewManualCost] = useState('');
    const [manualCostDescription, setManualCostDescription] = useState('');
    const [showDistributeModal, setShowDistributeModal] = useState(false);

    const parseCurrencyInput = (val: string) => {
        const clean = val.replace(/[^0-9,.]/g, '');
        const standard = clean.replace(',', '.');
        return parseFloat(standard);
    }

    const handleUpdateProfit = async () => {
        try {
            const val = parseCurrencyInput(newProfit);
            if (isNaN(val)) throw new Error("Valor inválido");
            await updateProfitPool(val);
            clearAllCache();
            onRefresh();
            setNewProfit('');
            onSuccess('Excedente Adicionado', `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} adicionado com sucesso!`);
        } catch (e: any) {
            onError('Erro ao Atualizar Lucro', e.message);
        }
    };

    const handleUpdateManualCost = async () => {
        try {
            const val = parseCurrencyInput(newManualCost);
            if (isNaN(val) || val <= 0) throw new Error("Valor inválido");
            const response = await apiService.post('/admin/manual-cost', {
                amount: val,
                description: manualCostDescription || 'Custo manual'
            });
            if (response.success) {
                clearAllCache();
                onRefresh();
                setNewManualCost('');
                setManualCostDescription('');
                onSuccess('Custo Registrado', `Custo de R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} registrado.`);
            } else {
                onError('Erro', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleAction = async (id: string, type: 'TRANSACTION' | 'LOAN', action: 'APPROVE' | 'REJECT') => {
        try {
            await processAdminAction(id, type, action);
            clearAllCache();
            await new Promise(resolve => setTimeout(resolve, 500));
            await onRefresh();
            if (action === 'APPROVE') {
                onSuccess('Solicitação Aprovada', 'Ação concluída com sucesso!');
            }
        } catch (e: any) {
            onError('Erro na Ação', e.message);
        }
    };

    const handleSimulateMpPayment = async (paymentId: string, transactionId: string) => {
        setConfirmMP({ id: paymentId, tid: transactionId });
    };

    const confirmSimulateMpPayment = async () => {
        if (!confirmMP) return;
        const { id: paymentId, tid: transactionId } = confirmMP;
        try {
            const response = await apiService.post('/admin/simulate-mp-payment', { paymentId, transactionId });
            if (response.success) {
                onSuccess('Simulação Sucesso', 'Pagamento aprovado no Sandbox.');
                await onRefresh();
            } else {
                onError('Erro na Simulação', response.message);
            }
        } catch (error: any) {
            onError('Erro ao Simular', error.message);
        }
    };

    const handleRejectPayment = async (transactionId: string) => {
        try {
            const result = await apiService.rejectPayment(transactionId);
            if (result && result.success) {
                clearAllCache();
                onRefresh();
                onSuccess('Pagamento Rejeitado', 'Pagamento rejeitado com sucesso!');
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleApprovePayment = async (transactionId: string) => {
        try {
            const result = await apiService.approvePayment(transactionId);
            if (result && result.success) {
                clearAllCache();
                onRefresh();
                onSuccess('Pagamento Aprovado', 'Pagamento aprovado com sucesso!');
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleApproveWithdrawal = async (transactionId: string) => {
        try {
            const result = await apiService.approveWithdrawal(transactionId);
            if (result && result.success) {
                clearAllCache();
                onRefresh();
                onSuccess('Saque Aprovado', 'Saque aprovado com sucesso!');
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleRejectWithdrawal = async (transactionId: string) => {
        try {
            const result = await apiService.rejectWithdrawal(transactionId);
            if (result && result.success) {
                clearAllCache();
                onRefresh();
                onSuccess('Saque Rejeitado', 'Saque rejeitado com sucesso!');
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const formatCurrency = (val: number) => {
        if (typeof val !== 'number' || isNaN(val)) return 'R$ 0,00';
        return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Header Modernizado */}
            <div className="bg-gradient-to-br from-zinc-900 to-black rounded-3xl p-8 border border-zinc-800 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

                <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-primary-500/10 rounded-3xl flex items-center justify-center border border-primary-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)] group-hover:scale-105 transition-transform duration-500">
                            <ShieldCheck size={40} className="text-primary-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold text-white tracking-tight">Painel de Controle</h1>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="flex h-2.5 w-2.5 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                </span>
                                <p className="text-xs text-zinc-400 font-bold uppercase tracking-[0.2em]">Servidor Ativo • v{packageJson.version}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <button
                            onClick={() => { clearAllCache(); onRefresh(); onSuccess("Atualizado", "Dados sincronizados."); }}
                            className="group bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-primary-500/50 px-6 py-3.5 rounded-2xl flex items-center gap-3 transition-all duration-300 text-sm font-bold text-zinc-300 shadow-lg"
                        >
                            <RefreshCw size={18} className={isLoading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />
                            {isLoading ? "Sincronizando" : "Atualizar Sistema"}
                        </button>
                        <button
                            onClick={onLogout}
                            className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 px-6 py-3.5 rounded-2xl flex items-center gap-3 transition-all duration-300 text-sm font-bold text-red-500 shadow-lg"
                        >
                            <LogOut size={18} /> Sair
                        </button>
                    </div>
                </div>
            </div>

            {/* Navegação por Abas - Estilo iOS/Moderno */}
            <div className="flex items-center gap-1.5 p-1.5 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-[2rem] overflow-x-auto no-scrollbar shadow-xl sticky top-4 z-50">
                {[
                    { id: 'overview', name: 'Resumo', icon: PieChart },
                    { id: 'approvals', name: 'Fila de Aprovação', icon: Clock, count: (pending.transactions?.length || 0) + (pending.loans?.length || 0) },
                    { id: 'system', name: 'Gestão Financeira', icon: SettingsIcon },
                    { id: 'referrals', name: 'Indicações', icon: UserPlus },
                    { id: 'store', name: 'Loja', icon: ShoppingBagIcon },
                    { id: 'support', name: 'Suporte', icon: MessageSquare, count: pendingChatsCount },
                ].map((tab: any) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`
                            relative flex items-center gap-3 px-8 py-4 rounded-[1.5rem] text-sm font-bold transition-all duration-500 whitespace-nowrap
                            ${activeTab === tab.id
                                ? 'bg-zinc-800 text-white shadow-2xl border border-zinc-700/50 scale-[1.02]'
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}
                        `}
                    >
                        <tab.icon size={20} className={activeTab === tab.id ? "text-primary-400" : ""} />
                        {tab.name}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className="flex h-5 w-5 items-center justify-center bg-primary-500 text-zinc-900 text-[10px] font-black rounded-full shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <MetricCard title="Membros" value={state.users.length} subtitle="Usuários Totais" icon={Users} color="blue" />
                        <MetricCard title="Participações" value={state.stats?.quotasCount ?? 0} subtitle="Cotas em Operação" icon={PieChart} color="cyan" />
                        <MetricCard title="Liquidez" value={formatCurrency(state.systemBalance)} subtitle="Caixa Disponível" icon={DollarSign} color="emerald" />
                        <MetricCard title="Dividendos" value={formatCurrency(state.profitPool)} subtitle="Excedentes Acumulados" icon={PiggyBank} color="yellow" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Termômetro de Liquidez */}
                        <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                    <div className="p-2 bg-primary-500/10 rounded-lg"><TrendingUp className="text-primary-400" size={20} /></div>
                                    Monitor de Liquidez
                                </h3>
                                {(() => {
                                    const activeQuotasVal = (state.stats?.quotasCount || 0) * 50;
                                    const reserveNeeded = activeQuotasVal * 0.3;
                                    const currentCash = state.systemBalance;
                                    let status = currentCash < reserveNeeded * 0.5 ? "Crítico" : currentCash < reserveNeeded ? "Alerta" : "Saudável";
                                    let color = status === "Crítico" ? "text-red-400 bg-red-400/10 border-red-400/30" : status === "Alerta" ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" : "text-emerald-400 bg-emerald-400/10 border-emerald-400/30";
                                    return <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${color}`}>{status}</span>;
                                })()}
                            </div>

                            <div className="space-y-6">
                                <div className="relative h-4 bg-zinc-800/80 rounded-full overflow-hidden border border-zinc-700/50">
                                    <div className="absolute top-0 left-[30%] h-full w-[2px] bg-white/20 z-10" title="Reserva 30% shadow-[0_0_10px_white]"></div>
                                    <div className="h-full bg-gradient-to-r from-primary-600 to-emerald-400 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all duration-1000"
                                        style={{ width: `${Math.min((state.systemBalance / ((state.stats?.quotasCount || 1) * 50)) * 100, 100)}%` }}></div>
                                </div>
                                <div className="grid grid-cols-2 gap-6 pt-4">
                                    <div className="bg-black/20 p-5 rounded-2xl border border-zinc-800">
                                        <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Disponível</p>
                                        <p className="text-2xl font-bold text-white tracking-tight">{formatCurrency(state.systemBalance)}</p>
                                    </div>
                                    <div className="bg-black/20 p-5 rounded-2xl border border-zinc-800">
                                        <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Reserva (30%)</p>
                                        <p className="text-2xl font-bold text-primary-400/80 tracking-tight">{formatCurrency((state.stats?.quotasCount || 0) * 50 * 0.3)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Projeção de Lucros */}
                        <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                            <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                                <div className="p-2 bg-orange-500/10 rounded-lg"><PieChart className="text-orange-400" size={20} /></div>
                                Recebíveis de Curto Prazo
                            </h3>
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Total a Receber</p>
                                        <p className="text-2xl font-bold text-white tracking-tight">{formatCurrency(state.stats?.totalToReceive || 0)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Lucro Previsto</p>
                                        <p className="text-2xl font-bold text-orange-400 tracking-tight">{formatCurrency((state.stats?.totalToReceive || 0) - (state.stats?.totalLoaned || 0))}</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-orange-500/5 rounded-2xl border border-orange-500/10">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-zinc-400 font-bold uppercase">Repasse (85%)</span>
                                        <span className="text-lg font-black text-white">{formatCurrency(((state.stats?.totalToReceive || 0) - (state.stats?.totalLoaned || 0)) * 0.85)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'approvals' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Transações Pendentes */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                    <div className="p-2 bg-primary-500/10 rounded-lg"><ArrowUpRight className="text-primary-400" size={20} /></div>
                                    Movimentações Financeiras
                                </h3>
                                <span className="bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full text-[10px] font-black uppercase">Fila de Espera: {pending.transactions.length}</span>
                            </div>

                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-3 custom-scrollbar">
                                {pending.transactions.length === 0 ? (
                                    <div className="py-12 text-center text-zinc-500 font-medium">Nenhuma transação pendente no momento.</div>
                                ) : (
                                    pending.transactions.map((t) => (
                                        <div key={t.id} className="bg-black/30 border border-zinc-800/50 rounded-2xl p-6 transition-all hover:border-zinc-700 hover:bg-black/40 group">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="space-y-3 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${t.type === 'BUY_QUOTA' ? 'bg-primary-500/10 text-primary-400' : t.type === 'WITHDRAWAL' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                            {t.type}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-500 font-bold">{new Date(t.date).toLocaleString()}</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white mb-0.5">{t.user_name}</p>
                                                        <p className="text-[11px] text-zinc-500">{t.user_email}</p>
                                                    </div>
                                                    <p className="text-2xl font-black text-white">{formatCurrency(t.amount)}</p>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <button onClick={() => handleAction(t.id, 'TRANSACTION', 'APPROVE')} className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-black transition-all">
                                                        <Check size={20} />
                                                    </button>
                                                    <button onClick={() => handleAction(t.id, 'TRANSACTION', 'REJECT')} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-black transition-all">
                                                        <XIcon size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Empréstimos Pendentes */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                    <div className="p-2 bg-orange-500/10 rounded-lg"><Coins className="text-orange-400" size={20} /></div>
                                    Solicitações de Apoio Mútuo
                                </h3>
                                <span className="bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full text-[10px] font-black uppercase">Pendentes: {pending.loans.length}</span>
                            </div>

                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-3 custom-scrollbar">
                                {pending.loans.length === 0 ? (
                                    <div className="py-12 text-center text-zinc-500 font-medium">Nenhuma solicitação de empréstimo.</div>
                                ) : (
                                    pending.loans.map((l) => (
                                        <div key={l.id} className="bg-black/30 border border-zinc-800/50 rounded-2xl p-6 transition-all hover:border-zinc-700 hover:bg-black/40">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="space-y-3 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider bg-orange-500/10 text-orange-400">APOIO MÚTUO</span>
                                                        <span className="text-[10px] text-zinc-500 font-bold">{new Date(l.date).toLocaleString()}</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white mb-0.5">{l.user_name}</p>
                                                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Score: {l.user_score}</p>
                                                    </div>
                                                    <div className="flex items-end gap-3">
                                                        <p className="text-2xl font-black text-white">{formatCurrency(l.amount)}</p>
                                                        <span className="text-emerald-500 text-[10px] font-bold pb-1.5">Juros: {formatCurrency(l.total_repayment - l.amount)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <button onClick={() => handleAction(l.id, 'LOAN', 'APPROVE')} className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-black transition-all">
                                                        <Check size={20} />
                                                    </button>
                                                    <button onClick={() => handleAction(l.id, 'LOAN', 'REJECT')} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-black transition-all">
                                                        <XIcon size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'system' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <MetricCard
                            title="Reserva p/ Impostos"
                            value={formatCurrency(state.stats?.totalTaxReserve || 0)}
                            subtitle="6% de todo lucro"
                            icon={ShieldCheck}
                            color="blue"
                        />
                        <MetricCard
                            title="Custos (Servidor/APIs)"
                            value={formatCurrency(state.stats?.totalOperationalReserve || 0)}
                            subtitle="4% de todo lucro"
                            icon={SettingsIcon}
                            color="orange"
                        />
                        <MetricCard
                            title="Meu Salário (Pró-labore)"
                            value={formatCurrency(state.stats?.totalOwnerProfit || 0)}
                            subtitle="5% de todo lucro"
                            icon={DollarSign}
                            color="emerald"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Gestão de Lucros */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                            <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 rounded-lg"><Coins className="text-emerald-400" size={20} /></div>
                                Injetar Excedentes no Sistema
                            </h3>
                            <div className="space-y-6">
                                <div className="bg-black/20 p-6 rounded-2xl border border-zinc-800 relative group overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                                        <TrendingUp size={60} />
                                    </div>
                                    <p className="text-[10px] text-zinc-500 font-black uppercase mb-1 underline decoration-primary-500/50 underline-offset-4">Pote de Dividendos</p>
                                    <p className="text-4xl font-black text-white tracking-tighter">{formatCurrency(state.profitPool)}</p>
                                    <p className="text-[11px] text-zinc-400 mt-4 leading-relaxed font-medium">
                                        Este valor será distribuído automaticamente entre as cotas ativas à meia-noite (00:00).
                                    </p>
                                </div>
                                <div className="space-y-4 pt-4">
                                    <div className="relative">
                                        <label className="text-[10px] text-zinc-500 font-black uppercase mb-2 block tracking-widest">Valor do Lucro a Adicionar (R$)</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: 1.250,50"
                                            value={newProfit}
                                            onChange={(e) => setNewProfit(e.target.value)}
                                            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-emerald-500/50 focus:bg-zinc-800 transition-all text-xl font-bold shadow-inner"
                                        />
                                    </div>
                                    <button
                                        onClick={handleUpdateProfit}
                                        className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-black py-4 rounded-2xl transition-all shadow-xl hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transform active:scale-95 flex items-center justify-center gap-3 text-sm uppercase"
                                    >
                                        <Check size={20} /> Confirmar Lançamento
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Lançamento de Custos */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                            <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                                <div className="p-2 bg-red-500/10 rounded-lg"><ArrowDownLeft className="text-red-400" size={20} /></div>
                                Registro de Despesas Manuais
                            </h3>
                            <div className="space-y-6">
                                <div className="bg-black/20 p-6 rounded-2xl border border-zinc-800">
                                    <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Total de Despesas Lançadas</p>
                                    <p className="text-4xl font-black text-red-500 tracking-tighter">{formatCurrency(state.stats?.totalManualCosts || 0)}</p>
                                </div>
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        placeholder="Valor da Despesa (R$)"
                                        value={newManualCost}
                                        onChange={(e) => setNewManualCost(e.target.value)}
                                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-red-500/50 focus:bg-zinc-800 transition-all font-bold shadow-inner"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Motivo / Descrição"
                                        value={manualCostDescription}
                                        onChange={(e) => setManualCostDescription(e.target.value)}
                                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-red-500/50 focus:bg-zinc-800 transition-all text-sm font-medium shadow-inner"
                                    />
                                    <button
                                        onClick={handleUpdateManualCost}
                                        className="w-full bg-zinc-800 hover:bg-red-950 border border-red-900/30 hover:border-red-500/50 text-red-500 font-black py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 text-sm uppercase"
                                    >
                                        <AlertTriangle size={20} /> Lançar Despesa
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'referrals' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Criar Código */}
                        <div className="lg:col-span-1 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl h-fit">
                            <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                                <div className="p-2 bg-primary-500/10 rounded-lg"><UserPlus className="text-primary-400" size={20} /></div>
                                Novo Código
                            </h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] text-zinc-500 font-black uppercase mb-2 block tracking-widest">Código (Ex: VIP2024)</label>
                                    <input
                                        type="text"
                                        placeholder="CÓDIGO"
                                        value={newReferralCode}
                                        onChange={(e) => setNewReferralCode(e.target.value.toUpperCase())}
                                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 focus:bg-zinc-800 transition-all font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 font-black uppercase mb-2 block tracking-widest">Limite de Usos (Opcional)</label>
                                    <input
                                        type="number"
                                        placeholder="Ilimitado se vazio"
                                        value={referralMaxUses}
                                        onChange={(e) => setReferralMaxUses(e.target.value)}
                                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 focus:bg-zinc-800 transition-all font-bold"
                                    />
                                </div>
                                <button
                                    onClick={handleCreateReferralCode}
                                    className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 text-sm uppercase"
                                >
                                    <Check size={20} /> Criar Código
                                </button>
                            </div>
                        </div>

                        {/* Lista de Códigos */}
                        <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                            <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                                <div className="p-2 bg-zinc-800 rounded-lg"><Users className="text-zinc-400" size={20} /></div>
                                Códigos Ativos
                            </h3>
                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-3 custom-scrollbar">
                                {referralCodes.length === 0 ? (
                                    <div className="py-12 text-center text-zinc-500 font-medium">Nenhum código administrativo criado.</div>
                                ) : (
                                    referralCodes.map((rc) => (
                                        <div key={rc.id} className={`bg-black/30 border ${rc.is_active ? 'border-zinc-800/50' : 'border-red-900/20 opacity-60'} rounded-2xl p-6 transition-all hover:bg-black/40`}>
                                            <div className="flex justify-between items-center">
                                                <div className="space-y-1">
                                                    <p className="text-2xl font-black text-white tracking-widest">{rc.code}</p>
                                                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                                        <span>Criado por: {rc.creator_name}</span>
                                                        <span>•</span>
                                                        <span className={rc.current_uses >= (rc.max_uses || Infinity) ? 'text-red-400' : 'text-primary-400'}>
                                                            Usos: {rc.current_uses} / {rc.max_uses || '∞'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleToggleReferralCode(rc.id)}
                                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${rc.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500 hover:text-black' : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-white hover:text-black'}`}
                                                    >
                                                        {rc.is_active ? 'Ativo' : 'Inativo'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteReferralCode(rc.id)}
                                                        className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-black transition-all"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'store' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <AdminStoreManager onSuccess={onSuccess} onError={onError} />
                </div>
            )}

            {activeTab === 'support' && <SupportAdminView />}

            {/* Modais de Suporte */}
            {confirmMP && (
                <ConfirmModal
                    isOpen={true}
                    title="Simular Pagamento"
                    message="Deseja simular a aprovação deste pagamento no ambiente de testes (Sandbox)?"
                    onConfirm={confirmSimulateMpPayment}
                    onClose={() => setConfirmMP(null)}
                />
            )}
        </div>
    );
};
