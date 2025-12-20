import React, { useState } from 'react';
import {
    Gamepad2, Star, Coins, Crown, PlayCircle,
    ArrowLeft, TrendingUp, ShieldCheck, Zap,
    ChevronRight, Sparkles, Wand2, Lightbulb, RefreshCw, Users, Play
} from 'lucide-react';
import { AppState } from '../../../domain/types/common.types';
import { apiService } from '../../../application/services/api.service';

interface EarnViewProps {
    state: AppState;
    onBack: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
    onRefresh: () => Promise<void>;
}

export const EarnView = ({ state, onBack, onSuccess, onError, onRefresh }: EarnViewProps) => {
    const [loading, setLoading] = useState(false);
    const user = state.currentUser!;

    const handleWatchVideo = async () => {
        // Simulação de abrir Smart Link/Rewarded Ad
        window.open('https://www.effectivegatecpm.com/ec4mxdzvs?key=a9eefff1a8aa7769523373a66ff484aa', '_blank');

        setLoading(true);
        try {
            const response = await apiService.post<any>('/monetization/reward-video', {});
            if (response.success) {
                onSuccess('Bônus Recebido!', response.message);
                onRefresh();
            } else {
                onError('Aguarde', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message || 'Erro ao processar recompensa.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpgradePro = async () => {
        if (!confirm('Deseja assinar o Cred30 PRO por R$ 29,90 mensais? Suas taxas serão reduzidas e o caixa dos cotistas aumentará!')) return;

        setLoading(true);
        try {
            const response = await apiService.post<any>('/monetization/upgrade-pro', {});
            if (response.success) {
                onSuccess('Parabéns!', response.message);
                onRefresh();
            } else {
                onError('Falha no Upgrade', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message || 'Erro ao processar assinatura.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 pb-20">
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
                            <span className="text-lg font-black text-white">+ R$ 0,05 / +2 Score</span>
                        </div>
                        <PlayCircle size={32} className="text-primary-400" />
                    </div>
                    <button
                        onClick={handleWatchVideo}
                        disabled={loading}
                        className="w-full bg-primary-500 hover:bg-primary-400 text-black py-4 rounded-2xl font-black transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={20} /> : <PlayCircle size={20} />}
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
                        Faça o upgrade da sua conta e tenha benefícios exclusivos que aumentam seus lucros e os dividendos da comunidade.
                    </p>

                    <div className="grid grid-cols-1 gap-3 mb-8">
                        {[
                            { icon: <Zap size={14} />, text: "Aprovação de Crédito Prioritária" },
                            { icon: <TrendingUp size={14} />, text: "Taxas de Administração 20% Menores" },
                            { icon: <ShieldCheck size={14} />, text: "Selo de Membro Verificado PRO" },
                            { icon: <Users size={14} />, text: "Parte do valor vai para Dividendos" }
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3 text-zinc-300">
                                <div className="text-primary-400">{item.icon}</div>
                                <span className="text-xs font-medium">{item.text}</span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleUpgradePro}
                        disabled={loading || user.membership_type === 'PRO'}
                        className={`w-full py-4 rounded-2xl font-black transition active:scale-95 flex items-center justify-center gap-2 ${user.membership_type === 'PRO' ? 'bg-zinc-800 text-zinc-500' : 'bg-white text-black hover:bg-zinc-200 shadow-xl'}`}
                    >
                        {user.membership_type === 'PRO' ? 'MEMBRO PRO ATIVO' : 'ASSINAR PRO POR R$ 29,90'}
                    </button>
                    <p className="text-[8px] text-zinc-600 text-center mt-3 uppercase font-bold tracking-widest leading-normal">
                        Assinando hoje você ajuda a aumentar o fundo de reserva dos cotistas da plataforma.
                    </p>
                </div>
            </div>

            {/* Share & Dividend Pool Card */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                <div className="flex items-center gap-4 mb-4">
                    <div className="bg-zinc-800 p-3 rounded-2xl">
                        <TrendingUp size={24} className="text-emerald-400" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white">Fundo de Dividendos</h4>
                        <p className="text-[10px] text-zinc-500 uppercase font-black">Operação em crescimento</p>
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
                        Dica: Quanto mais membros usarem o Mercado e assistirem vídeos, maior será o pagamento mensal por Participação adquirida.
                    </p>
                </div>
            </div>
        </div>
    );
};
