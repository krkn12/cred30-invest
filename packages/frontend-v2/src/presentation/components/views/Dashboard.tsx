import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import packageJson from '../../../../package.json';
import {
    Users, Gamepad2, TrendingUp, DollarSign, ArrowUpFromLine, BookOpen,
    Repeat, Crown, Clock, ArrowDownLeft, ArrowUpRight,
    PieChart, AlertTriangle, LogOut, Star, Zap,
    ShoppingBag, Tag, PlusCircle, ShieldCheck, ChevronRight, Wallet, Coins, Settings, BarChart3, Gift, Sparkles, Bell
} from 'lucide-react';
import { AppState, User, Transaction } from '../../../domain/types/common.types';
import { QUOTA_PRICE } from '../../../shared/constants/app.constants';
import { AdBanner } from '../ui/AdBanner';
import { fastForwardTime, deleteUserAccount } from '../../../application/services/storage.service';
import { apiService } from '../../../application/services/api.service';

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
    onEducation: () => void;
    onVoting: () => void;
}

export const Dashboard = ({ state, onBuyQuota, onGames, onLoans, onWithdraw, onReinvest, onRefer, onVip, onLogout, onSuccess, onError, onChangePassword, onClaimReward, onMarketplace, onEarn, onEducation, onVoting }: DashboardProps) => {
    const user = state.currentUser!;

    // Usuários PRO não veem anúncios
    const isPro = user?.membership_type === 'PRO';

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

    const navigate = useNavigate();

    // Estado para o benefício de boas-vindas
    const [welcomeBenefit, setWelcomeBenefit] = useState<{
        hasDiscount: boolean;
        usesRemaining: number;
        maxUses: number;
        description: string;
        discountedRates: any;
    } | null>(null);

    // Buscar benefício de boas-vindas ao carregar
    useEffect(() => {
        const fetchWelcomeBenefit = async () => {
            try {
                const benefit = await apiService.getWelcomeBenefit();
                setWelcomeBenefit(benefit);
            } catch (error) {
                console.error('Erro ao buscar benefício:', error);
            }
        };
        fetchWelcomeBenefit();
    }, []);

    // Estados para o Baú de Recompensas (Faturamento Seguro)
    const [chestCountdown, setChestCountdown] = useState(0);
    const [chestsRemaining, setChestsRemaining] = useState(3);
    const [isOpeningChest, setIsOpeningChest] = useState(false);
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);

    // Buscar transações reais
    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const res = await apiService.getUserTransactions();
                if (res && Array.isArray(res.transactions)) {
                    // Pegar as 5 mais recentes (o backend já deve ordenar desc, mas garantimos aqui)
                    const sorted = [...res.transactions].sort((a: any, b: any) =>
                        new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
                    );
                    setRecentTransactions(sorted.slice(0, 5));
                }
            } catch (error) {
                console.error('Erro ao buscar transações:', error);
            } finally {
                setIsLoadingTransactions(false);
            }
        };
        fetchTransactions();
    }, []);

    const handleOpenChest = async () => {
        if (chestsRemaining <= 0 || chestCountdown > 0) return;

        // Abrir link do anúncio (Faturamento para o dono)
        window.open('https://www.effectivegatecpm.com/ec4mxdzvs?key=a9eefff1a8aa7769523373a66ff484aa', '_blank');

        setIsOpeningChest(true);

        // Simulando tempo do anúncio (5 segundos)
        setTimeout(async () => {
            try {
                // R$ 0,01 a R$ 0,03 (Lucro garantido: CPM de R$ 0,04 - R$ 0,06)
                const reward = (Math.random() * (0.03 - 0.01) + 0.01).toFixed(2);
                await apiService.post('/earn/chest-reward', { amount: parseFloat(reward) });

                onSuccess("Baú Aberto!", `Você recebeu um bônus de R$ ${reward} por sua fidelidade!`);
                setChestsRemaining(prev => prev - 1);
                setChestCountdown(3600); // 1 hora de intervalo entre baús
                setIsOpeningChest(false);
            } catch (error) {
                console.error(error);
                setIsOpeningChest(false);
            }
        }, 5000);
    };

    useEffect(() => {
        let timer: any;
        if (chestCountdown > 0) {
            timer = setInterval(() => setChestCountdown(prev => prev - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [chestCountdown]);

    const formatCountdown = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

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
        if (quotas >= 100) return { name: 'Fundador', color: 'bg-primary-600/20 text-primary-400 border-primary-500/30' };
        if (quotas >= 50) return { name: 'Ouro', color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' };
        if (quotas >= 10) return { name: 'Prata', color: 'bg-zinc-400/20 text-zinc-300 border-zinc-400/30' };
        return { name: 'Bronze', color: 'bg-orange-700/20 text-orange-600 border-orange-700/30' };
    };

    const vipLevel = getVipLevel(userQuotas.length);
    const getNextLevelInfo = (level: string) => {
        if (level === 'Bronze') return { next: 'Prata', goal: 10 };
        if (level === 'Prata') return { next: 'Ouro', goal: 50 };
        if (level === 'Ouro') return { next: 'Fundador', goal: 100 };
        return { next: null, goal: 100 };
    };

    const nextLevel = getNextLevelInfo(vipLevel.name);
    const progressToNext = nextLevel.next ? Math.min((userQuotas.length / nextLevel.goal) * 100, 100) : 100;

    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const isPositive = (type: string) => ['DEPOSIT', 'DIVIDEND', 'REFERRAL_BONUS', 'LOAN_RECEIVED', 'QUOTA_SELL', 'EDUCATION_REWARD', 'GAME_WIN', 'ADMIN_GIFT'].includes(type);

    const isLocked = user.securityLockUntil ? user.securityLockUntil > Date.now() : false;
    const lockTimeRemaining = user.securityLockUntil ? Math.ceil((user.securityLockUntil - Date.now()) / (1000 * 60 * 60)) : 0;

    return (
        <div className="space-y-8 pb-24">
            {/* Alerta de Segurança */}
            {isLocked && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-red-500 font-bold text-sm">Modo de Segurança Ativo</h3>
                        <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                            Sua conta está em modo "Apenas Visualização" por mais <strong>{lockTimeRemaining} horas</strong> devido a uma alteração recente de segurança.
                            Transações, saques e empréstimos serão liberados após este período por sua proteção.
                        </p>
                    </div>
                </div>
            )}

            {/* Card de Benefício de Boas-Vindas */}
            {welcomeBenefit?.hasDiscount && (
                <div className="bg-gradient-to-r from-emerald-900/40 via-emerald-800/30 to-primary-900/40 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500 relative overflow-hidden">
                    <div className="absolute -top-4 -right-4 opacity-10">
                        <Sparkles size={100} className="text-emerald-400" />
                    </div>
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                        <Gift className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="flex-1 relative z-10">
                        <h3 className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                            🎁 Benefício de Boas-Vindas Ativo!
                        </h3>
                        <p className="text-zinc-300 text-xs mt-1 leading-relaxed">
                            Você tem <strong className="text-emerald-400">{welcomeBenefit.usesRemaining} {welcomeBenefit.usesRemaining === 1 ? 'uso' : 'usos'}</strong> restantes com taxas especiais!
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-1 rounded-full font-bold">
                                Taxa Social {welcomeBenefit.discountedRates?.loanInterestRate}
                            </span>
                            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-1 rounded-full font-bold">
                                Saque {welcomeBenefit.discountedRates?.withdrawalFee}
                            </span>
                            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-1 rounded-full font-bold">
                                Marketplace {welcomeBenefit.discountedRates?.marketplaceEscrowFeeRate}
                            </span>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-3">
                            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-400 to-primary-400 transition-all duration-500"
                                    style={{ width: `${(welcomeBenefit.usesRemaining / welcomeBenefit.maxUses) * 100}%` }}
                                ></div>
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-1">{welcomeBenefit.usesRemaining}/{welcomeBenefit.maxUses} usos restantes</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Mobile Otimizado */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Olá, {user.name.split(' ')[0]} 👋</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${vipLevel.color}`}>
                            {vipLevel.name}
                        </span>
                        <div className="flex items-center gap-1 bg-surfaceHighlight px-2 py-0.5 rounded text-[10px] text-zinc-400">
                            <Star size={10} className="text-primary-400" fill="currentColor" />
                            <span className="font-bold text-white">{user.score || 0}</span>
                        </div>
                        <p className="text-xs text-zinc-400">Membro desde {new Date(user.joinedAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} • v{packageJson.version}</p>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">Código: <span className="text-zinc-400 font-mono select-all cursor-pointer">{user.referralCode}</span></p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                        <div className="relative">
                            <button onClick={() => navigate('/app/history')} className="text-zinc-400 hover:text-white p-2 bg-surfaceHighlight rounded-lg transition-colors relative">
                                <Bell size={20} />
                                {recentTransactions.filter(t => t.status === 'PENDING').length > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-500 rounded-full border-2 border-surface animate-pulse"></span>
                                )}
                            </button>
                        </div>
                        <button onClick={onLogout} className="text-zinc-400 hover:text-white p-2 bg-surfaceHighlight rounded-lg transition-colors" aria-label="Sair do sistema">
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Stats Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Balance Card - Destaque Principal */}
                <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-3xl p-5 sm:p-6 text-white shadow-[0_20px_50px_rgba(6,182,212,0.15)] col-span-2 relative overflow-hidden group">
                    <div className="absolute -top-4 -right-4 p-4 opacity-10 group-hover:scale-110 transition-transform rotate-12"><Wallet size={120} /></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1 opacity-80">
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">Saldo Total</span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tighter mb-5">{formatCurrency(user.balance)}</h2>
                        <div className="flex gap-2">
                            <button onClick={onWithdraw} className="flex-1 bg-black/20 hover:bg-black/40 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider py-3 px-3 rounded-xl backdrop-blur-md transition flex items-center justify-center gap-2 border border-white/10 active:scale-95">
                                <ArrowUpFromLine size={14} /> Resgatar
                            </button>
                            <button onClick={onBuyQuota} className="flex-1 bg-white text-primary-900 hover:bg-zinc-100 text-[10px] sm:text-xs font-black uppercase tracking-wider py-3 px-3 rounded-xl shadow-xl transition flex items-center justify-center gap-2 active:scale-95">
                                <TrendingUp size={14} /> Participar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Investment Card */}
                <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4 sm:p-6 relative overflow-hidden">
                    <div className="absolute -top-2 -right-2 p-2 opacity-5 rotate-12"><TrendingUp size={60} /></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <PieChart size={16} className="text-primary-400" />
                            <span className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-wider">Licenças</span>
                        </div>
                        <h3 className="text-lg sm:text-2xl font-black text-white">{formatCurrency(totalInvested)}</h3>
                        <p className="text-[9px] sm:text-xs text-zinc-500 mt-1 font-medium">{userQuotas.length} ativas</p>
                    </div>
                </div>

                {/* Earnings Card */}
                <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4 sm:p-6 relative overflow-hidden">
                    <div className="absolute -top-2 -right-2 p-2 opacity-5 rotate-12"><ArrowUpRight size={60} /></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <ArrowUpFromLine size={16} className="text-emerald-400" />
                            <span className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-wider">Excedentes</span>
                        </div>
                        <h3 className="text-lg sm:text-2xl font-black text-emerald-400">{formatCurrency(totalEarnings)}</h3>
                        <p className="text-[9px] sm:text-xs text-zinc-600 mt-1 font-medium">Acumulado</p>
                    </div>
                </div>

                {/* Debt Card (Ocupa 2 colunas no mobile se sobrar ou 1 se preferir) */}
                <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4 sm:p-6 relative overflow-hidden col-span-2 sm:col-span-1">
                    <div className="absolute -top-2 -right-2 p-2 opacity-5 rotate-12"><AlertTriangle size={60} /></div>
                    <div className="relative z-10 flex flex-col sm:block justify-center h-full">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign size={16} className="text-red-400" />
                            <span className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-wider">Apoios</span>
                        </div>
                        <div className="flex items-baseline justify-between sm:block">
                            <h3 className="text-lg sm:text-2xl font-black text-red-500">{formatCurrency(totalDebt)}</h3>
                            <p className="text-[9px] sm:text-xs text-zinc-600 mt-1 font-medium">{userLoans.length} contratos</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* VIP Progress */}
            {nextLevel.next && (
                <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white">Progresso para {nextLevel.next}</h3>
                        <span className="text-sm text-zinc-400">{userQuotas.length}/{nextLevel.goal} licenças</span>
                    </div>
                    <div className="w-full bg-zinc-700 rounded-full h-3 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-500"
                            style={{ width: `${Math.min(progressToNext, 100)}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">Faltam {nextLevel.goal - userQuotas.length} licenças para alcançar o próximo nível</p>
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
                            <p className="text-xs text-zinc-400">Cumpra tarefas e ganhe Score para aumentar seu nível e reputação</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                        {/* 1. Jogar & Ganhar */}
                        <div onClick={onGames} className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:bg-zinc-800 transition-colors group hover:border-purple-500/30">
                            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform shadow-lg shadow-purple-900/20">
                                <Gamepad2 size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white">Jogar</p>
                                <p className="text-[10px] text-zinc-500">Divirta-se e ganhe</p>
                            </div>
                        </div>

                        {/* 2. Aprender (Education) */}
                        <div onClick={onEducation} className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:bg-zinc-800 transition-colors group hover:border-blue-500/30">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform shadow-lg shadow-blue-900/20">
                                <BookOpen size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white">Aprender</p>
                                <p className="text-[10px] text-zinc-500">Estude e monetize</p>
                            </div>
                        </div>

                        {/* 3. Tarefas (Antigo Ganhos Diários) */}
                        <div onClick={onEarn} className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:bg-zinc-800 transition-colors group hover:border-yellow-500/30">
                            <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-500 group-hover:scale-110 transition-transform shadow-lg shadow-yellow-900/20">
                                <Coins size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white">Tarefas</p>
                                <p className="text-[10px] text-zinc-500">Mural de ofertas</p>
                            </div>
                        </div>

                        {/* 4. Indicar (Referral) */}
                        <div onClick={onRefer} className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:bg-zinc-800 transition-colors group hover:border-primary-500/30">
                            <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center text-primary-400 group-hover:scale-110 transition-transform shadow-lg shadow-primary-900/20">
                                <Users size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white">Convidar</p>
                                <p className="text-[10px] text-zinc-500">Convide amigos</p>
                            </div>
                        </div>

                        {/* 5. Votar (Governance) */}
                        <div onClick={onVoting} className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:bg-zinc-800 transition-colors group hover:border-emerald-500/30">
                            <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-900/20">
                                <BarChart3 size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white">Gevernança</p>
                                <p className="text-[10px] text-zinc-500">Vote e ganhe score</p>
                            </div>
                        </div>
                    </div>

                    {/* Novo Bloco: Baú de Recompensas (LUCRO GARANTIDO) */}
                    <div className="mt-4 pt-4 border-t border-surfaceHighlight">
                        <div
                            onClick={handleOpenChest}
                            className={`relative overflow-hidden group border rounded-2xl p-4 transition-all duration-500 cursor-pointer ${chestCountdown > 0 || chestsRemaining === 0
                                ? 'bg-zinc-900/40 border-zinc-800 grayscale cursor-not-allowed'
                                : 'bg-gradient-to-br from-amber-500/20 via-zinc-900 to-zinc-900 border-amber-500/30 hover:border-amber-500/60 shadow-lg shadow-amber-900/10 active:scale-[0.98]'
                                }`}
                        >
                            {/* Efeito de Brilho */}
                            {!isOpeningChest && chestCountdown === 0 && chestsRemaining > 0 && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none"></div>
                            )}

                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-amber-500 border transition-all duration-700 shadow-2xl ${chestCountdown > 0 ? 'bg-zinc-800 border-zinc-700' : 'bg-amber-500/10 border-amber-500/20 group-hover:scale-110 group-hover:rotate-6'}`}>
                                        <Gift size={32} className={isOpeningChest ? 'animate-bounce' : ''} />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-black text-sm uppercase tracking-tight flex items-center gap-2">
                                            Baú de Excedentes
                                            {chestsRemaining > 0 && chestCountdown === 0 && (
                                                <span className="flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                                </span>
                                            )}
                                        </h4>
                                        <p className="text-xs text-zinc-500 mt-1 font-medium">
                                            {isOpeningChest ? "Validando anúncio..." :
                                                chestCountdown > 0 ? `Próximo baú em ${formatCountdown(chestCountdown)}` :
                                                    chestsRemaining > 0 ? `Abra agora e ganhe bônus (${chestsRemaining}/${3})` :
                                                        "Volte amanhã para mais prêmios!"}
                                        </p>
                                    </div>
                                </div>

                                <div className={`text-[10px] font-black px-3 py-2 rounded-xl border transition-all ${chestCountdown > 0 || chestsRemaining === 0
                                    ? 'bg-zinc-800 text-zinc-600 border-zinc-700'
                                    : 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-900/20'
                                    }`}>
                                    {isOpeningChest ? "PROCESSANDO..." : chestCountdown > 0 ? "BLOQUEADO" : "ABRIR AGORA"}
                                </div>
                            </div>
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
                    <span className="text-xs font-medium text-zinc-300">Ativar</span>
                </button>

                <button onClick={onGames} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-purple-400 group-hover:bg-purple-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
                        <Gamepad2 size={24} />
                    </div>
                    <span className="text-xs font-medium text-zinc-300">Jogos</span>
                </button>

                <button onClick={onEducation} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-blue-400 group-hover:bg-blue-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
                        <BookOpen size={24} />
                    </div>
                    <span className="text-xs font-medium text-zinc-300">Aprender</span>
                </button>

                <button onClick={onMarketplace} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-primary-400 group-hover:bg-primary-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
                        <ShoppingBag size={24} />
                    </div>
                    <span className="text-xs font-medium text-zinc-300">Mercado</span>
                </button>

                <button onClick={onLoans} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-primary-400 group-hover:bg-primary-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
                        <Wallet size={24} />
                    </div>
                    <span className="text-xs font-medium text-zinc-300">Apoio</span>
                </button>

                <button onClick={onWithdraw} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-zinc-700 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
                        <ArrowUpFromLine size={24} />
                    </div>
                    <span className="text-xs font-medium text-zinc-300">Resgatar</span>
                </button>

                <button onClick={onReinvest} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
                        <Repeat size={24} />
                    </div>
                    <span className="text-xs font-medium text-zinc-300">Ativar</span>
                </button>

                <button onClick={onRefer} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-orange-400 group-hover:bg-orange-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
                        <Users size={24} />
                    </div>
                    <span className="text-xs font-medium text-zinc-300">Convidar</span>
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
                {/* Banner de Adsterra na Dashboard removido para limpeza de UI */}
            </div>

            {/* Recent Transactions (Extrato) */}
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white">Atividade Recente</h3>
                </div>

                <div className="space-y-4">
                    {isLoadingTransactions ? (
                        Array(3).fill(0).map((_, i) => (
                            <div key={i} className="flex justify-between items-center animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-zinc-800 rounded-full"></div>
                                    <div className="space-y-2">
                                        <div className="h-4 w-32 bg-zinc-800 rounded"></div>
                                        <div className="h-3 w-16 bg-zinc-800 rounded"></div>
                                    </div>
                                </div>
                                <div className="h-4 w-16 bg-zinc-800 rounded"></div>
                            </div>
                        ))
                    ) : recentTransactions.length > 0 ? (
                        recentTransactions.map((t: any) => (
                            <div key={t.id} className="flex justify-between items-center border-b border-surfaceHighlight pb-4 last:border-0 last:pb-0 group hover:bg-white/5 transition-colors p-2 -mx-2 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-2xl transition-all ${isPositive(t.type)
                                        ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20'
                                        : t.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                                        }`}>
                                        {t.status === 'PENDING' ? <Clock size={18} /> : isPositive(t.type) ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{t.description}</p>
                                        <p className="text-[10px] text-zinc-500 font-medium">
                                            {t.created_at || t.date ? new Date(t.created_at || t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recentemente'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className={`font-black text-sm ${t.status === 'PENDING' ? 'text-amber-400' :
                                        isPositive(t.type)
                                            ? 'text-emerald-400'
                                            : 'text-red-400'
                                        }`}>
                                        {isPositive(t.type) ? '+' : '-'}
                                        {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                    {t.status === 'PENDING' ? (
                                        <p className="text-[9px] text-amber-500 font-black uppercase tracking-tighter animate-pulse">Pendente</p>
                                    ) : (
                                        <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-tighter">Concluído</p>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 mb-3">
                                <Clock size={24} />
                            </div>
                            <p className="text-zinc-500 text-sm">Nenhuma movimentação ainda.</p>
                        </div>
                    )}
                </div>
                {recentTransactions.length > 0 && (
                    <button
                        onClick={() => navigate('/app/history')}
                        className="w-full mt-6 py-4 bg-surfaceHighlight hover:bg-zinc-800 text-xs font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-primary-400 transition-all rounded-2xl flex items-center justify-center gap-2 border border-white/5 active:scale-95"
                    >
                        Extrato Detalhado
                        <ArrowUpRight size={14} />
                    </button>
                )}
            </div>

            {/* Settings Modal removed as per user request */}
        </div>
    );
};



