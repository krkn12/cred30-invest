import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Smartphone, Share, Check, MoreVertical } from 'lucide-react';

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

    useEffect(() => {
        window.scrollTo(0, 0);

        // Verificar se já está instalado
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
            setIsInstalled(true);
        }

        // Capturar o evento de instalação do PWA
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            // Tentar mostrar o prompt automaticamente
            setTimeout(() => {
                (e as BeforeInstallPromptEvent).prompt();
            }, 500);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        window.addEventListener('appinstalled', () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            setInstalling(true);
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
            }
            setInstalling(false);
        }
    };

    // Se já instalou, mostra sucesso
    if (isInstalled) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check className="text-emerald-400" size={48} />
                    </div>
                    <h1 className="text-3xl font-bold mb-4">App Instalado! ✓</h1>
                    <p className="text-zinc-400 mb-8">Procure o ícone do Cred30 na sua tela inicial.</p>
                    <button
                        onClick={() => navigate('/auth')}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 px-8 rounded-2xl"
                    >
                        Entrar no App
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
            {/* Header */}
            <nav className="px-4 py-4 flex items-center justify-between">
                <button onClick={() => navigate('/')} className="text-zinc-500 hover:text-white p-2">
                    <ArrowLeft size={24} />
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-tr from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center text-black font-bold text-sm">
                        C
                    </div>
                    <span className="font-bold">Cred30</span>
                </div>
                <div className="w-10"></div>
            </nav>

            {/* Conteúdo Principal */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                {/* Logo Grande */}
                <div className="w-28 h-28 bg-gradient-to-tr from-cyan-400 to-blue-600 rounded-3xl flex items-center justify-center text-black font-bold text-5xl mb-8 shadow-2xl shadow-cyan-500/30">
                    C
                </div>

                <h1 className="text-3xl font-extrabold mb-3">Baixar Cred30</h1>

                {/* Instruções Visuais Simples */}
                {isIOS ? (
                    // iOS - Safari
                    <div className="w-full max-w-sm">
                        <p className="text-zinc-400 mb-8">Toque nos ícones abaixo:</p>

                        <div className="flex items-center justify-center gap-4 mb-8">
                            {/* Passo 1 */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center border-2 border-cyan-500">
                                    <Share className="text-cyan-400" size={28} />
                                </div>
                                <span className="text-xs text-zinc-500">1. Compartilhar</span>
                            </div>

                            <div className="text-zinc-600 text-2xl">→</div>

                            {/* Passo 2 */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center border-2 border-cyan-500">
                                    <span className="text-cyan-400 text-2xl">+</span>
                                </div>
                                <span className="text-xs text-zinc-500 text-center">2. Adicionar<br />à Tela</span>
                            </div>
                        </div>

                        <div className="bg-zinc-900 rounded-2xl p-4 text-zinc-400 text-sm">
                            📱 Use o <strong className="text-white">Safari</strong> para instalar
                        </div>
                    </div>
                ) : isAndroid ? (
                    // Android - Chrome
                    <div className="w-full max-w-sm">
                        <p className="text-zinc-400 mb-8">Toque nos ícones abaixo:</p>

                        <div className="flex items-center justify-center gap-4 mb-8">
                            {/* Passo 1 */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center border-2 border-cyan-500">
                                    <MoreVertical className="text-cyan-400" size={28} />
                                </div>
                                <span className="text-xs text-zinc-500">1. Menu ⋮</span>
                            </div>

                            <div className="text-zinc-600 text-2xl">→</div>

                            {/* Passo 2 */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center border-2 border-cyan-500">
                                    <Download className="text-cyan-400" size={28} />
                                </div>
                                <span className="text-xs text-zinc-500 text-center">2. Instalar<br />App</span>
                            </div>
                        </div>

                        {deferredPrompt && (
                            <button
                                onClick={handleInstallClick}
                                disabled={installing}
                                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold py-5 rounded-2xl text-lg flex items-center justify-center gap-3"
                            >
                                {installing ? (
                                    <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Download size={24} />
                                        Instalar Agora
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                ) : (
                    // Desktop
                    <div className="w-full max-w-sm">
                        {deferredPrompt ? (
                            <button
                                onClick={handleInstallClick}
                                disabled={installing}
                                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold py-5 rounded-2xl text-lg flex items-center justify-center gap-3 mb-6"
                            >
                                {installing ? (
                                    <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Download size={24} />
                                        Instalar Agora
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="bg-zinc-900 rounded-2xl p-6 text-center">
                                <Download className="text-cyan-400 mx-auto mb-4" size={40} />
                                <p className="text-zinc-400 text-sm">
                                    Clique no ícone <strong className="text-white">⊕</strong> na barra de endereço do navegador
                                </p>
                            </div>
                        )}

                        <p className="text-zinc-600 text-xs mt-6 text-center">
                            💡 Melhor experiência no celular
                        </p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-6 text-center">
                <button
                    onClick={() => navigate('/auth')}
                    className="text-zinc-500 hover:text-white text-sm"
                >
                    Continuar no navegador →
                </button>
            </div>
        </div>
    );
};

export default DownloadPage;
