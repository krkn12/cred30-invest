import React from 'react';
import { Gamepad2, PlayCircle, Trophy, ArrowLeft } from 'lucide-react';

interface GamesViewProps {
    onBack?: () => void;
}

export const GamesView: React.FC<GamesViewProps> = ({ onBack }) => {
    const handlePlayGame = (url: string) => {
        window.open(url, '_blank');
    };

    const games = [
        {
            id: 1,
            title: 'Quiz de Educação Financeira',
            description: 'Teste seus conhecimentos e ganhe pontos de score.',
            image: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?q=80&w=1000&auto=format&fit=crop',
            url: 'https://kahoot.com', // Placeholder
            reward: '+2 Score',
            category: 'Educação'
        },
        {
            id: 2,
            title: 'Desafio da Fortuna',
            description: 'Jogue e ganhe recompensas diárias.',
            image: 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?q=80&w=1000&auto=format&fit=crop',
            url: 'https://poki.com', // Placeholder
            reward: 'R$ 0,02',
            category: 'Diversão'
        }
    ];

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
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
        </div>
    );
};
