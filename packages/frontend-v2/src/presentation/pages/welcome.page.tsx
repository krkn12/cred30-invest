import React, { useState, useEffect } from 'react';
import { ArrowRight, Shield, PiggyBank, CreditCard, Download, Smartphone, X as XIcon, Share } from 'lucide-react';
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
  const [showInstallModal, setShowInstallModal] = useState(false);
  const navigate = useNavigate();

  // Detectar o tipo de dispositivo
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  const stats = [
    { value: "R$ 50", label: "Cota Mínima" },
    { value: "85%", label: "Lucro Rateado" },
    { value: "PIX", label: "Aportes e Resgates" },
    { value: "24/7", label: "Disponibilidade" }
  ];

  const coreFeatures = [
    {
      icon: <PiggyBank className="w-6 h-6" />,
      title: "Investimentos",
      desc: "Cotas a partir de R$ 50,00 com rendimento diário real."
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: "Crédito Instantâneo",
      desc: "Empréstimos aprovados baseados no seu score interno."
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Segurança Total",
      desc: "Segurança de alto nível e garantias baseadas em lastro real e transparente."
    }
  ];

  useEffect(() => {
    setIsLoaded(true);

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
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    // Se tiver o prompt nativo, usa ele
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // Se não tiver, mostra o modal com instruções
      setShowInstallModal(true);
    }
  };

  const handleGetStarted = () => {
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-cyan-500/30">
      {/* Aurora Background Effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[50%] bg-blue-600/5 rounded-full blur-[100px]"></div>
      </div>

      {/* Navigation */}
      <nav className={`relative z-10 px-6 py-8 transition-all duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-6xl mx-auto flex justify-between items-center bg-zinc-900/40 backdrop-blur-xl border border-white/5 p-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center text-black font-bold text-xl">
              C
            </div>
            <span className="text-xl font-bold tracking-tight">Cred<span className="text-cyan-400">30</span></span>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={handleGetStarted}
              className="text-white/70 hover:text-white transition-colors font-medium text-sm"
            >
              Já sou membro (Entrar)
            </button>
            <button
              onClick={handleGetStarted}
              className="bg-white text-black font-bold px-6 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-white/10"
            >
              Participar
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-20 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className={`inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full text-emerald-400 text-sm font-bold mb-8 transition-all duration-700 delay-100 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <Shield size={16} /> Sistema Cooperativo 100% Transparente
          </div>
          <h1 className={`text-6xl md:text-8xl font-extrabold mb-8 tracking-tighter leading-[0.9] transition-all duration-1000 delay-200 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            A cooperativa que <br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent italic">valoriza</span> seu tempo.
          </h1>
          <p className={`text-xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed transition-all duration-1000 delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            Simples, transparente e desenhado para o futuro.
            Torne-se membro em minutos e comece a rentabilizar seu capital hoje.
          </p>
          <div className={`flex flex-col sm:flex-row gap-4 justify-center transition-all duration-1000 delay-400 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <button
              onClick={handleGetStarted}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold py-5 px-10 rounded-2xl transition-all hover:scale-105 flex items-center justify-center gap-3 text-lg"
            >
              Filiar-se agora
              <ArrowRight className="w-5 h-5" />
            </button>

            {/* Botão Instalar App - sempre visível se não instalado */}
            {!isInstalled && (
              <button
                onClick={handleInstallClick}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-5 px-8 rounded-2xl transition-all hover:scale-105 flex items-center justify-center gap-3 text-lg border border-zinc-700"
              >
                <Download className="w-5 h-5" />
                Baixar App
              </button>
            )}

            {/* Badge de app instalado */}
            {isInstalled && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-6 py-4 rounded-2xl text-emerald-400 font-medium">
                <Smartphone className="w-5 h-5" />
                App Instalado ✓
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Dynamic Stats Grid */}
      <section className={`relative z-10 px-6 py-12 transition-all duration-1000 delay-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm">
            {stats.map((stat, index) => (
              <div key={index} className="bg-zinc-950 p-10 text-center hover:bg-zinc-900/50 transition-colors group">
                <div className="text-3xl md:text-5xl font-extrabold text-white mb-2 group-hover:text-cyan-400 transition-colors uppercase">{stat.value}</div>
                <div className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Minimal Features Card */}
      <section className={`relative z-10 px-6 py-24 transition-all duration-1000 delay-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          {coreFeatures.map((f, i) => (
            <div key={i} className="bg-zinc-900/30 border border-white/5 p-8 rounded-3xl hover:bg-zinc-900/50 transition-all group">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-cyan-400 mb-6 group-hover:bg-cyan-500 group-hover:text-black transition-all">
                {f.icon}
              </div>
              <h3 className="text-2xl font-bold mb-3">{f.title}</h3>
              <p className="text-zinc-400 leading-relaxed text-sm">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer Minimalist */}
      <footer className="relative z-10 px-6 py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-white font-bold text-sm border border-white/10">
              C
            </div>
            <span className="text-lg font-bold">Cred30</span>
          </div>
          <div className="flex gap-8 text-zinc-500 text-sm font-medium">
            <button onClick={() => navigate('/terms')} className="hover:text-white transition-colors">Termos</button>
            <button onClick={() => navigate('/privacy')} className="hover:text-white transition-colors">Privacidade</button>
            <button onClick={() => navigate('/security')} className="hover:text-white transition-colors">Segurança</button>
          </div>
          <p className="text-zinc-600 text-xs">
            © 2024 Cred30. Tecnologia para liberdade financeira.
          </p>
        </div>
      </footer>

      {/* Modal de Instruções de Instalação */}
      {showInstallModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowInstallModal(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-md relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowInstallModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white">
              <XIcon size={24} />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-cyan-400 mx-auto mb-4">
                <Smartphone size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Instalar Cred30</h3>
              <p className="text-zinc-400 text-sm">Adicione o app à sua tela inicial para acesso rápido!</p>
            </div>

            {isIOS ? (
              <div className="space-y-4">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs">1</span>
                  Toque no botão Compartilhar
                </h4>
                <div className="flex items-center justify-center bg-zinc-800 p-4 rounded-xl">
                  <Share className="text-cyan-400" size={32} />
                </div>
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs">2</span>
                  Toque em "Adicionar à Tela de Início"
                </h4>
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs">3</span>
                  Toque em "Adicionar"
                </h4>
              </div>
            ) : isAndroid ? (
              <div className="space-y-4">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs">1</span>
                  Toque no menu do navegador (⋮)
                </h4>
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs">2</span>
                  Toque em "Adicionar à tela inicial"
                </h4>
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs">3</span>
                  Confirme tocando em "Adicionar"
                </h4>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs">1</span>
                  No Chrome, clique no ícone de instalação na barra de endereço
                </h4>
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs">2</span>
                  Clique em "Instalar"
                </h4>
                <p className="text-zinc-500 text-xs text-center mt-4">
                  Se não aparecer, tente acessar pelo celular para uma experiência melhor.
                </p>
              </div>
            )}

            <button
              onClick={() => setShowInstallModal(false)}
              className="w-full mt-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WelcomePage;
