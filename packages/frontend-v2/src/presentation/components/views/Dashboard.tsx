import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Gamepad2, TrendingUp, DollarSign, ArrowUpFromLine,
    Repeat, Crown, Clock, ArrowDownLeft, ArrowUpRight,
    PieChart, AlertTriangle, LogOut, Star, Zap,
    ShoppingBag, Tag, PlusCircle, ShieldCheck, ChevronRight, Wallet, Coins
} from 'lucide-react';
import { AppState, User } from '../../../domain/types/common.types';
import { QUOTA_PRICE } from '../../../shared/constants/app.constants';
import { AdBanner } from '../ui/AdBanner';
import { fastForwardTime, deleteUserAccount } from '../../../application/services/storage.service';
import { SettingsView } from './SettingsView';

interface DashboardProps {
    state: AppState;
    onBuyQuota: () => void;
    onGames: () => void;
    onLoans: () => void;
    onWithdraw: () => void;
    onReinvest: () => void;
    onRefer: () => void;
    onVip: () => void;
    onLogout: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
    onChangePassword: (oldPass: string, newPass: string) => Promise<void>;
    onClaimReward: () => Promise<void>;
    onMarketplace: () => void;
    onEarn: () => void;
}

export const Dashboard = ({ state, onBuyQuota, onGames, onLoans, onWithdraw, onReinvest, onRefer, onVip, onLogout, onSuccess, onError, onChangePassword, onClaimReward, onMarketplace, onEarn }: DashboardProps) => {
    const user = state.currentUser!;

    const { userQuotas, totalInvested, totalCurrentValue, totalEarnings, earningsPercentage } = useMemo(() => {
        const quotas = state.quotas.filter((q: any) => q.userId === user.id);
        const invested = quotas.reduce((acc: number, q: any) => acc + q.purchasePrice, 0);
        const current = quotas.reduce((acc: number, q: any) => acc + (q.currentValue || q.purchasePrice), 0);
        const earnings = current - invested;
        const percentage = invested > 0 ? (earnings / invested) * 100 : 0;
        return { userQuotas: quotas, totalInvested: invested, totalCurrentValue: current, totalEarnings: earnings, earningsPercentage: percentage };
    }, [state.quotas, user.id]);

    const { userLoans, totalDebt } = useMemo(() => {
        const loans = state.loans.filter((l: any) => l.userId === user.id && l.status === 'APPROVED');
        const debt = loans.reduce((acc: number, l: any) => acc + l.totalRepayment, 0);
        return { userLoans: loans, totalDebt: debt };
    }, [state.loans, user.id]);

    const [showSettings, setShowSettings] = useState(false);
    const navigate = useNavigate();

    const handleDeleteAccount = async () => {
        const res = await deleteUserAccount();
        if (!res.success) {
            onError('Erro', res.message);
        } else {
            onSuccess('Conta Encerrada', 'Sua conta foi encerrada com sucesso.');
            onLogout();
        }
    };

    const getVipLevel = (quotas: number) => {
        if (quotas >= 100) return 'Fundador';
        if (quotas >= 50) return 'Ouro';
        if (quotas >= 10) return 'Prata';
        return 'Bronze';
    };

    const vipLevel = getVipLevel(userQuotas.length);
    const getNextLevelInfo = (level: string) => {
        if (level === 'Bronze') return { next: 'Prata', goal: 10 };
        if (level === 'Prata') return { next: 'Ouro', goal: 50 };
        if (level === 'Ouro') return { next: 'Fundador', goal: 100 };
        return { next: null, goal: 100 };
    };

    const nextLevel = getNextLevelInfo(vipLevel);
    const progressToNext = nextLevel.next ? Math.min((userQuotas.length / nextLevel.goal) * 100, 100) : 100;

    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const isPositive = (type: string) => ['DEPOSIT', 'DIVIDEND', 'REFERRAL_BONUS', 'LOAN_RECEIVED', 'QUOTA_SELL'].includes(type);

    return (
        <div className="space-y-8 pb-24">
            {/* Header Mobile Otimizado */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Olá, {user.name.split(' ')[0]} 👋</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${vipLevel === 'Ouro' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' : vipLevel === 'Prata' ? 'bg-zinc-400/20 text-zinc-300 border border-zinc-400/30' : 'bg-orange-700/20 text-orange-600 border border-orange-700/30'}`}>
                            {vipLevel}
                        </span>
                        <div className="flex items-center gap-1 bg-surfaceHighlight px-2 py-0.5 rounded text-[10px] text-zinc-400">
                            <Star size={10} className="text-primary-400" fill="currentColor" />
                            <span className="font-bold text-white">{user.score || 0}</span>
                        </div>
                        <p className="text-xs text-zinc-500">Membro desde {new Date(user.joinedAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                    </div>
                    <p className="text-xs text-zinc-600 mt-1">Código: <span className="text-zinc-400 font-mono select-all cursor-pointer">{user.referralCode}</span></p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                        <button title="Sair" onClick={onLogout} className="text-zinc-400 hover:text-white p-2 bg-surfaceHighlight rounded-lg">
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Stats Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Balance Card - Destaque Principal */}
                <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-6 text-white shadow-[0_0_30px_rgba(6,182,212,0.2)] md:col-span-2 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Wallet size={80} /></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2 opacity-90">
                            <span className="text-sm font-medium">Saldo Disponível</span>
                        </div>
                        <h2 className="text-4xl font-bold tracking-tight mb-4">{formatCurrency(user.balance)}</h2>
                        <div className="flex gap-3">
                            <button onClick={onWithdraw} className="bg-black/20 hover:bg-black/40 text-white text-xs font-bold py-2 px-4 rounded-lg backdrop-blur-sm transition flex items-center gap-2 border border-white/10">
                                <ArrowUpFromLine size={14} /> Sacar
                            </button>
                            <button onClick={onBuyQuota} className="bg-white text-primary-900 hover:bg-zinc-100 text-xs font-bold py-2 px-4 rounded-lg shadow-lg transition flex items-center gap-2">
                                <TrendingUp size={14} /> Participar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Investment Card */}
                <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6 relative">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><TrendingUp size={40} /></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <PieChart size={20} className="text-primary-400" />
                            <span className="text-sm font-medium text-zinc-400">Participações</span>
                        </div>
                        <h3 className="text-2xl font-bold text-white">{formatCurrency(totalInvested)}</h3>
                        <p className="text-xs text-zinc-500 mt-1">{userQuotas.length} unidades</p>
                    </div>
                </div>

                {/* Earnings Card */}
                <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6 relative">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><ArrowUpRight size={40} /></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <ArrowUpFromLine size={20} className="text-emerald-400" />
                            <span className="text-sm font-medium text-zinc-400">Excedentes</span>
                        </div>
                        <h3 className="text-2xl font-bold text-emerald-400">{formatCurrency(totalEarnings)}</h3>
                        <p className="text-xs text-zinc-500 mt-1">Sobra Proporcional</p>
                    </div>
                </div>


                {/* Debt Card */}
                <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6 relative">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><AlertTriangle size={40} /></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign size={20} className="text-red-400" />
                            <span className="text-sm font-medium text-zinc-400">Compromisso Mútuo</span>
                        </div>
                        <h3 className="text-2xl font-bold text-red-400">{formatCurrency(totalDebt)}</h3>
                        <p className="text-xs text-zinc-500 mt-1">{userLoans.length} ajudas mútuas</p>
                    </div>
                </div>
            </div>

            {/* VIP Progress */}
            {nextLevel.next && (
                <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white">Progresso para {nextLevel.next}</h3>
                        <span className="text-sm text-zinc-400">{userQuotas.length}/{nextLevel.goal} cotas</span>
                    </div>
                    <div className="w-full bg-zinc-700 rounded-full h-3 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-500"
                            style={{ width: `${Math.min(progressToNext, 100)}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">Faltam {nextLevel.goal - userQuotas.length} cotas para alcançar o próximo nível</p>
                </div>
            )}

            {/* Central de Prêmios & Monetização (Gera Caixa/Score) */}
            <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Zap size={120} className="text-yellow-500" />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Zap size={20} className="text-yellow-500 fill-yellow-500" />
                                Central de Prêmios
                            </h3>
                            <p className="text-xs text-zinc-500">Cumpra tarefas e ganhe Score para aumentar seu limite</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Novo Atalho: Central de Ganhos */}
                        <div className="bg-background/50 border border-surfaceHighlight rounded-xl p-4 flex items-center justify-between group hover:border-yellow-500/30 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center text-yellow-500">
                                    <Coins size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">Ganhos Diários</p>
                                    <p className="text-[10px] text-zinc-400">Vídeos & Assinatura PRO</p>
                                </div>
                            </div>
                            <button
                                onClick={onEarn}
                                className="bg-yellow-500 hover:bg-yellow-400 text-black text-[10px] font-black px-3 py-2 rounded-lg transition-transform active:scale-95 shadow-lg shadow-yellow-500/20"
                            >
                                ACESSAR
                            </button>
                        </div>

                        {/* Tarefa: Indicação (Existente facilitada) */}
                        <div className="bg-background/50 border border-surfaceHighlight rounded-xl p-4 flex items-center justify-between group hover:border-primary-500/30 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary-500/10 rounded-lg flex items-center justify-center text-primary-400">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">Novo Membro</p>
                                    <p className="text-[10px] text-zinc-400">+R$ 5,00 de Bônus</p>
                                </div>
                            </div>
                            <button
                                onClick={onRefer}
                                className="bg-primary-500 hover:bg-primary-400 text-black text-[10px] font-black px-3 py-2 rounded-lg transition-transform active:scale-95 shadow-lg shadow-primary-500/20"
                            >
                                CONVIDAR
                            </button>
                        </div>
                    </div>

                    {/* Novo Bloco: Chamada para o Mercado Cred30 */}
                    <div className="mt-4 pt-4 border-t border-surfaceHighlight">
                        <div
                            onClick={onMarketplace}
                            className="bg-gradient-to-r from-primary-900/30 to-primary-600/10 border border-primary-500/30 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-primary-500/60 transition-all group scale-[1.02] shadow-lg shadow-primary-900/10"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary-500/20 rounded-lg text-primary-400">
                                    <ShoppingBag size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white group-hover:text-primary-400 transition-colors">Venda no Mercado Cred30</p>
                                    <p className="text-[10px] text-zinc-400">Transforme desapegos em saldo na conta com garantia total.</p>
                                </div>
                            </div>
                            <div className="bg-primary-500 text-black text-[10px] font-black px-3 py-1.5 rounded-lg flex items-center gap-1 group-hover:scale-105 transition-transform shadow-lg shadow-primary-500/20">
                                ANUNCIAR <PlusCircle size={10} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            {/* Quick Actions (Carrossel Horizontal) */}
            <div className="flex gap-4 overflow-x-auto py-4 px-1 no-scrollbar sm:justify-start -mx-4 px-4 sm:mx-0">
                <button onClick={onBuyQuota} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-primary-400 group-hover:bg-primary-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
                        <TrendingUp size={24} />
                    </div>
                    <span className="text-xs font-medium text-zinc-300">Aportar</span>
                </button>

                <button onClick={onGames} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-purple-400 group-hover:bg-purple-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
                        <Gamepad2 size={24} />
                    </div>
                    <span className="text-xs font-medium text-zinc-300">Jogos</span>
                </button>

                <button onClick={onMarketplace} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-primary-400 group-hover:bg-primary-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
                        <ShoppingBag size={24} />
                    </div>
                    <span className="text-xs font-medium text-zinc-300">Mercado</span>
                </button>

                <button onClick={onLoans} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-blue-400 group-hover:bg-blue-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
                        <DollarSign size={24} />
                    </div>
                    <span className="text-xs font-medium text-zinc-300">Crédito</span>
                </button>

                <button onClick={onWithdraw} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-zinc-700 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
                        <ArrowUpFromLine size={24} />
                    </div>
                    <span className="text-xs font-medium text-zinc-300">Sacar</span>
                </button>

                <button onClick={onReinvest} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
                        <Repeat size={24} />
                    </div>
                    <span className="text-xs font-medium text-zinc-300">Reinvestir</span>
                </button>

                <button onClick={onRefer} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-orange-400 group-hover:bg-orange-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
                        <Users size={24} />
                    </div>
                    <span className="text-xs font-medium text-zinc-300">Indicar</span>
                </button>

                <button onClick={onVip} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-yellow-500 group-hover:bg-yellow-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
                        <Crown size={24} />
                    </div>
                    <span className="text-xs font-medium text-zinc-300">VIP</span>
                </button>
            </div>

            {/* Mercado Cred30 - Escrow (Pivô de Monetização) */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Mercado Cred30</h3>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                        <ShieldCheck size={10} /> COMPRA GARANTIDA
                    </div>
                </div>

                <div
                    onClick={onMarketplace}
                    className="bg-surface border border-surfaceHighlight rounded-2xl p-4 cursor-pointer hover:border-primary-500/30 transition-all group"
                >
                    <div className="flex gap-4">
                        <div className="w-20 h-20 bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-800 shrink-0">
                            <Tag size={32} />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-white font-bold text-sm group-hover:text-primary-400 transition-colors">Venda o que não usa mais!</h4>
                            <p className="text-xs text-zinc-500 mt-1">Anuncie gratuitamente e receba direto no seu saldo com a segurança da Cred30.</p>
                            <div className="mt-3 text-[10px] font-black text-primary-400 flex items-center gap-1">
                                ACESSAR MERCADO <ChevronRight size={12} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Banner de Adsterra na Dashboard */}
                <AdBanner type="NATIVE" title="Cartão com Limite Alto" description="Aproveite ofertas de parceiros Cred30." actionText="VER AGORA" />
            </div>

            {/* Recent Transactions (Extrato) */}
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Últimas Transações</h3>
                <div className="space-y-4">
                    {state.transactions.slice(-5).reverse().map((t: any) => (
                        <div key={t.id} className="flex justify-between items-center border-b border-surfaceHighlight pb-3 last:border-0 last:pb-0">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${isPositive(t.type)
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : t.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
                                    }`}>
                                    {t.status === 'PENDING' ? <Clock size={18} /> : isPositive(t.type) ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">{t.description}</p>
                                    <p className="text-xs text-zinc-500">{t.date ? new Date(t.date).toLocaleDateString('pt-BR') : 'Data não disponível'}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`font-bold ${t.status === 'PENDING' ? 'text-yellow-400' :
                                    isPositive(t.type)
                                        ? 'text-emerald-400'
                                        : 'text-red-400'
                                    }`}>
                                    {isPositive(t.type) ? '+' : '-'}
                                    {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                                {t.status === 'PENDING' && <p className="text-[10px] text-yellow-500">Em Análise</p>}
                            </div>
                        </div>
                    ))}
                    {state.transactions.length === 0 && (
                        <p className="text-zinc-500 text-center text-sm py-4">Nenhuma movimentação recente.</p>
                    )}
                </div>
                {state.transactions.length > 0 && (
                    <button
                        onClick={() => navigate('/app/history')}
                        className="w-full mt-4 py-3 text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors flex items-center justify-center gap-2"
                    >
                        Ver Extrato Completo
                        <ArrowUpRight size={16} />
                    </button>
                )}
            </div>

            {/* Settings Modal - Using the consolidated SettingsView */}
            {showSettings && (
                <div className="fixed inset-0 z-50 bg-black/80 flex justify-end">
                    <div className="w-full max-w-sm bg-surface border-l border-surfaceHighlight p-6 h-full overflow-y-auto animate-in slide-in-from-right duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold text-white">Configurações</h2>
                            <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-white">✕</button>
                        </div>
                        <SettingsView
                            user={user}
                            onSimulateTime={() => fastForwardTime(30).then(() => window.location.reload())}
                            onLogout={onLogout}
                            onDeleteAccount={handleDeleteAccount}
                            onChangePassword={onChangePassword}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};



