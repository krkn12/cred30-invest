import React, { useState, useEffect } from 'react';
import packageJson from '../../../../package.json';
import {
    ShieldCheck, RefreshCw, LogOut, Users, PieChart, DollarSign, PiggyBank, Coins, ArrowUpFromLine, ArrowDownLeft, TrendingUp, Clock, ArrowUpRight, Check, X as XIcon, AlertTriangle, Settings as SettingsIcon, ShoppingBag as ShoppingBagIcon, UserPlus, Trash2, MessageSquare, ExternalLink, Send, Clipboard, Gift, Activity, Cpu, Database, HardDrive, Zap, Search
} from 'lucide-react';
import { ConfirmModal } from '../ui/ConfirmModal';
import { PromptModal } from '../ui/PromptModal';
import { AppState } from '../../../domain/types/common.types';
import {
    updateProfitPool, clearAllCache, distributeMonthlyDividends
} from '../../../application/services/storage.service';
import { apiService } from '../../../application/services/api.service';
import { AdminStoreManager } from '../features/store/admin-store.component';
import { SupportAdminView } from './SupportAdminView';
import { AdminUserManagement } from '../features/admin/AdminUserManagement';

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
            <p className="text-[10px] opacity-90 mt-1 font-medium uppercase">{subtitle}</p>
        </div>
    );
};

export const AdminView = ({ state, onRefresh, onLogout, onSuccess, onError }: AdminViewProps) => {

    const [isLoading, setIsLoading] = useState(true);
    const [confirmMP, setConfirmMP] = useState<{ id: string, tid: string } | null>(null);

    const userRole = state.currentUser?.role || (state.currentUser?.isAdmin ? 'ADMIN' : 'MEMBER');
    const [activeTab, setActiveTab] = useState<'overview' | 'payouts' | 'system' | 'store' | 'referrals' | 'support' | 'users' | 'metrics'>(
        userRole === 'ATTENDANT' ? 'support' : 'overview'
    );
    const [payoutQueue, setPayoutQueue] = useState<{ transactions: any[], loans: any[] }>({ transactions: [], loans: [] });
    const [pendingChatsCount, setPendingChatsCount] = useState(0);
    const [referralCodes, setReferralCodes] = useState<any[]>([]);
    const [newReferralCode, setNewReferralCode] = useState('');
    const [referralMaxUses, setReferralMaxUses] = useState('');
    const [giftEmail, setGiftEmail] = useState('');
    const [giftQuantity, setGiftQuantity] = useState('');
    const [giftReason, setGiftReason] = useState('');
    const [healthMetrics, setHealthMetrics] = useState<any>(null);
    const [isMetricsLoading, setIsMetricsLoading] = useState(false);
    const [metricsSearch, setMetricsSearch] = useState('');

    const [systemCosts, setSystemCosts] = useState<any[]>([]);
    const [newCostDescription, setNewCostDescription] = useState('');
    const [newCostAmount, setNewCostAmount] = useState('');

    useEffect(() => {
        setIsLoading(false);
        fetchPendingChatsCount();
        const interval = setInterval(fetchPendingChatsCount, 15000);
        return () => clearInterval(interval);
    }, []); // Só no mount

    useEffect(() => {
        if (activeTab === 'payouts') {
            fetchPayoutQueue();
        }

        if (activeTab === 'referrals') {
            fetchReferralCodes();
        }

        if (activeTab === 'metrics') {
            fetchHealthMetrics();
            const metricsInterval = setInterval(fetchHealthMetrics, 10000);
            return () => clearInterval(metricsInterval);
        }
        if (activeTab === 'system') {
            fetchSystemCosts();
        }
    }, [activeTab]); // Só quando a aba muda

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

    const fetchPayoutQueue = async () => {
        try {
            const data = await apiService.getPayoutQueue();
            setPayoutQueue(data || { transactions: [], loans: [] });
        } catch (e) {
            console.error('Erro ao buscar fila de pagamentos:', e);
        }
    };

    const handleConfirmPayout = async (id: any, type: 'TRANSACTION' | 'LOAN') => {
        try {
            await apiService.confirmPayout(id.toString(), type);
            onSuccess('Sucesso', 'Pagamento registrado com sucesso!');
            fetchPayoutQueue();
        } catch (e) {
            onError('Erro', 'Falha ao confirmar pagamento.');
        }
    };

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
            const response = await apiService.post<any>('/admin/referral-codes', {
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
            const response = await apiService.post<any>(`/admin/referral-codes/${id}/toggle`, {});
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
            const response = await apiService.delete<any>(`/admin/referral-codes/${id}`);
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

    const handleAddCost = async () => {
        try {
            const amount = parseCurrencyInput(newCostAmount);
            if (isNaN(amount) || amount <= 0) throw new Error("Valor inválido");
            if (!newCostDescription) throw new Error("Descrição necessária");

            const response = await apiService.post<any>('/admin/costs', {
                description: newCostDescription,
                amount: amount,
                isRecurring: true
            });

            if (response.success) {
                onSuccess('Custo Adicionado', 'Despesa registrada com sucesso.');
                setNewCostAmount('');
                setNewCostDescription('');
                fetchSystemCosts();
                onRefresh();
            } else {
                onError('Erro', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleDeleteCost = async (id: number) => {
        if (!window.confirm('Remover este custo do sistema?')) return;
        try {
            const response = await apiService.delete<any>(`/admin/costs/${id}`);
            if (response.success) {
                onSuccess('Removido', 'Custo excluído.');
                fetchSystemCosts();
                onRefresh();
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const confirmSimulateMpPayment = async () => {
        if (!confirmMP) return;
        const { id: paymentId, tid: transactionId } = confirmMP;
        try {
            const response = await apiService.post<any>('/admin/simulate-mp-payment', { paymentId, transactionId });
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

    const handleGiftQuota = async () => {
        if (!giftEmail || !giftQuantity) return;
        if (!window.confirm(`CONFIRMAÇÃO: Enviar ${giftQuantity} cotas para ${giftEmail}? Esta ação criará as cotas e não cobrará do usuário.`)) return;

        try {
            const response = await apiService.post<any>('/admin/users/add-quota', {
                email: giftEmail,
                quantity: parseInt(giftQuantity),
                reason: giftReason
            });
            if (response.success) {
                onSuccess('Envio Realizado!', response.message);
                setGiftEmail('');
                setGiftQuantity('');
                setGiftReason('');
            } else {
                onError('Erro', response.message);
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

            {/* Abas */}
            <div className="flex items-center gap-1.5 p-1.5 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-[2rem] overflow-x-auto no-scrollbar shadow-xl sticky top-4 z-50">
                {[
                    { id: 'overview', name: 'Resumo', icon: PieChart, roles: ['ADMIN'] },
                    { id: 'payouts', name: 'Resgates', icon: Send, count: (payoutQueue.transactions?.length || 0), roles: ['ADMIN'] },
                    { id: 'metrics', name: 'Monitoramento', icon: Activity, roles: ['ADMIN', 'ATTENDANT'] },
                    { id: 'system', name: 'Financeiro', icon: SettingsIcon, roles: ['ADMIN'] },
                    { id: 'referrals', name: 'Indicações', icon: UserPlus, roles: ['ADMIN'] },
                    { id: 'users', name: 'Usuários', icon: ShieldCheck, roles: ['ADMIN'] },
                    { id: 'store', name: 'Loja', icon: ShoppingBagIcon, roles: ['ADMIN'] },
                    { id: 'support', name: 'Suporte', icon: MessageSquare, count: pendingChatsCount, roles: ['ADMIN', 'ATTENDANT'] },
                ].filter((tab: any) => {
                    const userRole = state.currentUser?.role || (state.currentUser?.isAdmin ? 'ADMIN' : 'MEMBER');
                    return tab.roles.includes(userRole as any);
                }).map((tab: any) => (
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
                        <MetricCard title="Participações" value={state.stats?.quotasCount ?? 0} subtitle="Licenças em Operação" icon={PieChart} color="cyan" />
                        <MetricCard title="Custo Fixo Mensal" value={formatCurrency(state.stats?.systemConfig?.monthly_fixed_costs || 0)} subtitle="Despesas Recorrentes" icon={TrendingUp} color="orange" />
                        <MetricCard title="Liquidez Real" value={formatCurrency(state.stats?.systemConfig?.real_liquidity ?? state.systemBalance)} subtitle="Disponível p/ Saque/Apoio" icon={DollarSign} color="emerald" />
                    </div>
                </div>
            )}

            {activeTab === 'metrics' && (
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
                                    <div className="p-4 bg-black/20 rounded-2xl border border-zinc-800 col-span-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Atividade 24h</p>
                                                <p className="text-xl font-bold text-white">+{healthMetrics.activity.trans_24h} Transações</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Volume 24h</p>
                                                <p className="text-xl font-bold text-emerald-400">{formatCurrency(parseFloat(healthMetrics.activity.volume_24h))}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 col-span-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Zap size={18} className="text-emerald-400" />
                                                <span className="text-sm font-bold text-zinc-300">Novos Membros 24h</span>
                                            </div>
                                            <span className="text-lg font-black text-white">+{healthMetrics.activity.new_users_24h}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'payouts' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/10 rounded-lg"><ArrowUpRight className="text-emerald-400" size={20} /></div>
                                    Fila de Resgates (PIX)
                                </h3>
                                <span className="bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full text-[10px] font-black uppercase">Pendentes: {payoutQueue.transactions?.length || 0}</span>
                            </div>

                            <div className="space-y-4 max-h-[700px] overflow-y-auto pr-3 custom-scrollbar">
                                {!payoutQueue.transactions || payoutQueue.transactions.length === 0 ? (
                                    <div className="py-24 text-center">
                                        <div className="bg-zinc-800/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Check className="text-zinc-500" size={32} />
                                        </div>
                                        <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Tudo em dia!</p>
                                    </div>
                                ) : (
                                    payoutQueue.transactions.map((t) => (
                                        <div key={t.id} className="bg-black/30 border border-zinc-800/50 rounded-2xl p-6 transition-all hover:border-zinc-700 hover:bg-black/40 group">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="space-y-3 flex-1">
                                                    <div>
                                                        <p className="text-sm font-bold text-white mb-0.5">{t.user_name}</p>
                                                        <div className="flex items-center gap-2 bg-zinc-800/50 p-2 rounded-lg" onClick={() => {
                                                            navigator.clipboard.writeText(t.user_pix);
                                                            onSuccess('Copiado', 'Chave PIX copiada!');
                                                        }}>
                                                            <p className="text-[11px] text-primary-400 font-mono break-all">{t.user_pix}</p>
                                                            <Clipboard size={12} className="text-zinc-500" />
                                                        </div>
                                                    </div>
                                                    <p className="text-2xl font-black text-white">{formatCurrency(t.amount)}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleConfirmPayout(t.id, 'TRANSACTION')}
                                                    className="p-4 bg-primary-500/10 text-primary-400 rounded-2xl hover:bg-primary-500 hover:text-black transition-all flex flex-col items-center justify-center gap-2 min-w-[120px]"
                                                >
                                                    <Check size={20} />
                                                    <span className="text-[10px] font-black uppercase">Confirmar</span>
                                                </button>
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
                                            <div>
                                                <p className="text-xs font-bold text-zinc-300">{cost.description}</p>
                                                <p className="text-sm font-black text-white">{formatCurrency(parseFloat(cost.amount))}</p>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteCost(cost.id)}
                                                className="p-2 text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
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

                        {/* Varredura de Inadimplência */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl col-span-1 md:col-span-2">
                            <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                                <div className="p-2 bg-red-500/10 rounded-lg"><AlertTriangle className="text-red-400" size={20} /></div>
                                Varredura de Inadimplência
                            </h3>
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                <p className="text-sm text-zinc-400 leading-relaxed max-w-xl">
                                    Clique abaixo para executar manualmente a proteção de lastro. Usuários com atraso superior a 5 dias terão suas licenças executadas para cobrir a dívida.
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
            )}

            {activeTab === 'referrals' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                            <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                                <div className="p-2 bg-primary-500/10 rounded-lg"><UserPlus className="text-primary-400" size={20} /></div>
                                Criar Novo Código
                            </h3>
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    placeholder="CÓDIGO (EX: VIP2024)"
                                    value={newReferralCode}
                                    onChange={(e) => setNewReferralCode(e.target.value.toUpperCase())}
                                    className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 font-bold"
                                />
                                <input
                                    type="number"
                                    placeholder="Máximo de Usos (vazio = ilimitado)"
                                    value={referralMaxUses}
                                    onChange={(e) => setReferralMaxUses(e.target.value)}
                                    className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 font-bold"
                                />
                                <button
                                    onClick={handleCreateReferralCode}
                                    className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-2xl transition-all shadow-xl"
                                >
                                    Gerar Código VIP
                                </button>
                            </div>
                        </div>

                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                            <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                                <div className="p-2 bg-zinc-800 rounded-lg"><Users className="text-zinc-400" size={20} /></div>
                                Códigos Administrativos
                            </h3>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {referralCodes.map((rc) => (
                                    <div key={rc.id} className="bg-black/20 border border-zinc-800 px-4 py-3 rounded-xl flex justify-between items-center">
                                        <div>
                                            <p className="font-black text-white tracking-widest leading-none">{rc.code}</p>
                                            <p className="text-[10px] text-zinc-500 font-bold mt-1 uppercase">Usos: {rc.current_uses} / {rc.max_uses || '∞'}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleDeleteReferralCode(rc.id)} className="p-2 text-zinc-500 hover:text-red-500 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="space-y-8">
                    <AdminUserManagement onSuccess={onSuccess} onError={onError} />

                    {/* Gift Quota remains available as a smaller section if needed, 
                        but AdminUserManagement is now the main control center */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl max-w-2xl mx-auto opacity-50 hover:opacity-100 transition-opacity">
                        <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-lg"><Gift className="text-purple-400" size={20} /></div>
                            Presentear Cotas (Ação Direta)
                        </h3>
                        <div className="space-y-4">
                            <input
                                type="email"
                                placeholder="Email do usuário"
                                value={giftEmail}
                                onChange={(e) => setGiftEmail(e.target.value)}
                                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-purple-500/50 font-bold"
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="number"
                                    placeholder="Quantidade"
                                    value={giftQuantity}
                                    onChange={(e) => setGiftQuantity(e.target.value)}
                                    className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-purple-500/50 font-bold"
                                />
                                <button
                                    onClick={handleGiftQuota}
                                    className="bg-purple-500 hover:bg-purple-400 text-black font-black px-6 py-4 rounded-2xl transition-all shadow-xl"
                                >
                                    Enviar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'store' && <AdminStoreManager onSuccess={onSuccess} onError={onError} />}
            {activeTab === 'support' && <SupportAdminView />}

            {confirmMP && (
                <ConfirmModal
                    isOpen={true}
                    title="Simular Pagamento"
                    message="Deseja aprovar este pagamento no Sandbox?"
                    onConfirm={confirmSimulateMpPayment}
                    onClose={() => setConfirmMP(null)}
                />
            )}
        </div>
    );
};
