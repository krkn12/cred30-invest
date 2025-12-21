import React, { useState } from 'react';
import { Gamepad2, PlayCircle, Trophy, ArrowLeft, RefreshCw, X as XIcon, BookOpen } from 'lucide-react';
import { PromoVideoPlayer } from '../ui/PromoVideoPlayer';
import { apiService } from '../../../application/services/api.service';

interface GamesViewProps {
    onBack?: () => void;
}

export const GamesView: React.FC<GamesViewProps> = ({ onBack }) => {
    const [loadingAd, setLoadingAd] = useState(false);
    const [showAdModal, setShowAdModal] = useState(false);
    const [selectedGameUrl, setSelectedGameUrl] = useState('');
    const [adCompleted, setAdCompleted] = useState(false);

    const handlePlayGame = (url: string) => {
        setSelectedGameUrl(url);
        setShowAdModal(true);
        setAdCompleted(false);
    };

    const handleAdFinished = () => {
        setAdCompleted(true);
    };

    const handleManualClick = async () => {
        setLoadingAd(true);
        let rewardMsg = '';

        try {
            // Tenta creditar recompensa real
            const res = await apiService.post<any>('/monetization/reward-video', {});
            if (res.success) {
                rewardMsg = 'Recompensa de R$ 0,05 Recebida!';
            }
        } catch (error: any) {
            console.error(error);
            if (error.response?.data?.message) {
                rewardMsg = `Aviso: ${error.response.data.message}`;
            }
        }

        // Abrir Smart Link (Monetização) em nova aba
        const adWindow = window.open('https://www.effectivegatecpm.com/ec4mxdzvs?key=a9eefff1a8aa7769523373a66ff484aa', '_blank');

        // Se o bloqueador de popvps barrar, o adWindow será nulo
        if (!adWindow) {
            console.warn("Popup bloqueado pelo navegador");
        }

        // Abrir Jogo no final (Redirecionar a guia atual ou abrir nova)
        // Para evitar bloqueio de múltiplos popups, vamos redirecionar a guia ATUAL para o jogo
        // E deixar o anúncio na guia nova
        setTimeout(() => {
            if (selectedGameUrl) {
                window.location.href = selectedGameUrl;
            }
            setShowAdModal(false);
            setLoadingAd(false);
            setAdCompleted(false);
            if (rewardMsg) alert(rewardMsg);
        }, 300);
    };

    // Navegar para Educação
    const handleEducation = () => {
        window.location.hash = '#/app/education';
    };

    const games = [
        {
            id: 1,
            title: 'Subway Surfers Online',
            description: 'Corra, pule e desvie dos trens para bater recordes.',
            image: 'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?q=80&w=1000&auto=format&fit=crop',
            url: 'https://poki.com.br/g/subway-surfers',
            reward: 'R$ 0,05',
            category: 'Ação'
        },
        {
            id: 2,
            title: 'Quiz de Finanças Cred30',
            description: 'Teste seus conhecimentos e ganhe pontos de score reais.',
            image: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?q=80&w=1000&auto=format&fit=crop',
            url: 'https://www.google.com/search?q=quiz+financeiro', // Fallback melhor
            reward: '+10 Score',
            category: 'Educação'
        },
        {
            id: 3,
            title: 'Moto X3M',
            description: 'Desafie a gravidade em pistas de motocross insanas.',
            image: 'https://images.unsplash.com/photo-1558981403-c5f97dbbe480?q=80&w=1000&auto=format&fit=crop',
            url: 'https://poki.com.br/g/moto-x3m',
            reward: 'R$ 0,05',
            category: 'Esporte'
        }
    ];

    return (
        <div className="space-y-6 pb-20 relative">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button onClick={onBack} className="text-zinc-400 hover:text-white transition">
                            <ArrowLeft size={24} />
                        </button>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Gamepad2 className="text-purple-500" />
                            Jogos & Diversão
                        </h1>
                        <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Jogue e Ganhe Recompensas</p>
                    </div>
                </div>
                <button
                    onClick={handleEducation}
                    className="flex flex-col items-center gap-1 bg-zinc-800/50 p-2 rounded-xl border border-zinc-700 hover:border-blue-500/50 transition"
                >
                    <BookOpen size={20} className="text-blue-400" />
                    <span className="text-[10px] font-bold text-zinc-300">Aprender</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {games.map(game => (
                    <div key={game.id} className="bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden group hover:border-purple-500/50 transition-all">
                        <div className="h-32 bg-zinc-800 relative overflow-hidden">
                            <img src={game.image} alt={game.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity group-hover:scale-105 duration-500" />
                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold text-white border border-white/10 uppercase">
                                {game.category}
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-lg font-bold text-white">{game.title}</h3>
                                <div className="bg-purple-500/10 text-purple-400 text-[10px] font-bold px-2 py-1 rounded border border-purple-500/20 flex items-center gap-1">
                                    <Trophy size={10} /> {game.reward}
                                </div>
                            </div>
                            <p className="text-xs text-zinc-400 mb-4">{game.description}</p>
                            <button
                                onClick={() => handlePlayGame(game.url)}
                                className="w-full bg-zinc-800 hover:bg-purple-600 hover:text-white text-zinc-300 py-3 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
                            >
                                <PlayCircle size={16} />
                                JOGAR AGORA
                            </button>
                        </div>
                    </div>
                ))}

                {/* Card "Em Breve" */}
                <div className="bg-surface/50 border border-surfaceHighlight border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
                    <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 mb-3">
                        <Gamepad2 size={24} />
                    </div>
                    <h3 className="text-zinc-500 font-bold mb-1">Mais Jogos em Breve</h3>
                    <p className="text-[10px] text-zinc-600 max-w-[200px]">Novos parceiros estão sendo integrados à plataforma.</p>
                </div>
            </div>

            {/* Ad Modal */}
            {showAdModal && (
                <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-0 max-w-lg w-full relative overflow-hidden shadow-2xl">
                        {!adCompleted && (
                            <button onClick={() => setShowAdModal(false)} className="absolute top-4 right-4 z-50 bg-black/50 text-white p-1 rounded-full hover:bg-black/80 transition">
                                <XIcon size={20} />
                            </button>
                        )}

                        {!adCompleted ? (
                            <PromoVideoPlayer
                                duration={5}
                                onComplete={handleAdFinished}
                            />
                        ) : (
                            <div className="p-8 text-center animate-in zoom-in duration-300">
                                <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-purple-400 animate-bounce">
                                    <Trophy size={40} />
                                </div>
                                <h2 className="text-2xl font-black text-white mb-2">Recompensa Liberada!</h2>
                                <p className="text-zinc-400 text-sm mb-8">
                                    Obrigado por apoiar a comunidade. Clique abaixo para acessar seu jogo.
                                </p>
                                <button
                                    onClick={handleManualClick}
                                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-xl shadow-lg shadow-purple-900/40 transition active:scale-95 flex items-center justify-center gap-2 text-lg"
                                >
                                    {loadingAd ? <RefreshCw className="animate-spin" /> : <PlayCircle />} ACESSAR JOGO
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
