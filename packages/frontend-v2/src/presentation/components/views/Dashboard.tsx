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
    const user = state?.currentUser;

    // Guard clause: prevent crash if state or user is not loaded yet
    if (!state || !user) {
        return <div className="flex justify-center items-center min-h-[60vh] text-zinc-500">Carregando...</div>;
    }

    // Usuários PRO não veem anúncios
    const isPro = user?.membership_type === 'PRO';

    const { userQuotas, totalInvested, totalCurrentValue, totalEarnings, earningsPercentage } = useMemo(() => {
        const quotas = state.quotas?.filter((q: any) => q.userId === user.id) ?? [];
        const invested = quotas.reduce((acc: number, q: any) => acc + q.purchasePrice, 0);
        const current = quotas.reduce((acc: number, q: any) => acc + (q.currentValue || q.purchasePrice), 0);
        const earnings = current - invested;
        const percentage = invested > 0 ? (earnings / invested) * 100 : 0;
        return { userQuotas: quotas, totalInvested: invested, totalCurrentValue: current, totalEarnings: earnings, earningsPercentage: percentage };
    }, [state.quotas, user.id]);

    const { userLoans, totalDebt } = useMemo(() => {
        const loans = state.loans?.filter((l: any) => l.userId === user.id && l.status === 'APPROVED') ?? [];
        const debt = loans.reduce((acc: number, l: any) => acc + l.totalRepayment, 0);
        return { userLoans: loans, totalDebt: debt };
    }, [state.loans, user.id]);

    const navigate = useNavigate();

    // Benefício de boas-vindas vem do estado global (sincronizado)
    const welcomeBenefit = state.welcomeBenefit;

    // Estados para o Baú de Recompensas (Faturamento Seguro)
    const [chestCountdown, setChestCountdown] = useState(0);
    const [chestsRemaining, setChestsRemaining] = useState(3);
    const [isOpeningChest, setIsOpeningChest] = useState(false);

    // Memoizar transações recentes do estado global
    const recentTransactions = useMemo(() => {
        if (!state.transactions) return [];
        return [...state.transactions]
            .filter(t => t.userId === user.id)
            .sort((a: any, b: any) =>
                new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
            )
            .slice(0, 5);
    }, [state.transactions, user.id]);

    const isLoadingTransactions = state.isLoading;

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

    const isLocked = user.securityLockUntil ? new Date(user.securityLockUntil).getTime() > Date.now() : false;
    const lockTimeRemaining = user.securityLockUntil ? Math.ceil((new Date(user.securityLockUntil).getTime() - Date.now()) / (1000 * 60 * 60)) : 0;

    return (
        <div className="space-y-8 pb-24">
            {/* 1. Header com Boas-Vindas Premium (WOW Factor) */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-[#0A0A0A] border border-white/5 p-8 shadow-2xl">
                <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none select-none">
                    <Sparkles size={160} className="text-primary-400 animate-pulse" />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="px-4 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 flex items-center gap-2">
                            <Crown size={14} className="text-primary-400" fill="currentColor" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400">Associado Fundador</span>
                        </div>
                        <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Verificado</span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                        <div>
                            <p className="text-zinc-500 font-bold text-sm mb-1 uppercase tracking-widest flex items-center gap-2">
                                {new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite'}
                                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                {new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}
                            </p>
                            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none">
                                {user.name.split(' ')[0]}<span className="text-primary-500">.</span>
                            </h1>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Reputação</p>
                                <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-2xl border border-zinc-800 ring-1 ring-white/5 shadow-xl">
                                    <Star size={16} className="text-primary-400" fill="currentColor" />
                                    <span className="text-xl font-black text-white">{user.score || 0}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => navigate('/app/settings')}
                                className="w-14 h-14 bg-white/5 hover:bg-zinc-800 rounded-2xl flex items-center justify-center border border-white/5 transition-all active:scale-95 group shadow-xl"
                            >
                                <Settings size={24} className="text-zinc-400 group-hover:text-white transition-colors" />
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-white/5 flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${vipLevel.color} shadow-lg shadow-black`}>
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Nível de Membro</p>
                                <p className="text-xs font-black text-white uppercase tracking-wider">{vipLevel.name}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center text-zinc-400 border border-white/5">
                                <Clock size={20} />
                            </div>
                            <div>
                                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Desde</p>
                                <p className="text-xs font-black text-white whitespace-nowrap uppercase tracking-tighter">{new Date(user.joinedAt).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</p>
                            </div>
                        </div>

                        <div className="flex-1 min-w-[120px]">
                            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2 flex justify-between">
                                Próximo Nível: <span className="text-primary-400">{nextLevel.next || 'Máximo'}</span>
                            </p>
                            <div className="h-1.5 bg-zinc-800/50 rounded-full overflow-hidden border border-white/5">
                                <div
                                    className="h-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-1000"
                                    style={{ width: `${progressToNext}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Alertas e Benefícios de Boas-Vindas */}
            <div className="space-y-4">
                {welcomeBenefit?.hasDiscount && (
                    <div className="bg-gradient-to-r from-emerald-900/20 via-zinc-900/40 to-black border border-emerald-500/30 rounded-[2.5rem] p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                            <Gift size={120} className="text-emerald-400" />
                        </div>

                        <div className="relative z-10 text-center sm:text-left">
                            <h3 className="text-emerald-400 font-black text-xs uppercase tracking-[0.2em] mb-4 flex items-center justify-center sm:justify-start gap-2">
                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                Benefício de Boas-Vindas Ativo
                            </h3>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                                <div className="bg-black/40 p-4 rounded-3xl border border-white/5">
                                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Apoio Mútuo</p>
                                    <p className="text-lg font-black text-white">{welcomeBenefit.discountedRates?.loanInterestRate} <span className="text-[10px] text-emerald-400">Social</span></p>
                                </div>
                                <div className="bg-black/40 p-4 rounded-3xl border border-white/5">
                                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Saques PIX</p>
                                    <p className="text-lg font-black text-white">{welcomeBenefit.discountedRates?.withdrawalFee}</p>
                                </div>
                                <div className="bg-black/40 p-4 rounded-3xl border border-white/5 col-span-2 sm:col-span-1">
                                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Marketplace</p>
                                    <p className="text-lg font-black text-white">{welcomeBenefit.discountedRates?.marketplaceEscrowFeeRate}</p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-6">
                                <div className="flex-1 w-full">
                                    <div className="h-2.5 bg-zinc-800/50 rounded-full overflow-hidden border border-white/5">
                                        <div
                                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-1000"
                                            style={{ width: `${(welcomeBenefit.usesRemaining / welcomeBenefit.maxUses) * 100}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-zinc-500 mt-3 font-black uppercase tracking-[0.2em]">
                                        RESTAM <span className="text-emerald-400">{welcomeBenefit.usesRemaining}</span> DE <span className="text-white">{welcomeBenefit.maxUses}</span> EVENTOS BONIFICADOS
                                    </p>
                                </div>
                                <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-2xl">
                                    <Sparkles size={40} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isLocked && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-[2.5rem] p-8 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                        <div className="w-16 h-16 rounded-3xl bg-red-500/20 flex items-center justify-center text-red-500 shrink-0 border border-red-500/20">
                            <ShieldCheck size={36} />
                        </div>
                        <div>
                            <h3 className="text-red-500 font-black text-sm uppercase tracking-[0.2em] mb-2">Trava de Segurança Ativa</h3>
                            <p className="text-zinc-400 text-xs leading-relaxed font-bold uppercase tracking-wider">
                                Operações de saída bloqueadas por proteção de nova conta/senha. <br className="hidden sm:block" />
                                Liberação antecipada em <strong className="text-white bg-red-500/20 px-2 py-0.5 rounded-lg">{lockTimeRemaining} horas</strong>.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Balanço e Ações Rápidas */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 rounded-[3rem] p-10 text-white shadow-2xl shadow-primary-900/30 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-700 pointer-events-none select-none">
                        <Wallet size={200} />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Saldo Corrente Líquido</span>
                        </div>
                        <h2 className="text-6xl font-black tracking-tighter mb-10 tabular-nums">{formatCurrency(user.balance)}</h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                                onClick={onWithdraw}
                                className="bg-black/20 hover:bg-black/40 text-white text-[10px] font-black uppercase tracking-[0.2em] py-5 rounded-2xl backdrop-blur-md transition-all flex items-center justify-center gap-3 border border-white/10 active:scale-95 shadow-xl"
                            >
                                <ArrowUpFromLine size={20} /> SACAR AGORA
                            </button>
                            <button
                                onClick={onBuyQuota}
                                className="bg-white text-primary-900 hover:bg-zinc-100 text-[10px] font-black uppercase tracking-[0.2em] py-5 rounded-2xl shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 translate-y-[-2px] hover:translate-y-[-4px]"
                            >
                                <TrendingUp size={20} /> NOVA LICENÇA
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-[#0D0D0D] border border-white/5 rounded-[3rem] p-10 flex flex-col justify-between group hover:border-primary-500/30 transition-all shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-16 h-16 bg-primary-500/10 rounded-3xl flex items-center justify-center text-primary-400 group-hover:scale-110 transition-transform shadow-2xl">
                            <PieChart size={32} />
                        </div>
                        <span className="bg-primary-500/10 text-primary-400 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest">{userQuotas.length} ATIVAS</span>
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Capital Alocado</p>
                        <h3 className="text-3xl font-black text-white whitespace-nowrap tracking-tight">{formatCurrency(totalInvested)}</h3>
                    </div>
                </div>

                <div className="bg-[#0D0D0D] border border-white/5 rounded-[3rem] p-10 flex flex-col justify-between group hover:border-emerald-500/30 transition-all shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform shadow-2xl">
                            <ArrowUpRight size={32} />
                        </div>
                        <span className="bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest">+{earningsPercentage.toFixed(1)}%</span>
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Excedentes Totais</p>
                        <h3 className="text-3xl font-black text-emerald-400 whitespace-nowrap tracking-tight">{formatCurrency(totalEarnings)}</h3>
                    </div>
                </div>
            </div>

            {/* 4. Central de Prêmios e Gamificação */}
            <div className="bg-[#080808] border border-white/5 rounded-[3rem] p-10 relative overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]">
                <div className="absolute top-0 right-0 p-16 opacity-5 pointer-events-none select-none">
                    <Zap size={180} className="text-yellow-500" />
                </div>

                <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
                        <div>
                            <h3 className="text-3xl font-black text-white tracking-tight flex items-center gap-4">
                                <span className="p-3 bg-yellow-500/10 rounded-2xl shadow-inner">
                                    <Zap size={28} className="text-yellow-500 fill-yellow-500" />
                                </span>
                                Central de Prêmios
                            </h3>
                            <p className="text-sm text-zinc-500 font-bold uppercase tracking-wider mt-2">Maximize sua reputação para desbloquear benefícios</p>
                        </div>
                        <div className="bg-zinc-900/80 px-5 py-3 rounded-2xl border border-white/5 flex items-center gap-4 shadow-2xl">
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                            <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Missões Disponíveis</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-10">
                        {[
                            { icon: Gamepad2, color: 'purple', label: 'Jogar', sub: 'Fun', act: onGames, bg: 'bg-purple-500/10', text: 'text-purple-400', subText: 'text-purple-500/60', shadow: 'hover:shadow-purple-900/20' },
                            { icon: BookOpen, color: 'blue', label: 'Estudar', sub: 'Learn', act: onEducation, bg: 'bg-blue-500/10', text: 'text-blue-400', subText: 'text-blue-500/60', shadow: 'hover:shadow-blue-900/20' },
                            { icon: Coins, color: 'yellow', label: 'Missões', sub: 'Earn', act: onEarn, bg: 'bg-yellow-500/10', text: 'text-yellow-400', subText: 'text-yellow-500/60', shadow: 'hover:shadow-yellow-900/20' },
                            { icon: Users, color: 'primary', label: 'Indicar', sub: 'Invite', act: onRefer, bg: 'bg-primary-500/10', text: 'text-primary-400', subText: 'text-primary-500/60', shadow: 'hover:shadow-primary-900/20' },
                            { icon: BarChart3, color: 'emerald', label: 'Votar', sub: 'Club', act: onVoting, bg: 'bg-emerald-500/10', text: 'text-emerald-400', subText: 'text-emerald-500/60', shadow: 'hover:shadow-emerald-900/20' }
                        ].map((item, idx) => (
                            <button
                                key={idx}
                                onClick={item.act}
                                className={`aspect-square bg-zinc-900 border border-white/5 rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:bg-zinc-800 transition-all group active:scale-95 shadow-xl hover:translate-y-[-4px] ${item.shadow}`}
                            >
                                <div className={`w-14 h-14 ${item.bg} rounded-2xl flex items-center justify-center ${item.text} group-hover:scale-110 transition-transform shadow-inner`}>
                                    <item.icon size={28} />
                                </div>
                                <div className="text-center">
                                    <p className="text-[11px] font-black text-white uppercase tracking-widest">{item.label}</p>
                                    <p className={`text-[8px] font-black ${item.subText} uppercase tracking-[0.3em] mt-1`}>{item.sub}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className={`group relative overflow-hidden rounded-[2.5rem] p-10 transition-all duration-700 shadow-2xl border border-white/5 hover:border-amber-500/50 ${chestCountdown > 0 || chestsRemaining === 0
                        ? 'bg-zinc-900/40 grayscale'
                        : 'bg-[#0F0F0F] cursor-pointer'
                        }`}>
                        <div
                            onClick={handleOpenChest}
                            className="flex flex-col sm:flex-row items-center gap-10 relative z-10 text-center sm:text-left"
                        >
                            <div className="relative group-hover:scale-110 transition-transform duration-700">
                                <Gift size={80} className={chestCountdown > 0 ? 'text-zinc-700' : 'text-amber-500'} strokeWidth={1} />
                                {chestCountdown === 0 && chestsRemaining > 0 && (
                                    <div className="absolute inset-0 bg-amber-500 blur-[40px] opacity-20 animate-pulse" />
                                )}
                            </div>
                            <div className="flex-1">
                                <h4 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Baú de Excedentes Diários</h4>
                                <p className="text-sm font-medium text-zinc-500 mb-6 uppercase tracking-wider italic">Contribua com a rede assistindo conteúdo e receba saldo imediato</p>

                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
                                    <div className="px-5 py-3 bg-black rounded-2xl border border-white/5 text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] shadow-inner">
                                        {chestCountdown > 0 ? `INTERVALO: ${formatCountdown(chestCountdown)}` : `DISPONÍVEL: ${chestsRemaining} UNIDADES`}
                                    </div>
                                    {chestCountdown === 0 && chestsRemaining > 0 && (
                                        <div className="px-6 py-3 bg-amber-500 text-black rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3 shadow-2xl hover:bg-amber-400 transition-colors">
                                            ABRIR RECOMPENSA <ChevronRight size={18} strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {isOpeningChest && (
                            <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-20 animate-in fade-in duration-500">
                                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="text-xs font-black text-amber-500 uppercase tracking-[0.3em] animate-pulse">Sincronizando Recompensa...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 5. Histórico e Transações Recentes */}
            <div className="bg-[#0A0A0A] border border-white/5 rounded-[3rem] p-10 shadow-2xl">
                <div className="flex items-center justify-between mb-10">
                    <h3 className="text-3xl font-black text-white tracking-tight flex items-center gap-4">
                        <Clock size={32} className="text-zinc-600" />
                        Fluxo de Caixa
                    </h3>
                    <button
                        onClick={() => navigate('/app/history')}
                        className="text-[11px] font-black text-primary-400 uppercase tracking-[0.2em] hover:text-white transition-all ring-1 ring-primary-500/20 px-4 py-2 rounded-xl"
                    >
                        EXTRATO COMPLETO
                    </button>
                </div>

                <div className="space-y-4">
                    {recentTransactions.length > 0 ? (
                        recentTransactions.map((t: any) => (
                            <div key={t.id} className="group bg-[#111111] border border-white/5 hover:border-zinc-700 p-6 rounded-[2rem] transition-all flex items-center justify-between shadow-lg">
                                <div className="flex items-center gap-6">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl shadow-black ${isPositive(t.type) ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                        }`}>
                                        {isPositive(t.type) ? <ArrowDownLeft size={32} /> : <ArrowUpRight size={32} />}
                                    </div>
                                    <div>
                                        <h4 className="text-base font-black text-white uppercase tracking-tight mb-1 group-hover:text-primary-400 transition-colors">{t.description}</h4>
                                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                                            {new Date(t.created_at || t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(' de ', ' ')}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-xl font-black tabular-nums tracking-tighter mb-1 ${isPositive(t.type) ? 'text-emerald-400' : 'text-zinc-500'
                                        }`}>
                                        {isPositive(t.type) ? '+' : '-'} {formatCurrency(t.amount)}
                                    </p>
                                    <div className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-lg inline-block border ${t.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse' : 'bg-zinc-900 text-zinc-600 border-white/5'
                                        }`}>
                                        {t.status === 'PENDING' ? 'Em Validação' : 'Processado'}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-900/10 rounded-[3rem] border border-dashed border-zinc-800">
                            <Clock size={60} className="text-zinc-800 mb-6" />
                            <p className="text-zinc-500 text-sm font-black uppercase tracking-[0.2em]">Fluxo de caixa vazio</p>
                            <p className="text-[10px] text-zinc-700 mt-3 font-bold uppercase tracking-widest italic">Inicie sua jornada para ver movimentações aqui</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
