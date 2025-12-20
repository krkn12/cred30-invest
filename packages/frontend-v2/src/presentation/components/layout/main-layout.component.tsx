import React, { useEffect } from 'react';
import { LogOut, Home, PieChart, DollarSign, Settings, TrendingUp, ArrowUpFromLine, Gamepad2, ShoppingBag } from 'lucide-react';
import { AdBanner } from '../ui/AdBanner';
import { useNavigate } from 'react-router-dom';
import { User } from '../../../domain/types/common.types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  currentView: string;
  onChangeView: (view: any) => void;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, currentView, onChangeView, onLogout }) => {
  const navigate = useNavigate();
  const [installPrompt, setInstallPrompt] = React.useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Timer de Logout Automático (5 minutos de inatividade)
  useEffect(() => {
    if (!user) return;

    let logoutTimer: NodeJS.Timeout;

    const resetTimer = () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      logoutTimer = setTimeout(() => {
        console.log('Sessão expirada por inatividade (5 minutos)');
        onLogout();
      }, 5 * 60 * 1000); // 5 minutos
    };

    // Eventos que indicam atividade do usuário
    const activityEvents = [
      'mousedown', 'mousemove', 'keypress',
      'scroll', 'touchstart', 'click'
    ];

    // Inicializar timer
    resetTimer();

    // Adicionar ouvintes
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user, onLogout]);

  const handleInstallClick = () => {
    if (installPrompt) {
      installPrompt.prompt();
      setInstallPrompt(null);
    }
  };

  const handleNavigation = (view: string) => {
    onChangeView(view);
    navigate(`/app/${view}`);
  }

  // Sincronizar URL inicial com estado removido para evitar loops e permitindo navegação direta via URL

  if (!user) return <div className="min-h-screen bg-background text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">{children}</div>;

  const navItems = [
    { id: 'dashboard', label: 'Início', icon: Home },
    { id: 'store', label: 'Loja', icon: ShoppingBag },
    { id: 'invest', label: 'Investir', icon: TrendingUp },
    { id: 'games', label: 'Jogos', icon: Gamepad2 },
    { id: 'portfolio', label: 'Carteira', icon: PieChart },
    { id: 'loans', label: 'Empréstimos', icon: DollarSign },
    { id: 'withdraw', label: 'Sacar', icon: ArrowUpFromLine },
  ];

  return (
    <div className="min-h-screen bg-background text-zinc-100 flex flex-col md:flex-row font-sans">
      {/* Mobile Header com Saldo e Install Btn */}
      <div className="md:hidden bg-surface border-b border-surfaceHighlight p-4 flex justify-between items-center sticky top-0 z-20 shadow-md">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-primary-400 to-primary-600 rounded-lg flex items-center justify-center text-black font-bold shadow-[0_0_10px_rgba(34,211,238,0.3)]">C</div>
          <span className="text-white">Cred<span className="text-primary-400">30</span></span>
        </h1>

        {user && (
          <div className="flex items-center gap-2">
            {installPrompt && (
              <button onClick={handleInstallClick} className="bg-primary-600 text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse">
                INSTALAR APP
              </button>
            )}
            <div className="bg-zinc-800 px-3 py-1.5 rounded-full border border-zinc-700 flex items-center gap-2">
              <span className="text-xs text-zinc-400">Saldo</span>
              <span className="text-sm font-bold text-emerald-400">
                {user.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <button onClick={onLogout} className="text-zinc-400 p-1" title="Sair"><LogOut size={20} /></button>
          </div>
        )}
      </div>

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-72 bg-surface border-r border-surfaceHighlight h-screen sticky top-0">
        <div className="p-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2 tracking-tighter">
            <div className="w-10 h-10 bg-gradient-to-tr from-primary-400 to-primary-600 rounded-xl flex items-center justify-center text-black font-bold text-xl shadow-[0_0_15px_rgba(34,211,238,0.5)]">
              C
            </div>
            Cred<span className="text-primary-400">30</span>
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-4 text-sm font-medium rounded-xl transition-all duration-200 ${currentView === item.id
                ? 'bg-primary-400/10 text-primary-400 border border-primary-400/20'
                : 'text-zinc-400 hover:bg-surfaceHighlight hover:text-white'
                }`}
            >
              <item.icon size={22} className={currentView === item.id ? 'stroke-[2.5px]' : ''} />
              {item.label}
            </button>
          ))}

          {/* Desktop Sidebar Ad - Monetização Extra */}
          <div className="pt-4">
            <AdBanner type="NATIVE" title="Dica Exclusiva" description="Aumente seu score hoje." />
          </div>
        </nav>
        <div className="p-4 border-t border-surfaceHighlight">
          <button
            onClick={() => handleNavigation('settings')}
            className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-medium rounded-xl transition-colors mb-4 ${currentView === 'settings' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            <Settings size={20} />
            Configurações
          </button>
          <div className="flex items-center gap-3 px-4 py-3 bg-surfaceHighlight/50 rounded-xl border border-surfaceHighlight">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center font-bold text-primary-400 border border-zinc-700">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user.name}</p>
              <p className="text-xs text-zinc-500 truncate">{user.email}</p>
            </div>
            <button onClick={onLogout} className="text-zinc-500 hover:text-red-400 transition" title="Sair" aria-label="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto space-y-8 pb-32">
          {children}

          <footer className="mt-16 pt-8 border-t border-surfaceHighlight text-center space-y-2">
            <p className="text-xs text-zinc-500">Cred30 © 2024 • Sistema de Cooperação Financeira Mútua</p>
            <div className="flex justify-center gap-4 text-[10px] text-zinc-600">
              <button onClick={() => navigate('/terms')} className="hover:text-primary-400">Termos de Uso</button>
              <span>•</span>
              <button onClick={() => navigate('/terms')} className="hover:text-primary-400">Política de Privacidade</button>
            </div>
            <p className="text-[9px] text-zinc-700 max-w-md mx-auto italic">O Cred30 não é uma instituição financeira regulada pelo BACEN. As operações são baseadas no Código Civil Brasileiro (Sociedade em Conta de Participação e Mútua).</p>
          </footer>
        </div>
      </main>

      {/* Mobile Bottom Nav - Floating Dock (Elevado para não cobrar o Ad) */}
      <div className="md:hidden fixed bottom-[160px] left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-2xl flex justify-between items-center px-4 py-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] z-30">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavigation(item.id)}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all relative ${currentView === item.id
              ? 'text-primary-400 -translate-y-2'
              : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            <div className={`p-2 rounded-full transition-all ${currentView === item.id ? 'bg-primary-400/20 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : ''}`}>
              <item.icon size={22} strokeWidth={currentView === item.id ? 2.5 : 2} />
            </div>
            {currentView === item.id && <span className="absolute -bottom-4 w-1 h-1 bg-primary-400 rounded-full"></span>}
          </button>
        ))}
      </div>

      {/* Sticky Ad Footer (Sempre Visível Desktop & Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] bg-black border-t border-zinc-800 p-1 pb-1 md:pl-72 transition-all duration-300">
        <div className="mx-auto max-w-md md:max-w-2xl">
          <AdBanner type="BANNER" title="Parceiro em Destaque" description="Confira esta oferta especial para membros Cred30." actionText="VER OFERTA" />
        </div>
      </div>
    </div>
  );
};