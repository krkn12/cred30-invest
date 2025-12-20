import React, { useState, useEffect } from 'react';
import {
    ShieldCheck, RefreshCw, LogOut, Users, PieChart, DollarSign, PiggyBank, Coins, ArrowUpFromLine, ArrowDownLeft, TrendingUp, Clock, ArrowUpRight, Check, X as XIcon, AlertTriangle
} from 'lucide-react';
import { ConfirmModal } from '../ui/ConfirmModal';
import { PromptModal } from '../ui/PromptModal';
import { AppState } from '../../../domain/types/common.types';
import {
    getPendingItems, updateProfitPool, clearAllCache, processAdminAction, distributeMonthlyDividends, fixLoanPix
} from '../../../application/services/storage.service';
import { apiService } from '../../../application/services/api.service';
import { AdminStoreManager } from '../features/store/admin-store.component';

interface AdminViewProps {
    state: AppState;
    onRefresh: () => void;
    onLogout: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const AdminView = ({ state, onRefresh, onLogout, onSuccess, onError }: AdminViewProps) => {
    const [pending, setPending] = useState<{ transactions: any[], loans: any[] }>({ transactions: [], loans: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [confirmMP, setConfirmMP] = useState<{ id: string, tid: string } | null>(null);
    const [showFixPix, setShowFixPix] = useState<string | null>(null);

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
    }, [state]);

    const [newBalance, setNewBalance] = useState('');
    const [newProfit, setNewProfit] = useState('');
    const [newManualCost, setNewManualCost] = useState('');
    const [manualCostDescription, setManualCostDescription] = useState('');
    const [showDistributeModal, setShowDistributeModal] = useState(false);

    const parseCurrencyInput = (val: string) => {
        // Remove all non-numeric chars except dot and comma
        const clean = val.replace(/[^0-9,.]/g, '');
        // Replace comma with dot
        const standard = clean.replace(',', '.');
        return parseFloat(standard);
    }

    // handleUpdateBalance removido - caixa operacional agora é calculado automaticamente

    const handleUpdateProfit = async () => {
        try {
            const val = parseCurrencyInput(newProfit);
            if (isNaN(val)) throw new Error("Valor inválido");

            const result = await updateProfitPool(val);
            clearAllCache();
            onRefresh();
            setNewProfit('');

            // Mensagem atualizada para refletir a distribuição automática
            onSuccess(
                'Lucro Adicionado',
                `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} adicionado com sucesso! O valor foi acumulado e será distribuído automaticamente à meia-noite (00:00).`
            );
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
                onSuccess(
                    'Custo Registrado',
                    `Custo de R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} registrado com sucesso e deduzido do caixa operacional.`
                );
            } else {
                onError('Erro', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleAction = async (id: string, type: 'TRANSACTION' | 'LOAN', action: 'APPROVE' | 'REJECT') => {
        try {
            console.log('DEBUG - Ação administrativa:', { id, type, action });

            await processAdminAction(id, type, action);

            // Limpar cache após ação administrativa para forçar atualização
            clearAllCache();

            // Aguardar um pouco para garantir que o backend processou
            await new Promise(resolve => setTimeout(resolve, 500));

            // Forçar atualização completa do estado
            console.log('DEBUG - Forçando atualização do estado após ação administrativa');
            await onRefresh();

            // Se for aprovação de empréstimo, mostrar mensagem específica
            if (type === 'LOAN' && action === 'APPROVE') {
                onSuccess('Empréstimo Aprovado', 'Empréstimo aprovado com sucesso! O valor foi creditado no saldo do cliente.');
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
                onSuccess('Simulação Sucesso', 'Sucesso! O pagamento foi aprovado no Sandbox e a transação foi processada.');
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
            // Verificar se está autenticado
            if (!apiService.isAuthenticated()) {
                onError('Sessão Expirada', 'Por favor, faça login novamente.');
                onLogout();
                return;
            }

            // Chamar a API de rejeição de pagamento usando apiService
            const result = await apiService.rejectPayment(transactionId);

            console.log('DEBUG - Resposta da API de rejeição:', result);

            if (result && result.success) {
                clearAllCache();
                onRefresh();
                const data = result.data || {};
                const amountRefunded = data.amountRefunded || 0;
                onSuccess(
                    'Pagamento Rejeitado',
                    `Pagamento rejeitado com sucesso! Empréstimo reativado para novo pagamento.${amountRefunded > 0 ? ` Saldo de R$ ${amountRefunded.toFixed(2)} reembolsado.` : ''}`
                );
            }
        } catch (e: any) {
            console.error('Erro ao rejeitar pagamento:', e);
            // Verificar se é um erro de autenticação
            if (e.message && e.message.includes('401')) {
                onError('Sessão Expirada', 'Por favor, faça login novamente.');
                onLogout();
            } else {
                onError('Erro', e.message || "Erro ao rejeitar pagamento.");
            }
        }
    };

    const handleApprovePayment = async (transactionId: string): Promise<void> => {
        try {
            // Verificar se está autenticado
            if (!apiService.isAuthenticated()) {
                onError('Sessão Expirada', 'Por favor, faça login novamente.');
                onLogout();
                return;
            }

            // Chamar a API de aprovação de pagamento usando apiService
            const result = await apiService.approvePayment(transactionId);

            console.log('DEBUG - Resposta da API de aprovação:', result);

            if (result && result.success) {
                const data = result.data || {};
                const principalValue = typeof data.principalReturned === 'number' ? data.principalReturned : 0;
                const profitValue = typeof data.interestForProfit === 'number' ? data.interestForProfit : 0;
                const operationalValue = typeof data.interestForOperational === 'number' ? data.interestForOperational : 0;

                clearAllCache();
                onRefresh();
                onSuccess(
                    'Pagamento Aprovado',
                    `Pagamento aprovado com sucesso! Principal devolvido: R$ ${principalValue.toFixed(2)}, Juros (85% para lucro: R$ ${profitValue.toFixed(2)}, 15% para caixa: R$ ${operationalValue.toFixed(2)})`
                );
            }
        } catch (e: any) {
            console.error('Erro ao aprovar pagamento:', e);
            // Verificar se é um erro de autenticação
            if (e.message && e.message.includes('401')) {
                onError('Sessão Expirada', 'Por favor, faça login novamente.');
                onLogout();
            } else {
                onError('Erro', e.message || "Erro ao aprovar pagamento.");
            }
        }
    };

    const handleApproveWithdrawal = async (transactionId: string) => {
        try {
            // Verificar se está autenticado
            if (!apiService.isAuthenticated()) {
                onError('Sessão Expirada', 'Por favor, faça login novamente.');
                onLogout();
                return;
            }

            // Chamar a API de aprovação de saque usando apiService
            const result = await apiService.approveWithdrawal(transactionId);

            console.log('DEBUG - Resposta da API de aprovação de saque:', result);

            if (result && result.success) {
                const data = result.data || {};
                clearAllCache();
                onRefresh();
                onSuccess(
                    'Saque Aprovado',
                    `Saque aprovado com sucesso! Valor líquido: R$ ${(data.netAmount || 0).toFixed(2)}, Taxa: R$ ${(data.feeAmount || 0).toFixed(2)} adicionada ao lucro de juros.`
                );
            }
        } catch (e: any) {
            console.error('Erro ao aprovar saque:', e);
            if (e.message && e.message.includes('401')) {
                onError('Sessão Expirada', 'Por favor, faça login novamente.');
                onLogout();
            } else {
                onError('Erro', e.message || "Erro ao aprovar saque.");
            }
        }
    };

    const handleRejectWithdrawal = async (transactionId: string) => {
        try {
            // Verificar se está autenticado
            if (!apiService.isAuthenticated()) {
                onError('Sessão Expirada', 'Por favor, faça login novamente.');
                onLogout();
                return;
            }

            // Chamar a API de rejeição de saque usando apiService
            const result = await apiService.rejectWithdrawal(transactionId);

            console.log('DEBUG - Resposta da API de rejeição de saque:', result);

            if (result && result.success) {
                clearAllCache();
                onRefresh();
                const data = result.data || {};
                const amountRefunded = data.amountRefunded || 0;
                onSuccess(
                    'Saque Rejeitado',
                    `Saque rejeitado com sucesso! Valor de R$ ${amountRefunded.toFixed(2)} reembolsado na conta do cliente.`
                );
            }
        } catch (e: any) {
            console.error('Erro ao rejeitar saque:', e);
            if (e.message && e.message.includes('401')) {
                onError('Sessão Expirada', 'Por favor, faça login novamente.');
                onLogout();
            } else {
                onError('Erro', e.message || "Erro ao rejeitar saque.");
            }
        }
    };

    const confirmDistribution = async () => {
        try {
            await distributeMonthlyDividends();
            clearAllCache();
            onRefresh();
            setShowDistributeModal(false);
            onSuccess("Sucesso", "Distribuição de lucros realizada com sucesso!");
        } catch (e: any) {
            onError("Erro na Distribuição", e.message);
        }
    };

    const handleFixPix = (loanId: string) => {
        setShowFixPix(loanId);
    };

    const onConfirmFixPix = async (newPix: string) => {
        if (!showFixPix || !newPix) return;
        try {
            await fixLoanPix(showFixPix, newPix);
            clearAllCache();
            onRefresh();
            onSuccess("Sucesso", "Chave PIX atualizada com sucesso!");
        } catch (e: any) {
            onError("Erro", `Erro ao atualizar PIX: ${e.message}`);
        }
    };

    const formatCurrency = (val: number) => {
        if (typeof val !== 'number' || isNaN(val)) {
            return 'R$ 0,00';
        }
        return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // Calculations for Preview
    const profit = state.profitPool;

    return (
        <div className="space-y-8">
            {/* Header with Admin Info */}
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl p-6 text-black">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                            <ShieldCheck size={32} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Painel Administrativo</h1>
                            <p className="text-sm opacity-80">Gerenciamento do Sistema Cred30</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                clearAllCache();
                                onRefresh();
                                onSuccess("Cache Limpo", "Cache limpo com sucesso! Dados atualizados.");
                            }}
                            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-2 transition"
                            title="Limpar cache e atualizar dados"
                        >
                            <RefreshCw size={18} /> Limpar Cache
                        </button>
                        <button onClick={onLogout} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-2 transition">
                            <LogOut size={18} /> Sair
                        </button>
                    </div>
                </div>
            </div>

            {/* Key Metrics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white border border-blue-500/30 shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <Users size={24} className="text-white" />
                        </div>
                        <span className="text-sm font-medium opacity-90">Total Usuários</span>
                    </div>
                    <p className="text-3xl font-bold">{state.users.length}</p>
                    <p className="text-xs opacity-75 mt-1">Cadastrados no sistema</p>
                </div>

                <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-6 text-white border border-primary-500/30 shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <PieChart size={24} className="text-white" />
                        </div>
                        <span className="text-sm font-medium opacity-90">Cotas Ativas</span>
                    </div>
                    <p className="text-3xl font-bold">{state.stats?.quotasCount ?? 0}</p>
                    <p className="text-xs opacity-75 mt-1">Status: ACTIVE</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white border border-emerald-500/30 shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <DollarSign size={24} className="text-white" />
                        </div>
                        <span className="text-sm font-medium opacity-90">Caixa Operacional</span>
                    </div>
                    <p className="text-3xl font-bold">{formatCurrency(state.systemBalance)}</p>
                    <p className="text-xs opacity-75 mt-1">Disponível para operações</p>
                </div>

                <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-2xl p-6 text-white border border-yellow-500/30 shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <PiggyBank size={24} className="text-white" />
                        </div>
                        <span className="text-sm font-medium opacity-90">Lucro Acumulado</span>
                    </div>
                    <p className="text-3xl font-bold">{formatCurrency(state.profitPool)}</p>
                    <p className="text-xs opacity-75 mt-1">85% para distribuição</p>
                </div>

                <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-6 text-white border border-red-500/30 shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <ShieldCheck size={24} className="text-white" />
                        </div>
                        <span className="text-sm font-medium opacity-90">Custo Gateway</span>
                    </div>
                    <p className="text-3xl font-bold">{formatCurrency(state.stats?.totalGatewayCosts ?? 0)}</p>
                    <p className="text-xs opacity-75 mt-1">Taxas pagas ao Mercado Pago</p>
                </div>

                <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl p-6 text-white border border-orange-500/30 shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <Coins size={24} className="text-white" />
                        </div>
                        <span className="text-sm font-medium opacity-90">Custos Manuais</span>
                    </div>
                    <p className="text-3xl font-bold">{formatCurrency(state.stats?.totalManualCosts ?? 0)}</p>
                    <p className="text-xs opacity-75 mt-1">Lançados manualmente</p>
                </div>
            </div>

            {/* Health Metrics and Projections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Liquidity Thermometer */}
                <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <TrendingUp className="text-primary-400" size={20} />
                            Saúde da Liquidez
                        </h3>
                        {(() => {
                            const activeQuotasVal = (state.stats?.quotasCount || 0) * 50;
                            const reserveNeeded = activeQuotasVal * 0.3;
                            const currentCash = state.systemBalance;

                            let status = "Saudável";
                            let color = "text-emerald-400";
                            let bgColor = "bg-emerald-500/10";
                            if (currentCash < reserveNeeded) { status = "Risco Baixo"; color = "text-yellow-400"; bgColor = "bg-yellow-500/10"; }
                            if (currentCash < reserveNeeded * 0.5) { status = "CRÍTICO"; color = "text-red-400"; bgColor = "bg-red-500/10"; }

                            return (
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${bgColor} ${color} border border-current opacity-80`}>
                                    {status}
                                </span>
                            );
                        })()}
                    </div>

                    {(() => {
                        const activeQuotasVal = (state.stats?.quotasCount || 0) * 50;
                        const reserveNeeded = activeQuotasVal * 0.3;
                        const currentCash = state.systemBalance;
                        const percentage = activeQuotasVal > 0 ? Math.min((currentCash / activeQuotasVal) * 100, 100) : 100;
                        const reservePercentage = 30;

                        return (
                            <div className="space-y-4">
                                <div className="relative h-6 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                                    <div className="absolute top-0 left-[30%] h-full w-0.5 bg-yellow-400 z-10 opacity-50" title="Reserva Mínima (30%)"></div>
                                    <div
                                        className={`h-full transition-all duration-1000 ${percentage >= reservePercentage ? 'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-gradient-to-r from-red-600 to-red-400'}`}
                                        style={{ width: `${percentage}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-xs text-zinc-500 font-medium px-1">
                                    <span>Vazio</span>
                                    <span>Reserva (30%)</span>
                                    <span>Cheio</span>
                                </div>
                                <div className="bg-background/50 p-4 rounded-xl border border-surfaceHighlight grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Disponível Agora</p>
                                        <p className="text-lg font-bold text-white">{formatCurrency(currentCash)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Reserva Mínima</p>
                                        <p className="text-lg font-bold text-yellow-400/80">{formatCurrency(reserveNeeded)}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Profit Projections */}
                <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <PieChart className="text-orange-400" size={20} />
                        Projeção de Recebíveis (30 dias)
                    </h3>
                    {(() => {
                        const toReceive = state.stats?.totalToReceive || 0;
                        const totalDebt = state.stats?.totalLoaned || 0;
                        const estimatedInterest = toReceive - totalDebt;
                        const userShare = estimatedInterest * 0.85;

                        return (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-background/50 p-4 rounded-xl border border-surfaceHighlight">
                                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Receita Futura</p>
                                        <p className="text-xl font-bold text-white">{formatCurrency(toReceive)}</p>
                                        <p className="text-[10px] text-emerald-500 mt-1">↑ Incluindo Juros</p>
                                    </div>
                                    <div className="bg-background/50 p-4 rounded-xl border border-surfaceHighlight">
                                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Lucro Estimado</p>
                                        <p className="text-xl font-bold text-orange-400">{formatCurrency(estimatedInterest)}</p>
                                        <p className="text-[10px] text-zinc-500 mt-1">Estimativa bruta</p>
                                    </div>
                                </div>
                                <div className="bg-orange-500/5 border border-orange-500/10 p-4 rounded-xl">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-zinc-400">Repasse p/ Cotistas (85%)</span>
                                        <span className="text-sm font-bold text-white">{formatCurrency(userShare)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-zinc-400">Manutenção (15%)</span>
                                        <span className="text-sm font-bold text-zinc-300">{formatCurrency(estimatedInterest * 0.15)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            <AdminStoreManager onSuccess={onSuccess} onError={onError} />

            {/* Resumo Financeiro Detalhado */}
            <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <TrendingUp className="text-emerald-400" size={20} />
                    Resumo Financeiro Detalhado
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl p-4 border border-blue-500/30">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                <ArrowUpFromLine className="text-blue-400" size={16} />
                            </div>
                            <span className="text-sm text-zinc-300 font-medium">Total Emprestado</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-400">
                            {state.stats?.totalLoaned !== undefined ? formatCurrency(state.stats.totalLoaned) : 'R$ 0,00'}
                        </p>
                        <p className="text-xs text-zinc-500 mt-2">Valor em empréstimos ativos</p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-900/30 to-orange-800/20 rounded-xl p-4 border border-orange-500/30">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                                <ArrowDownLeft className="text-orange-400" size={16} />
                            </div>
                            <span className="text-sm text-zinc-300 font-medium">A Receber</span>
                        </div>
                        <p className="text-2xl font-bold text-orange-400">
                            {state.stats?.totalToReceive !== undefined ? formatCurrency(state.stats.totalToReceive) : 'R$ 0,00'}
                        </p>
                        <p className="text-xs text-zinc-500 mt-2">Principal + juros</p>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 rounded-xl p-4 border border-emerald-500/30">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                                <PieChart className="text-emerald-400" size={16} />
                            </div>
                            <span className="text-sm text-zinc-300 font-medium">Valor por Cota</span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-400">
                            {state.stats?.quotasCount && state.stats.quotasCount > 0 ? formatCurrency((state.profitPool * 0.85) / state.stats.quotasCount) : 'R$ 0,00'}
                        </p>
                        <p className="text-xs text-zinc-500 mt-2">85% dos lucros / cota</p>
                    </div>
                </div>
            </div>

            {/* Control Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* System Balance Control */}
                <div className="bg-gradient-to-br from-surface to-surfaceHighlight rounded-2xl p-6 border border-surfaceHighlight shadow-xl">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center">
                            <DollarSign className="text-primary-400" size={20} />
                        </div>
                        Caixa Operacional
                        <span className="ml-2 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full font-medium">Automático</span>
                    </h3>
                    <div className="bg-gradient-to-r from-background to-surfaceHighlight rounded-xl p-6 mb-6 border border-surfaceHighlight/50">
                        <p className="text-sm text-zinc-400 mb-2 font-medium">Saldo Disponível</p>
                        <p className="text-3xl font-bold text-white">{formatCurrency(state.systemBalance)}</p>
                        <p className="text-xs text-zinc-500 mt-2">Disponível para operações do sistema</p>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-3">
                        <h4 className="font-semibold text-blue-300 text-sm flex items-center gap-2">
                            <RefreshCw size={16} className="text-blue-400" />
                            Cálculo Automático
                        </h4>
                        <div className="space-y-2 text-sm text-blue-200">
                            <p>• Total de cotas ativas × R$ 50,00</p>
                            <p>• Menos: Valor total emprestado</p>
                            <p>• Menos: Custo do Gateway (Mercado Pago)</p>
                            <p>• Igual: Caixa disponível</p>
                        </div>
                    </div>
                </div>

                {/* Profit Pool Control */}
                <div className="bg-gradient-to-br from-surface to-surfaceHighlight rounded-2xl p-6 border border-surfaceHighlight shadow-xl">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                            <PiggyBank className="text-emerald-400" size={20} />
                        </div>
                        Lucro de Juros Acumulado
                    </h3>
                    <div className="bg-gradient-to-r from-background to-surfaceHighlight rounded-xl p-6 mb-6 border border-surfaceHighlight/50">
                        <p className="text-sm text-zinc-400 mb-2 font-medium">Acumulado para Distribuição</p>
                        <p className="text-3xl font-bold text-emerald-400">{formatCurrency(state.profitPool)}</p>
                        <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                            <p className="text-xs text-yellow-300">
                                <strong>Regra de Distribuição:</strong> 85% para cotistas e 15% para manutenção. A distribuição ocorre automaticamente todos os dias às 00:00.
                            </p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="relative">
                            <label className="text-xs text-zinc-400 block mb-2 font-medium">Adicionar Lucro</label>
                            <input
                                type="text"
                                placeholder="200,50"
                                value={newProfit}
                                onChange={(e) => setNewProfit(e.target.value)}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl px-4 py-4 text-white outline-none focus:border-emerald-500 transition text-lg font-medium"
                            />
                        </div>
                        <button
                            onClick={handleUpdateProfit}
                            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center gap-2"
                        >
                            <Coins size={18} />
                            Adicionar Lucro
                        </button>
                    </div>
                </div>
            </div>

            {/* Manual Cost Control */}
            <div className="bg-gradient-to-br from-surface to-surfaceHighlight rounded-2xl p-6 border border-surfaceHighlight shadow-xl mt-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                        <ArrowDownLeft className="text-orange-400" size={20} />
                    </div>
                    Lançar Custos Adicionais
                </h3>
                <div className="bg-gradient-to-r from-background to-surfaceHighlight rounded-xl p-6 mb-6 border border-surfaceHighlight/50">
                    <p className="text-sm text-zinc-400 mb-2 font-medium">Total de Custos Manuais</p>
                    <p className="text-3xl font-bold text-orange-400">{formatCurrency(state.stats?.totalManualCosts ?? 0)}</p>
                    <p className="text-xs text-zinc-500 mt-2">Estes custos são deduzidos do caixa operacional.</p>
                </div>
                <div className="space-y-4">
                    <div className="relative">
                        <label className="text-xs text-zinc-400 block mb-2 font-medium">Valor do Custo</label>
                        <input
                            type="text"
                            placeholder="0,00"
                            value={newManualCost}
                            onChange={(e) => setNewManualCost(e.target.value)}
                            className="w-full bg-background border border-surfaceHighlight rounded-xl px-4 py-4 text-white outline-none focus:border-orange-500 transition text-lg font-medium"
                        />
                    </div>
                    <div className="relative">
                        <label className="text-xs text-zinc-400 block mb-2 font-medium">Descrição (Opcional)</label>
                        <input
                            type="text"
                            placeholder="Ex: Servidor"
                            value={manualCostDescription}
                            onChange={(e) => setManualCostDescription(e.target.value)}
                            className="w-full bg-background border border-surfaceHighlight rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 transition text-sm"
                        />
                    </div>
                    <button
                        onClick={handleUpdateManualCost}
                        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-black font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center gap-2"
                    >
                        <ArrowDownLeft size={18} />
                        Lançar Custo
                    </button>
                </div>
            </div>

            {/* Approval Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pending Transactions */}
                <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><RefreshCw size={18} /> Transações Pendentes ({pending.transactions?.length || 0})</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {pending.transactions?.length === 0 && <p className="text-zinc-500 text-sm">Nenhuma transação pendente.</p>}
                        {pending.transactions?.map((t) => {
                            let metadata: any = {};
                            try {
                                if (t.metadata && typeof t.metadata === 'object') {
                                    metadata = t.metadata;
                                } else {
                                    const metadataStr = String(t.metadata || '{}').trim();
                                    if (metadataStr.startsWith('{') || metadataStr.startsWith('[')) {
                                        metadata = JSON.parse(metadataStr);
                                    }
                                }
                            } catch (error) {
                                console.error('Erro ao fazer parse do metadata no frontend:', error);
                            }

                            const isLoanPayment = t.type === 'LOAN_PAYMENT';
                            const canApprovePayment = isLoanPayment && t.status === 'PENDING';

                            return (
                                <div key={t.id} className="bg-background p-4 rounded-xl border border-surfaceHighlight flex justify-between items-center">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.type === 'BUY_QUOTA' ? 'bg-primary-900 text-primary-200' : isLoanPayment ? 'bg-blue-900 text-blue-200' : 'bg-orange-900 text-orange-200'}`}>
                                                {t.type === 'BUY_QUOTA' ? 'COMPRA COTA' : isLoanPayment ? 'PGTO EMPRÉSTIMO' : 'SAQUE'}
                                            </span>
                                            {t.user_quotas > 0 && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary-500/20 text-primary-400 border border-primary-500/30 animate-pulse">
                                                    PRIORIDADE: {t.user_quotas} COTAS
                                                </span>
                                            )}
                                            <span className="text-zinc-400 text-xs">{t.date ? new Date(t.date).toLocaleDateString('pt-BR', {
                                                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                            }) : 'Data não disponível'}</span>
                                        </div>

                                        <div className="bg-surfaceHighlight/50 rounded-lg p-2 mb-2">
                                            <p className="text-xs text-zinc-400 mb-1">Cliente</p>
                                            <p className="text-sm font-medium text-white">{t.user_name || 'Nome não disponível'}</p>
                                            <p className="text-xs text-zinc-500">ID: {t.user_id} | {t.user_email || 'Email não disponível'}</p>
                                        </div>

                                        <p className="text-white font-medium">{t.description}</p>
                                        <div className="flex items-center gap-3 mt-2">
                                            <p className="text-xl font-bold text-white">{formatCurrency(t.amount)}</p>
                                            {t.type === 'WITHDRAWAL' && metadata.fee && (
                                                <div className="text-right">
                                                    <p className="text-xs text-red-400">Taxa: {formatCurrency(metadata.fee)}</p>
                                                    <p className="text-xs text-emerald-400">Líquido: {formatCurrency(metadata.netAmount)}</p>
                                                </div>
                                            )}
                                            {isLoanPayment && (
                                                <div className="text-right">
                                                    <p className="text-xs text-emerald-400">Principal: {formatCurrency(metadata.principalAmount || 0)}</p>
                                                    <p className="text-xs text-orange-400">Juros: {formatCurrency(metadata.interestAmount || 0)}</p>
                                                </div>
                                            )}
                                        </div>

                                        {metadata.mp_id && (
                                            <button
                                                onClick={() => handleSimulateMpPayment(metadata.mp_id, t.id)}
                                                className="w-full mt-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                                                title="Simular pagamento aprovado no Mercado Pago"
                                            >
                                                <ShieldCheck size={14} /> Simular Pagamento (Sandbox)
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        {isLoanPayment && canApprovePayment ? (
                                            <>
                                                <button title="Aprovar Pagamento" onClick={() => handleApprovePayment(t.id)} className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30">
                                                    <DollarSign size={20} />
                                                </button>
                                                <button title="Rejeitar Pagamento" onClick={() => handleRejectPayment(t.id)} className="p-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30">
                                                    <XIcon size={20} />
                                                </button>
                                            </>
                                        ) : t.type === 'WITHDRAWAL' ? (
                                            <>
                                                <button title="Aprovar Saque" onClick={() => handleApproveWithdrawal(t.id)} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30">
                                                    <DollarSign size={20} />
                                                </button>
                                                <button title="Rejeitar Saque" onClick={() => handleRejectWithdrawal(t.id)} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">
                                                    <XIcon size={20} />
                                                </button>
                                            </>
                                        ) : (
                                            <button title="Aprovar" onClick={() => handleAction(t.id, 'TRANSACTION', 'APPROVE')} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30"><Check size={20} /></button>
                                        )}
                                        {!isLoanPayment && t.type !== 'WITHDRAWAL' && (
                                            <button title="Rejeitar" onClick={() => handleAction(t.id, 'TRANSACTION', 'REJECT')} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"><XIcon size={20} /></button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Pending Loans */}
                <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><DollarSign size={18} /> Empréstimos Solicitados ({pending.loans?.length || 0})</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {pending.loans?.length === 0 && <p className="text-zinc-500 text-sm">Nenhum empréstimo pendente.</p>}
                        {pending.loans?.map(l => {
                            return (
                                <div key={l.id} className="bg-background p-4 rounded-xl border border-surfaceHighlight flex justify-between items-center">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-900 text-blue-200">
                                                SOLICITAÇÃO EMPRÉSTIMO
                                            </span>
                                            {l.user_quotas > 0 && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary-500/20 text-primary-400 border border-primary-500/30 animate-pulse">
                                                    PRIORIDADE: {l.user_quotas} COTAS
                                                </span>
                                            )}
                                            <span className="text-zinc-400 text-xs">{l.created_at || l.createdAt ? new Date(l.created_at || l.createdAt).toLocaleDateString('pt-BR', {
                                                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                            }) : 'Data não disponível'}</span>
                                        </div>

                                        <div className="bg-surfaceHighlight/50 rounded-lg p-2 mb-2">
                                            <p className="text-xs text-zinc-400 mb-1">Cliente</p>
                                            <p className="text-sm font-medium text-white">{l.userName || l.user_name || 'Nome não disponível'}</p>
                                            <p className="text-xs text-zinc-500">ID: {l.userId || l.user_id} | {l.userEmail || l.user_email || 'Email não disponível'}</p>
                                        </div>

                                        <p className="text-xl font-bold text-white">{formatCurrency(l.amount)}</p>
                                        <p className="text-xs text-zinc-400 mt-1">Pix Destino: {l.pixKeyToReceive || 'Não informado'}</p>
                                        <p className="text-xs text-zinc-500">Pagar: {formatCurrency(l.totalRepayment)} em {l.installments}x</p>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button title="Corrigir PIX" onClick={() => handleFixPix(l.id)} className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"><RefreshCw size={20} /></button>
                                        <button title="Aprovar" onClick={() => handleAction(l.id, 'LOAN', 'APPROVE')} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30"><Check size={20} /></button>
                                        <button title="Rejeitar" onClick={() => handleAction(l.id, 'LOAN', 'REJECT')} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"><XIcon size={20} /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={!!confirmMP}
                onClose={() => setConfirmMP(null)}
                onConfirm={confirmSimulateMpPayment}
                title="Simular Pagamento"
                message="Deseja realmente simular a aprovação deste pagamento no Mercado Pago Sandbox?"
            />

            <PromptModal
                isOpen={!!showFixPix}
                onClose={() => setShowFixPix(null)}
                onConfirm={onConfirmFixPix}
                title="Corrigir Chave PIX"
                message="Digite a nova chave PIX para o recebimento deste empréstimo."
                placeholder="Chave PIX (CPF, Email, Telefone ou Aleatória)"
            />
        </div>
    );
};
