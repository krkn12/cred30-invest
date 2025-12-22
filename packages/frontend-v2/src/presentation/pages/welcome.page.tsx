import React, { useState, useEffect } from 'react';
import { ArrowRight, Shield, PiggyBank, CreditCard, Download, Smartphone, X as XIcon, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Interface para o evento de instalação do PWA
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const WelcomePage = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const navigate = useNavigate();

  // Detectar iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  useEffect(() => {
    setIsLoaded(true);

    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsDownloading(false);
    });

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);

    // Chamada direta para evitar bloqueio de popup do navegador (Edge/Chrome exigem evento de clique síncrono)
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
      setIsDownloading(false);
    } else if (isIOS) {
      setShowIosGuide(true);
      setIsDownloading(false);
    } else {
      // Fallback simples se o navegador não suportar ou bloquear o prompt
      // Como o usuário pediu "download direto", se não der, avisamos o básico.
      alert('A instalação automática não está disponível neste navegador. Tente instalar pelo menu de opções.');
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white selection:bg-cyan-500/30 font-sans">
      {/* Background Aurora */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[50%] bg-blue-600/5 rounded-full blur-[100px]"></div>
      </div>

      {/* Nav */}
      <nav className={`relative z-10 px-6 py-8 transition-all duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-6xl mx-auto flex justify-between items-center bg-zinc-900/40 backdrop-blur-xl border border-white/5 p-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <img src="/pwa-192x192.png" alt="Cred30 Logo" width="40" height="40" className="w-10 h-10 rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.4)]" />
            <span className="text-xl font-bold tracking-tighter">Cred<span className="text-cyan-400">30</span></span>
          </div>
          <button onClick={() => navigate('/auth')} className="bg-white text-black font-bold px-6 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-white/10 text-sm">
            Entrar
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 pt-12 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full text-emerald-400 text-xs font-bold mb-8">
            <Shield size={14} /> Clube de Benefícios 100% Transparente
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight leading-[1] text-white">
            Cred<span className="text-cyan-400">30</span>: A comunidade que <br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent italic">valoriza</span> seu tempo.
          </h1>
          <p className="text-lg text-zinc-300 mb-10 max-w-xl mx-auto leading-relaxed">
            Torne-se membro em minutos e tenha acesso a recompensas exclusivas hoje com total segurança.
          </p>

          <div className="flex flex-col gap-4 max-w-md mx-auto">
            <button
              onClick={() => navigate('/auth')}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-black py-5 px-10 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 text-lg shadow-xl shadow-cyan-500/20"
            >
              Entrar no Clube
              <ArrowRight className="w-5 h-5" />
            </button>

            {/* BOTÃO DE DOWNLOAD DIRETO COM PROGRESSO */}
            {!isInstalled && (
              <button
                onClick={handleInstallClick}
                disabled={isDownloading}
                className="relative overflow-hidden bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-5 px-10 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 text-lg border border-zinc-700 disabled:opacity-90"
              >
                {/* Barra de Progresso Interna */}
                {isDownloading && (
                  <div
                    className="absolute inset-y-0 left-0 bg-cyan-500/20 transition-all duration-75"
                    style={{ width: `${downloadProgress}%` }}
                  />
                )}

                <div className="relative z-10 flex items-center gap-3">
                  {isDownloading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin"></div>
                      <span>Baixando {downloadProgress}%...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-6 h-6 text-cyan-400" />
                      <span>Baixar App Grátis</span>
                    </>
                  )}
                </div>
              </button>
            )}

            {/* Pedir Convite Button */}
            <a
              href="https://wa.me/5591980177874?text=Ol%C3%A1%2C%20quero%20um%20convite%20para%20o%20Cred30!"
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-cyan-400 hover:text-cyan-300 font-bold text-sm py-2 hover:underline transition-all"
            >
              Não tem convite? Peça o seu aqui
            </a>

            {isInstalled && (
              <div className="flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-6 py-4 rounded-2xl text-emerald-400 font-bold">
                <Smartphone className="w-5 h-5" />
                App Instalado com Sucesso ✓
              </div>
            )}

            <p className="text-zinc-400 text-xs font-medium">Download rápido • 0.5 MB • 100% Seguro</p>
          </div>
        </div>
      </section>

      {/* Footer Minimal */}
      <footer className="relative z-10 px-6 py-12">
        <div className="max-w-6xl mx-auto text-center border-t border-white/5 pt-8">
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-4">© 2024 Cred30 Plataforma Digital</p>
          <div className="flex justify-center gap-6 text-zinc-400 text-xs font-bold uppercase transition-colors">
            <button onClick={() => navigate('/terms')} className="hover:text-white">Termos</button>
            <button onClick={() => navigate('/privacy')} className="hover:text-white">Privacidade</button>
          </div>
        </div>
      </footer>

      {/* GUIA IOS (APENAS SETA E DOWNLOAD) */}
      {showIosGuide && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex flex-col items-center justify-end pb-20 px-6" onClick={() => setShowIosGuide(false)}>
          <div className="w-full max-w-xs text-center animate-bounce mb-8">
            <Download size={48} className="text-cyan-400 mx-auto mb-4" />
            <h3 className="text-xl font-black text-white mb-2">DOWNLOAD INICIADO!</h3>
            <p className="text-zinc-400 text-sm">Toque no ícone de <span className="text-white font-bold">compartilhar</span> abaixo e depois em <span className="text-white font-bold">"Adicionar à Tela de Início"</span></p>
          </div>

          <div className="text-cyan-500 animate-pulse">
            <ChevronDown size={64} />
          </div>

          <button onClick={() => setShowIosGuide(false)} className="mt-12 bg-zinc-800 text-white px-8 py-3 rounded-full font-bold text-sm">
            Fechar
          </button>
        </div>
      )}


    </main>
  );
};

export default WelcomePage;
