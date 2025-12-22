import React, { useState } from 'react';
import {
    Gamepad2, Star, Coins, Crown, PlayCircle,
    ArrowLeft, TrendingUp, ShieldCheck, Zap,
    ChevronRight, Sparkles, Wand2, Lightbulb, RefreshCw, Users, Play, X as XIcon, Clock,
    Gift, Calendar, Search, ShieldAlert
} from 'lucide-react';
import { PromoVideoPlayer } from '../ui/PromoVideoPlayer';
import { AppState } from '../../../domain/types/common.types';
import { apiService } from '../../../application/services/api.service';

interface EarnViewProps {
    state: AppState;
    onBack: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
    onRefresh: () => Promise<void>;
    onUpgrade: (method: 'balance' | 'pix' | 'card') => Promise<void>;
}

export const EarnView = ({ state, onBack, onSuccess, onError, onRefresh, onUpgrade }: EarnViewProps) => {
    const [loading, setLoading] = useState(false);
    const [showAdModal, setShowAdModal] = useState(false);
    const [countDown, setCountDown] = useState(15);
    const user = state.currentUser!;

    const handleWatchVideo = () => {
        setShowAdModal(true);
        setCountDown(10); // 10 segundos de "vídeo"

        const timer = setInterval(() => {
            setCountDown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleAdRewardClaim = async () => {
        setLoading(true);
        try {
            // Abrir Smart Link (Anúncio Real)
            window.open('https://www.effectivegatecpm.com/ec4mxdzvs?key=a9eefff1a8aa7769523373a66ff484aa', '_blank');

            // Creditar Recompensa
            const response = await apiService.post<any>('/monetization/reward-video', {});

            if (response.success) {
                onSuccess('Bônus Recebido!', response.message);
                await onRefresh();
            } else {
                onError('Aguarde', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message || 'Erro ao processar recompensa.');
        } finally {
            setLoading(false);
            setShowAdModal(false);
        }
    };

    const handleDailyCheckin = async () => {
        setLoading(true);
        try {
            // Abrir o link de anúncio ANTES de validar no backend para garantir a receita
            window.open('https://www.effectivegatecpm.com/ec4mxdzvs?key=a9eefff1a8aa7769523373a66ff484aa', '_blank');

            const response = await apiService.post<any>('/monetization/daily-checkin', {});
            if (response.success) {
                onSuccess('Check-in Realizado!', response.message);
                await onRefresh();
            } else {
                onError('Aviso', response.message);
            }
        } catch (e: any) {
            onError('Aguarde', e.message || 'Tente novamente amanhã.');
        } finally {
            setLoading(false);
        }
    };

    const [searchEmail, setSearchEmail] = useState('');
    const [reputationData, setReputationData] = useState<any>(null);
    const [searchingRep, setSearchingRep] = useState(false);

    const handleReputationCheck = async () => {
        if (!searchEmail.trim()) {
            onError('Campo Vazio', 'Digite o e-mail do associado para consultar.');
            return;
        }

        if (!window.confirm(`Esta consulta possui um custo de R$ 35,00 que será debitado do seu saldo. Deseja prosseguir com a busca por ${searchEmail}?`)) {
            return;
        }

        setSearchingRep(true);
        setReputationData(null);
        try {
            const response = await apiService.get<any>(`/monetization/reputation-check/${searchEmail}`);
            if (response.success) {
                setReputationData(response.data);
                onSuccess('Consulta Realizada!', 'Relatório de idoneidade gerado com sucesso.');
                await onRefresh();
            } else {
                onError('Erro na Consulta', response.message);
            }
        } catch (e: any) {
            onError('Atenção', e.message || 'Erro ao realizar consulta.');
        } finally {
            setSearchingRep(false);
        }
    };

    const [proMethod, setProMethod] = useState<'balance' | 'pix' | 'card'>('balance');
    const [loadingLocal, setLoadingLocal] = useState(false);

    const handleUpgradePro = async () => {
        setLoadingLocal(true);
        try {
            await onUpgrade(proMethod);
        } catch (e: any) {
            // Erros são tratados no app.page por prop
        } finally {
            setLoadingLocal(false);
        }
    };

    return (
        <div className="space-y-6 pb-20 relative">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="text-zinc-400 hover:text-white transition">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Coins className="text-primary-400" />
                        Ganhos & Bônus
                    </h1>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Aumente sua Renda na Cred30</p>
                </div>
            </div>

            {/* Rewarded Video Card */}
            <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <PlayCircle size={100} />
                </div>
                <div className="p-6 relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="bg-primary-500/20 p-2 rounded-xl text-primary-400">
                            <Sparkles size={20} />
                        </div>
                        <span className="text-xs font-black text-primary-400 uppercase">Vídeo Premiado</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Ganhe Saldo em Segundos</h3>
                    <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                        Assista a um breve vídeo informativo de nossos parceiros e receba bônus de saldo e pontos de Score imediatamente.
                    </p>
                    <div className="bg-background/50 rounded-2xl p-4 border border-surfaceHighlight mb-6 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-zinc-500 uppercase font-black">Recompensa</span>
                            <span className="text-lg font-black text-white">+ R$ 0,002 / +5 Score</span>
                        </div>
                        <PlayCircle size={32} className="text-primary-400" />
                    </div>
                    <button
                        onClick={handleWatchVideo}
                        className="w-full bg-primary-500 hover:bg-primary-400 text-black py-4 rounded-2xl font-black transition active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20"
                    >
                        <PlayCircle size={20} />
                        ASSISTIR E GANHAR
                    </button>
                </div>
            </div>

            {/* Subscription PRO Card */}
            <div className="bg-gradient-to-br from-zinc-900 to-black border border-primary-500/30 rounded-3xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-4">
                    <Crown size={40} className="text-primary-400/20 group-hover:text-primary-400/40 transition-all" />
                </div>
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="bg-primary-500 text-black p-1 rounded font-black text-[9px] uppercase tracking-tighter">
                            OFERTA EXCLUSIVA
                        </div>
                        {user.membership_type === 'PRO' && (
                            <span className="text-[9px] text-primary-400 font-bold flex items-center gap-1 uppercase">
                                <ShieldCheck size={10} /> Seu plano atual
                            </span>
                        )}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        Seja Cred30 <span className="text-primary-400">PRO</span>
                    </h3>
                    <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                        Faça o upgrade da sua conta e tenha benefícios exclusivos que aumentam seus pontos e os excedentes operacionais da comunidade.
                    </p>

                    <div className="grid grid-cols-1 gap-3 mb-8">
                        {[
                            { icon: <Zap size={14} />, text: "Aprovação de Crédito Prioritária" },
                            { icon: <TrendingUp size={14} />, text: "Taxas de Administração 20% Menores" },
                            { icon: <ShieldCheck size={14} />, text: "Selo de Membro Verificado PRO" },
                            { icon: <Users size={14} />, text: "Contribui para os Excedentes Mútuos" }
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3 text-zinc-300">
                                <div className="text-primary-400">{item.icon}</div>
                                <span className="text-xs font-medium">{item.text}</span>
                            </div>
                        ))}
                    </div>

                    <div className="bg-background/40 rounded-xl p-1 mb-6 flex gap-1 border border-primary-500/10">
                        <button
                            onClick={() => setProMethod('balance')}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-widest transition ${proMethod === 'balance' ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/20' : 'text-zinc-500 hover:text-white'}`}
                        >
                            SALDO
                        </button>
                        <button
                            onClick={() => setProMethod('pix')}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-widest transition ${proMethod === 'pix' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-zinc-500 hover:text-white'}`}
                        >
                            PIX
                        </button>
                        <button
                            onClick={() => setProMethod('card')}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-widest transition ${proMethod === 'card' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-zinc-500 hover:text-white'}`}
                        >
                            CARTÃO
                        </button>
                    </div>

                    <button
                        onClick={handleUpgradePro}
                        disabled={loadingLocal || user.membership_type === 'PRO'}
                        className={`w-full py-4 rounded-2xl font-black transition active:scale-95 flex items-center justify-center gap-2 ${user.membership_type === 'PRO' ? 'bg-zinc-800 text-zinc-500' : (proMethod === 'pix' ? 'bg-emerald-500 text-black' : (proMethod === 'card' ? 'bg-blue-500 text-white' : 'bg-white text-black hover:bg-zinc-200'))} shadow-xl`}
                    >
                        {loadingLocal ? <RefreshCw className="animate-spin" size={20} /> : (user.membership_type === 'PRO' ? 'MEMBRO PRO ATIVO' : `ASSINAR PRO POR R$ 29,90`)}
                    </button>
                    <p className="text-[8px] text-zinc-600 text-center mt-3 uppercase font-bold tracking-widest leading-normal">
                        Assinando hoje você ajuda a aumentar os excedentes operacionais para todos os membros da plataforma.
                    </p>
                </div>
            </div>

            {/* Daily Check-in Section */}
            <div className="bg-surface border border-surfaceHighlight p-8 rounded-3xl group relative overflow-hidden cursor-pointer active:scale-[0.98] transition" onClick={handleDailyCheckin}>
                <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition">
                    <Calendar size={120} />
                </div>
                <div className="flex flex-col gap-4 relative z-10">
                    <div className="bg-emerald-500/10 w-fit p-3 rounded-2xl text-emerald-400">
                        <Calendar size={28} />
                    </div>
                    <div>
                        <h4 className="text-xl font-bold text-white">Check-in Diário</h4>
                        <p className="text-sm text-zinc-500">Acesse todos os dias para ganhar bônus de Score e Saldo.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="bg-emerald-500 text-black text-[10px] font-black py-1.5 px-3 rounded-lg uppercase tracking-wider">
                            Recompensa:+R$0.01
                        </div>
                        <div className="bg-zinc-800 text-zinc-400 text-[10px] font-black py-1.5 px-3 rounded-lg uppercase tracking-wider">
                            +10 Score
                        </div>
                    </div>
                </div>
            </div>

            {/* Reputation Check (Serasa Style) Card */}
            <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="bg-blue-500/10 p-2 rounded-xl text-blue-400">
                            <Search size={20} />
                        </div>
                        <span className="text-xs font-black text-blue-400 uppercase">Consulta de Idoneidade</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Relatório de Parceiro</h3>
                    <p className="text-sm text-zinc-400 mb-6 font-medium">
                        Vai negociar no Marketplace? Verifique o <span className="text-white font-bold">Score</span> e a reputação oficial do associado antes de fechar o negócio.
                    </p>

                    <div className="flex gap-2 mb-6">
                        <input
                            type="email"
                            placeholder="E-mail do associado..."
                            value={searchEmail}
                            onChange={(e) => setSearchEmail(e.target.value)}
                            className="flex-1 bg-background border border-surfaceHighlight rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50 transition-all font-medium"
                        />
                        <button
                            onClick={handleReputationCheck}
                            disabled={searchingRep}
                            className="bg-blue-500 hover:bg-blue-400 text-white px-6 rounded-2xl font-black text-xs transition active:scale-95 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                        >
                            {searchingRep ? <RefreshCw className="animate-spin" size={16} /> : 'CONSULTAR'}
                        </button>
                    </div>

                    {reputationData && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="bg-zinc-800/50 border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5">
                                    <ShieldCheck size={80} className="text-blue-400" />
                                </div>
                                <div className="space-y-4 relative z-10">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Nome do Associado</p>
                                            <h4 className="text-lg font-black text-white">{reputationData.name}</h4>
                                        </div>
                                        {reputationData.isVerified && (
                                            <div className="bg-blue-500 text-white p-1 rounded-full">
                                                <ShieldCheck size={16} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-black/20 p-4 rounded-xl border border-zinc-700/30">
                                            <p className="text-[9px] text-zinc-500 font-bold uppercase mb-1">Score Cred30</p>
                                            <p className={`text-2xl font-black ${reputationData.score >= 700 ? 'text-emerald-400' : (reputationData.score >= 400 ? 'text-yellow-400' : 'text-red-400')}`}>
                                                {reputationData.score}
                                            </p>
                                        </div>
                                        <div className="bg-black/20 p-4 rounded-xl border border-zinc-700/30">
                                            <p className="text-[9px] text-zinc-500 font-bold uppercase mb-1">Status Global</p>
                                            <p className={`text-xs font-black uppercase ${reputationData.status === 'ACTIVE' ? 'text-emerald-400' : 'text-red-500'}`}>
                                                {reputationData.status === 'ACTIVE' ? 'CONTRATO ATIVO' : 'SUSPENSO'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold pt-2 border-t border-zinc-700/50">
                                        <Clock size={12} />
                                        <span>MEMBRO DESDE: {new Date(reputationData.since).toLocaleDateString()}</span>
                                        <span className="mx-1">•</span>
                                        <span>PLANO: {reputationData.membership}</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[9px] text-zinc-600 text-center mt-4 uppercase font-bold italic">
                                * Informações geradas com base nos dados reais de idoneidade da comunidade Cred30.
                            </p>
                        </div>
                    )}

                    {!reputationData && (
                        <div className="flex items-center gap-2 text-[10px] text-zinc-600 font-bold uppercase tracking-tight justify-center">
                            <ShieldAlert size={12} />
                            Custo por consulta de idoneidade: R$ 35,00
                        </div>
                    )}
                </div>
            </div>

            {/* Share & Dividend Pool Card */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                <div className="flex items-center gap-4 mb-4">
                    <div className="bg-zinc-800 p-3 rounded-2xl">
                        <TrendingUp size={24} className="text-emerald-400" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white">Resultados Proporcionais</h4>
                        <p className="text-[10px] text-zinc-500 uppercase font-black">Distribuição de Excedentes</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-400">Total Distribuído</span>
                        <span className="font-bold text-white">R$ {state.systemBalance.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full w-[65%]" />
                    </div>
                    <p className="text-[10px] text-zinc-500 italic leading-relaxed">
                        Dica: Quanto mais membros usarem o Mercado e assistirem vídeos, maior será a distribuição proporcional por Participação adquirida.
                    </p>
                </div>
            </div>

            {/* Video Ad Modal */}
            {showAdModal && (
                <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4">
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 max-w-sm w-full relative">
                        <button
                            onClick={() => setShowAdModal(false)}
                            className="absolute top-4 right-4 text-zinc-500 hover:text-white"
                        >
                            <XIcon size={20} />
                        </button>

                        <div className="text-center pt-4">
                            <div className="w-20 h-20 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                                <div className="absolute inset-0 border-4 border-primary-500/20 rounded-full animate-spin-slow"></div>
                                <PlayCircle size={40} className="text-primary-400" />
                            </div>

                            <h3 className="text-2xl font-bold text-white mb-2">Vídeo Publicitário</h3>
                            <p className="text-sm text-zinc-400 mb-8 px-4">
                                Assista ao vídeo do nosso parceiro para desbloquear sua recompensa exclusiva.
                            </p>

                            <div className="bg-black/50 rounded-xl p-4 border border-zinc-800 mb-6">
                                <div className="flex items-center justify-between text-xs text-zinc-500 mb-2 uppercase font-bold tracking-wider">
                                    <span>Tempo Restante</span>
                                    <Clock size={14} />
                                </div>
                                <div className="text-4xl font-mono font-bold text-white tabular-nums">
                                    00:{countDown.toString().padStart(2, '0')}
                                </div>
                            </div>

                            <button
                                onClick={handleAdRewardClaim}
                                disabled={countDown > 0 || loading}
                                className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${countDown > 0
                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                    : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                                    }`}
                            >
                                {loading ? <RefreshCw className="animate-spin" size={20} /> : (
                                    countDown > 0 ? 'AGUARDE O VÍDEO...' : 'RESGATAR RECOMPENSA'
                                )}
                            </button>

                            <p className="text-[9px] text-zinc-600 mt-4 italic">
                                Ao clicar em resgatar, você será redirecionado ao site do parceiro.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
