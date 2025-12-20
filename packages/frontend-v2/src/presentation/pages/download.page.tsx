import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Smartphone, Share, Check, Chrome, Apple, MonitorSmartphone } from 'lucide-react';

// Interface para o evento de instalação do PWA
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DownloadPage = () => {
    const navigate = useNavigate();
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [installing, setInstalling] = useState(false);

    // Detectar o tipo de dispositivo
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isMobile = isIOS || isAndroid;

    useEffect(() => {
        window.scrollTo(0, 0);

        // Verificar se já está instalado (modo standalone)
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
            setIsInstalled(true);
        }

        // Capturar o evento de instalação do PWA
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Detectar quando o app for instalado
        window.addEventListener('appinstalled', () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
            setInstalling(false);
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        setInstalling(true);

        // Se tiver o prompt nativo, usa ele
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
            }
            setInstalling(false);
        } else {
            // Aguarda um pouco para dar feedback visual
            setTimeout(() => setInstalling(false), 500);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white selection:bg-cyan-500/30">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 w-full z-50 bg-zinc-950/50 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 py-3 sm:py-4">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <button
                        onClick={() => navigate('/')}
                        className="text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-sm font-bold group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        Voltar
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-white font-bold text-sm border border-white/10">
                            C
                        </div>
                        <span className="text-lg font-bold tracking-tight">Cred<span className="text-cyan-400">30</span></span>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 sm:pt-32 pb-20">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="w-24 h-24 bg-gradient-to-tr from-cyan-400 to-blue-600 rounded-3xl flex items-center justify-center text-black font-bold text-4xl mx-auto mb-6 shadow-2xl shadow-cyan-500/20">
                        C
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 tracking-tight">Baixar Cred30</h1>
                    <p className="text-zinc-400 text-lg max-w-md mx-auto">
                        Instale o app na sua tela inicial para acesso rápido e experiência completa.
                    </p>
                </div>

                {/* Status de Instalação */}
                {isInstalled ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-8 text-center mb-12">
                        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Check className="text-emerald-400" size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-emerald-400 mb-2">App Instalado!</h2>
                        <p className="text-zinc-400">O Cred30 já está instalado no seu dispositivo.</p>
                        <button
                            onClick={() => navigate('/auth')}
                            className="mt-6 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-8 rounded-xl transition"
                        >
                            Abrir App
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Botão Principal de Download */}
                        <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-8 text-center mb-12">
                            <button
                                onClick={handleInstallClick}
                                disabled={installing}
                                className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-600 text-black font-extrabold py-5 px-12 rounded-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 text-xl mx-auto"
                            >
                                {installing ? (
                                    <>
                                        <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                                        Instalando...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-6 h-6" />
                                        Instalar Agora
                                    </>
                                )}
                            </button>
                            <p className="text-zinc-500 text-sm mt-4">Grátis • Leve • Sem ocupar espaço</p>
                        </div>

                        {/* Instruções por Plataforma */}
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-center text-white mb-6">Como instalar</h2>

                            {/* iOS */}
                            <div className={`bg-zinc-900/30 border border-white/5 rounded-2xl p-6 ${isIOS ? 'ring-2 ring-cyan-500' : ''}`}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                        <Apple className="text-white" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">iPhone / iPad</h3>
                                        {isIOS && <span className="text-xs text-cyan-400">Seu dispositivo</span>}
                                    </div>
                                </div>
                                <ol className="space-y-3 text-zinc-400 text-sm">
                                    <li className="flex gap-3">
                                        <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-xs shrink-0">1</span>
                                        <span>Abra esta página no <strong className="text-white">Safari</strong></span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-xs shrink-0">2</span>
                                        <span>Toque no botão <Share className="inline text-cyan-400" size={16} /> <strong className="text-white">Compartilhar</strong></span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-xs shrink-0">3</span>
                                        <span>Role e toque em <strong className="text-white">"Adicionar à Tela de Início"</strong></span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-xs shrink-0">4</span>
                                        <span>Toque em <strong className="text-white">"Adicionar"</strong></span>
                                    </li>
                                </ol>
                            </div>

                            {/* Android */}
                            <div className={`bg-zinc-900/30 border border-white/5 rounded-2xl p-6 ${isAndroid ? 'ring-2 ring-cyan-500' : ''}`}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                        <Smartphone className="text-green-400" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">Android</h3>
                                        {isAndroid && <span className="text-xs text-cyan-400">Seu dispositivo</span>}
                                    </div>
                                </div>
                                <ol className="space-y-3 text-zinc-400 text-sm">
                                    <li className="flex gap-3">
                                        <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-xs shrink-0">1</span>
                                        <span>Abra esta página no <strong className="text-white">Chrome</strong></span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-xs shrink-0">2</span>
                                        <span>Toque no menu <strong className="text-white">⋮</strong> (três pontos)</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-xs shrink-0">3</span>
                                        <span>Toque em <strong className="text-white">"Adicionar à tela inicial"</strong></span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-xs shrink-0">4</span>
                                        <span>Confirme tocando em <strong className="text-white">"Adicionar"</strong></span>
                                    </li>
                                </ol>
                            </div>

                            {/* Desktop */}
                            <div className={`bg-zinc-900/30 border border-white/5 rounded-2xl p-6 ${!isMobile ? 'ring-2 ring-cyan-500' : ''}`}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                        <MonitorSmartphone className="text-blue-400" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">Computador</h3>
                                        {!isMobile && <span className="text-xs text-cyan-400">Seu dispositivo</span>}
                                    </div>
                                </div>
                                <ol className="space-y-3 text-zinc-400 text-sm">
                                    <li className="flex gap-3">
                                        <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-xs shrink-0">1</span>
                                        <span>Abra esta página no <strong className="text-white">Chrome, Edge ou Brave</strong></span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-xs shrink-0">2</span>
                                        <span>Clique no ícone <Download className="inline text-cyan-400" size={16} /> na barra de endereço</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-xs shrink-0">3</span>
                                        <span>Clique em <strong className="text-white">"Instalar"</strong></span>
                                    </li>
                                </ol>
                            </div>
                        </div>
                    </>
                )}

                {/* Benefícios */}
                <div className="mt-16 grid sm:grid-cols-3 gap-4">
                    <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-5 text-center">
                        <div className="text-2xl mb-2">⚡</div>
                        <h4 className="font-bold text-white text-sm">Acesso Rápido</h4>
                        <p className="text-zinc-500 text-xs mt-1">Abra direto da tela inicial</p>
                    </div>
                    <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-5 text-center">
                        <div className="text-2xl mb-2">📱</div>
                        <h4 className="font-bold text-white text-sm">Tela Cheia</h4>
                        <p className="text-zinc-500 text-xs mt-1">Experiência sem barra do navegador</p>
                    </div>
                    <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-5 text-center">
                        <div className="text-2xl mb-2">🔔</div>
                        <h4 className="font-bold text-white text-sm">Notificações</h4>
                        <p className="text-zinc-500 text-xs mt-1">Receba alertas importantes</p>
                    </div>
                </div>

                {/* Footer */}
                <footer className="mt-16 pt-8 border-t border-white/5 text-center">
                    <p className="text-zinc-600 text-xs">
                        Cred30 © 2024 - Todos os direitos reservados.
                    </p>
                </footer>
            </main>
        </div>
    );
};

export default DownloadPage;
