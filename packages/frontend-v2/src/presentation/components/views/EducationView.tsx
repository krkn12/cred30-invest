import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, PlayCircle, Clock, Trophy, AlertTriangle, CheckCircle2, X as XIcon, BrainCircuit, MousePointerClick, ArrowLeft } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

interface EducationViewProps {
    onBack: () => void;
    onSuccess: (title: string, msg: string) => void;
}

const POINTS_PER_SECOND = 0.5; // ~30 pontos por minuto. 1000 pontos = ~33 min. 
const POINTS_TO_CURRENCY_RATE = 0.29 / 1000; // 1000 pontos = R$ 0.29

export const EducationView: React.FC<EducationViewProps> = ({ onBack, onSuccess }) => {
    // Estados da Aula
    const [selectedLesson, setSelectedLesson] = useState<any>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // Estados de Farm e Pontos
    const [sessionPoints, setSessionPoints] = useState(0);
    const [totalPoints, setTotalPoints] = useState(0); // Acumulado persistente (mock por enquanto)
    const [sessionTime, setSessionTime] = useState(0);

    // Anti-Cheat States
    const [isTabFocused, setIsTabFocused] = useState(true);
    const [lastInteraction, setLastInteraction] = useState(Date.now());
    const [showPresenceCheck, setShowPresenceCheck] = useState(false);
    const [presenceTimer, setPresenceTimer] = useState(0);
    const [isBlocked, setIsBlocked] = useState(false);
    const [generatedCode, setGeneratedCode] = useState('');
    const [inputCode, setInputCode] = useState('');

    const interactionTimeout = 60000; // 1 minuto sem mexer pede check
    const presenceTimeout = 15000; // 15 segundos para responder o check

    // Aulas Mock
    const lessons = [
        {
            id: 1,
            title: "Live: Como Negociar Dívidas (Sebrae)",
            duration: "55:00",
            category: "Finanças Básicas",
            videoUrl: "https://www.youtube.com/embed/yYyP1tX4c2o",
            thumbnail: "/images/education/managing-debts.png"
        },
        {
            id: 2,
            title: "B3 Explica: Como Começar a Investir",
            duration: "04:30",
            category: "Investimentos",
            videoUrl: "https://www.youtube.com/embed/kYjY1tQ_j9o",
            thumbnail: "/images/education/investing-small.png"
        },
        {
            id: 3,
            title: "Score 2.0: Aumente sua Pontuação",
            duration: "05:15",
            category: "Score & Crédito",
            videoUrl: "https://www.youtube.com/embed/kYc24d1a-O0",
            thumbnail: "/images/education/credit-score.png"
        }
    ];

    // Monitoramento de Foco na Aba
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                setIsTabFocused(false);
                setIsPlaying(false); // Pausa se sair
            } else {
                setIsTabFocused(true);
            }
        };

        const handleInteraction = () => {
            setLastInteraction(Date.now());
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('mousemove', handleInteraction);
        window.addEventListener('keydown', handleInteraction);
        window.addEventListener('click', handleInteraction);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('mousemove', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
            window.removeEventListener('click', handleInteraction);
        };
    }, []);

    // Loop Principal de Pontos e Checagem
    useEffect(() => {
        let interval: any;

        if (selectedLesson && !isBlocked) {
            interval = setInterval(() => {
                const timeSinceLastInteraction = Date.now() - lastInteraction;

                // 1. Checagem de Foco
                if (!isTabFocused) return; // Não conta ponto se aba oculta

                // 2. Checagem de Presença (Anti-Bot)
                if (timeSinceLastInteraction > interactionTimeout && !showPresenceCheck) {
                    setShowPresenceCheck(true);
                    setGeneratedCode(Math.floor(1000 + Math.random() * 9000).toString()); // Gera código 1000-9999
                    setInputCode(''); // Limpa input anterior
                    setPresenceTimer(presenceTimeout / 1000);
                    return;
                }

                // 3. Contagem regressiva do Check de Presença
                if (showPresenceCheck) {
                    setPresenceTimer(prev => {
                        if (prev <= 1) {
                            // Falhou no check
                            setIsBlocked(true);
                            setShowPresenceCheck(false);
                            setIsPlaying(false);
                            return 0;
                        }
                        return prev - 1;
                    });
                    return; // Não ganha ponto enquanto o modal está aberto
                }

                // *** GANHO DE PONTOS ***
                if (isPlaying && !showPresenceCheck) {
                    setSessionPoints(prev => prev + POINTS_PER_SECOND);
                    setSessionTime(prev => prev + 1);
                }

            }, 1000);
        }

        return () => clearInterval(interval);
    }, [selectedLesson, isPlaying, isTabFocused, lastInteraction, showPresenceCheck, isBlocked]);

    // Calcular Ganhos
    const currentEarnings = sessionPoints * POINTS_TO_CURRENCY_RATE;

    const handleLessonSelect = (lesson: any) => {
        setSelectedLesson(lesson);
        setIsPlaying(true);
        setSessionPoints(0);
        setSessionTime(0);
        setIsBlocked(false);
        setLastInteraction(Date.now());
    };

    const handlePresenceConfirm = () => {
        setShowPresenceCheck(false);
        setLastInteraction(Date.now());
        setIsPlaying(true);
    };

    const handleExitLesson = async () => {
        setIsPlaying(false);
        // Salvar pontos acumulados se houver ganhos
        if (sessionPoints > 50) { // Mínimo de 50 pontos para requisitar (evita spam)
            try {
                await apiService.post('/education/reward', { points: Math.floor(sessionPoints), lessonId: selectedLesson.id });
                onSuccess("Sessão Finalizada", `Parabéns! Você ganhou R$ ${currentEarnings.toFixed(4)} e ${sessionPoints.toFixed(0)} pontos!`);
            } catch (error: any) {
                // Erro 429 = Limite momentâneo
                if (error.response?.status === 429 || error.message?.includes('Limite')) {
                    onSuccess("Pontos Salvos", "O Fundo de Recompensas atingiu o limite momentâneo. Seus pontos foram salvos e serão processados em breve.");
                } else {
                    console.error(error);
                    // Fallback amigável
                    onSuccess("Sessão Finalizada", "Seus pontos foram contabilizados no sistema.");
                }
            }
        } else if (sessionPoints > 0) {
            // Feedback para poucos pontos
            onSuccess("Sessão Curta", "Estude um pouco mais para ganhar recompensas significativas!");
        }

        setSelectedLesson(null);
        setSessionPoints(0);
        setSessionTime(0);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-6 pb-20 relative min-h-screen">
            {/* Header */}
            {!selectedLesson && (
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={onBack} className="text-zinc-400 hover:text-white transition">
                        <XIcon size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <BookOpen className="text-blue-500" />
                            Cred30 Academy
                        </h1>
                        <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Estude e Monetize seu Tempo</p>
                    </div>
                </div>
            )}

            {/* Lista de Aulas */}
            {!selectedLesson ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lessons.map(lesson => (
                        <div key={lesson.id} onClick={() => handleLessonSelect(lesson)} className="bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden group hover:border-blue-500/50 transition-all cursor-pointer">
                            <div className="aspect-video bg-zinc-800 relative">
                                <img src={lesson.thumbnail} alt={lesson.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                                        <PlayCircle className="text-white" size={24} />
                                    </div>
                                </div>
                                <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-[10px] text-white font-bold">
                                    {lesson.duration}
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="text-[10px] text-blue-400 font-bold uppercase mb-1">{lesson.category}</div>
                                <h3 className="text-white font-bold leading-tight mb-2">{lesson.title}</h3>
                                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                    <Trophy size={12} className="text-yellow-500" />
                                    <span>Ganhe até R$ 0,29 a cada 1k pts</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Modo Sala de Aula */
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-300">
                    <div className="flex items-center justify-between bg-zinc-900/50 p-2 rounded-xl">
                        <button onClick={handleExitLesson} className="flex items-center gap-2 text-zinc-400 hover:text-red-400 transition text-xs font-bold px-2">
                            <ArrowLeft size={16} /> SAIR DA AULA
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase">Tempo de Estudo</span>
                                <span className="text-white font-mono font-bold">{formatTime(sessionTime)}</span>
                            </div>
                            <div className="h-8 w-px bg-zinc-800"></div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase">Pontos</span>
                                <span className="text-yellow-400 font-mono font-bold flex items-center gap-1">
                                    <Trophy size={12} /> {sessionPoints.toFixed(0)}
                                </span>
                            </div>
                            <div className="h-8 w-px bg-zinc-800"></div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase">Ganhos</span>
                                <span className="text-emerald-400 font-mono font-bold">R$ {currentEarnings.toFixed(4)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Aviso Anti-Farm */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-start gap-3">
                        <BrainCircuit size={18} className="text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-zinc-400 leading-tight">
                            <strong className="text-blue-400 block mb-1">Sistema Anti-Farm Ativo</strong>
                            Mantenha a aba aberta e interaja com a aula. Se mudar de aba ou ficar inativo por muito tempo, a contagem de pontos será pausada automaticamente.
                        </p>
                    </div>

                    {/* Área do Vídeo */}
                    <div className={`aspect-video bg-black rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl relative ${isBlocked ? 'grayscale opacity-50' : ''}`}>
                        {!isBlocked ? (
                            <iframe
                                width="100%"
                                height="100%"
                                src={`${selectedLesson.videoUrl}?autoplay=0&controls=1&rel=0`}
                                title={selectedLesson.title}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; compute-pressure"
                                allowFullScreen
                                className="z-10 relative" // Permitir interação
                            ></iframe>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-zinc-900">
                                <AlertTriangle size={48} className="text-red-500 mb-4 animate-bounce" />
                                <h2 className="text-2xl font-bold text-white mb-2">Sessão Bloqueada</h2>
                                <p className="text-zinc-400 text-sm mb-6">Detectamos inatividade prolongada. Para continuar acumulando pontos, você precisa reiniciar a aula.</p>
                                <button onClick={handleExitLesson} className="bg-red-500 hover:bg-red-400 text-white font-bold py-3 px-8 rounded-xl transition">
                                    Encerrar Sessão
                                </button>
                            </div>
                        )}

                        {/* Overlay de Pausa por Foco */}
                        {!isTabFocused && !isBlocked && (
                            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center text-center z-50">
                                <Clock size={48} className="text-yellow-500 mb-4 animate-pulse" />
                                <h3 className="text-xl font-bold text-white">Sessão Pausada</h3>
                                <p className="text-zinc-400 text-sm mt-2">Volte para esta aba para continuar ganhando pontos.</p>
                            </div>
                        )}

                        {/* Modal Check de Presença */}
                        {showPresenceCheck && !isBlocked && (
                            <div className="absolute inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 z-[60] animate-in zoom-in duration-200">
                                <div className="bg-zinc-900 border border-blue-500/30 p-6 rounded-3xl w-full max-w-[320px] text-center shadow-2xl shadow-blue-900/20 relative">
                                    <div className="w-14 h-14 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-400 border border-blue-500/20">
                                        <MousePointerClick size={28} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-1">Checagem Rápida</h3>
                                    <p className="text-zinc-400 text-xs mb-6 px-4">Digite o código para provar que você está assistindo:</p>

                                    <div className="bg-black/60 p-4 rounded-2xl mb-4 border border-zinc-800 flex justify-center items-center gap-1">
                                        {generatedCode.split('').map((digit, i) => (
                                            <span key={i} className="text-2xl font-mono font-black text-blue-400 w-8 h-10 flex items-center justify-center bg-blue-500/5 rounded mx-0.5">{digit}</span>
                                        ))}
                                    </div>

                                    <input
                                        type="tel"
                                        pattern="[0-9]*"
                                        maxLength={4}
                                        value={inputCode}
                                        onChange={(e) => setInputCode(e.target.value.slice(0, 4))}
                                        placeholder="0000"
                                        className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl p-4 text-center font-bold text-2xl mb-2 focus:ring-2 focus:ring-blue-500 outline-none tracking-widest placeholder-zinc-700"
                                        autoFocus
                                    />

                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase mb-4 px-2">
                                        <span className={presenceTimer < 5 ? "text-red-500 animate-pulse" : "text-zinc-500"}>Expira em: {presenceTimer}s</span>
                                        <span className={inputCode.length === 4 ? (inputCode === generatedCode ? "text-emerald-500" : "text-red-500") : "text-zinc-600"}>
                                            {inputCode.length === 4 ? (inputCode === generatedCode ? "Código Correto" : "Código Inválido") : "Aguardando..."}
                                        </span>
                                    </div>

                                    <button
                                        onClick={handlePresenceConfirm}
                                        disabled={inputCode !== generatedCode}
                                        className={`w-full font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm uppercase ${inputCode === generatedCode ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40 scale-105' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700'}`}
                                    >
                                        <CheckCircle2 size={18} /> Confirmar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
