import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '../components/layout/main-layout.component';
import { UpdateNotification } from '../components/ui/update-notification.component';
import { loadState, logoutUser, buyQuota, sellQuota, sellAllQuotas, requestLoan, repayLoan, repayInstallment, changePassword, upgradePro, claimAdReward, apiService } from '../../application/services/storage.service';
import { syncService } from '../../application/services/sync.service';
import { AppState, Quota, Loan, Transaction, User } from '../../domain/types/common.types';
import { QUOTA_PRICE } from '../../shared/constants/app.constants';
import { calculateTotalToPay } from '../../shared/utils/financial.utils';
import { Check, X as XIcon, RefreshCw, AlertTriangle, Users, Copy, Wallet, TrendingUp, ArrowUpFromLine, Lock, Download } from 'lucide-react';
import { PIXModal } from '../components/ui/pix-modal.component';
import { CardModal } from '../components/ui/card-modal.component';
import { AuthScreen } from '../components/views/AuthScreen';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ReviewModal } from '../components/ui/ReviewModal';
import { AIAssistant } from '../components/AIAssistant';
import { OfflineNotice } from '../components/ui/offline-notice.component';
import { useOnlineStatus } from '../hooks/use-online-status';
import { PWAEnforcer, isPWAInstalled, usePWAInstall } from '../components/ui/pwa-enforcer.component';

// Helper para lidar com erro de carregamento de chunks (comum após deploys)
const lazyWithRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.localStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.localStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        window.localStorage.setItem('page-has-been-force-refreshed', 'true');
        return window.location.reload();
      }
      throw error;
    }
  });

// Lazy imports for views
const WelcomePage = lazyWithRetry(() => import('./welcome.page'));
const TermsPage = lazyWithRetry(() => import('./terms.page'));
const PrivacyPage = lazyWithRetry(() => import('./privacy.page'));
const SecurityPage = lazyWithRetry(() => import('./security.page'));
const Dashboard = lazyWithRetry(() => import('../components/views/Dashboard').then(m => ({ default: m.Dashboard })));
const SettingsView = lazyWithRetry(() => import('../components/views/SettingsView').then(m => ({ default: m.SettingsView })));
const InvestView = lazyWithRetry(() => import('../components/views/InvestView').then(m => ({ default: m.InvestView })));
const PortfolioView = lazyWithRetry(() => import('../components/views/PortfolioView').then(m => ({ default: m.PortfolioView })));
const LoansView = lazyWithRetry(() => import('../components/views/LoansView').then(m => ({ default: m.LoansView })));
const WithdrawView = lazyWithRetry(() => import('../components/views/WithdrawView').then(m => ({ default: m.WithdrawView })));
const AdminView = lazyWithRetry(() => import('../components/views/AdminView').then(m => ({ default: m.AdminView })));
const HistoryView = lazyWithRetry(() => import('../components/views/HistoryView').then(m => ({ default: m.HistoryView })));
const MarketplaceView = lazyWithRetry(() => import('../components/views/MarketplaceView').then(m => ({ default: m.MarketplaceView })));
const EarnView = lazyWithRetry(() => import('../components/views/EarnView').then(m => ({ default: m.EarnView })));
const GamesView = lazyWithRetry(() => import('../components/views/GamesView').then(m => ({ default: m.GamesView })));
const EducationView = lazyWithRetry(() => import('../components/views/EducationView').then(m => ({ default: m.EducationView })));
const FaqView = lazyWithRetry(() => import('../components/views/FaqView').then(m => ({ default: m.FaqView })));
const VotingView = lazyWithRetry(() => import('../components/views/VotingView').then(m => ({ default: m.VotingView })));

// Componente de bloqueio para clientes tentando acessar via web (desktop E mobile)
const PWABlocker = () => {
  const { isInstallable, promptInstall } = usePWAInstall();
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Card principal de bloqueio */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-primary-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-primary-900/20 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 border border-primary-500/20">
            <Download className="text-primary-400" size={isMobile ? 32 : 40} />
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white mb-3 tracking-tight">
            Baixe o App Cred30
          </h1>

          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Para sua segurança, o acesso ao Cred30 via navegador web não é permitido.
            <br /><br />
            <strong className="text-white">Instale o aplicativo oficial</strong> para continuar.
          </p>

          {/* Alerta de segurança */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-start gap-3">
              <Lock className="text-emerald-400 shrink-0 mt-0.5" size={18} />
              <p className="text-emerald-200/80 text-xs leading-relaxed">
                O aplicativo instalado oferece proteção adicional contra phishing,
                mantém suas sessões mais seguras e garante que você está no sistema oficial.
              </p>
            </div>
          </div>

          {/* Botão de instalação */}
          {isInstallable ? (
            <button
              onClick={promptInstall}
              className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-3 transition shadow-lg shadow-primary-500/20 mb-4 active:scale-95"
            >
              <Download size={20} />
              INSTALAR APP CRED30
            </button>
          ) : (
            <div className="space-y-4">
              <p className="text-zinc-500 text-xs">
                Siga os passos abaixo para instalar:
              </p>

              {isIOS ? (
                // Instruções para iOS (Safari)
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-left">
                  <p className="text-xs text-zinc-400 mb-2 font-bold uppercase tracking-widest">📱 iPhone/iPad:</p>
                  <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside">
                    <li>Toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta ↑)</li>
                    <li>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></li>
                    <li>Toque em <strong>"Adicionar"</strong> no canto superior direito</li>
                    <li>Abra o app <strong>Cred30</strong> na sua tela inicial</li>
                  </ol>
                </div>
              ) : isMobile ? (
                // Instruções para Android
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-left">
                  <p className="text-xs text-zinc-400 mb-2 font-bold uppercase tracking-widest">📱 Android:</p>
                  <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside">
                    <li>Toque nos <strong>3 pontos (⋮)</strong> no canto superior direito</li>
                    <li>Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong></li>
                    <li>Confirme tocando em <strong>"Instalar"</strong></li>
                    <li>Abra o app <strong>Cred30</strong> na sua tela inicial</li>
                  </ol>
                </div>
              ) : (
                // Instruções para Desktop
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-left">
                  <p className="text-xs text-zinc-400 mb-2 font-bold uppercase tracking-widest">💻 Computador:</p>
                  <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside">
                    <li>Clique nos <strong>3 pontos (⋮)</strong> no canto superior direito do navegador</li>
                    <li>Selecione <strong>"Instalar Cred30"</strong> ou <strong>"Adicionar à área de trabalho"</strong></li>
                    <li>Confirme a instalação</li>
                    <li>Abra o app instalado</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-zinc-600 mt-6 uppercase tracking-widest">
            Proteção contra fraudes • Cred30 Seguro
          </p>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [state, setState] = useState<AppState>({
    currentUser: null,
    users: [],
    quotas: [],
    loans: [],
    transactions: [],
    isLoading: true,
    profitPool: 0,
    systemBalance: 0,
    lastDividendDistribution: null,
    serverTime: Date.now()
  });

  const location = useLocation();
  const navigate = useNavigate();
  const currentView = location.pathname.split('/').pop() || 'dashboard';
  const isOnline = useOnlineStatus();
  const [showReferral, setShowReferral] = useState(false);
  const [showVip, setShowVip] = useState(false);

  const [pixModalData, setPixModalData] = useState<{
    isOpen: boolean,
    qrCode: string,
    qrCodeBase64: string,
    amount: number,
    description: string
  }>({
    isOpen: false, qrCode: '', qrCodeBase64: '', amount: 0, description: ''
  });

  const [cardModalData, setCardModalData] = useState<{
    isOpen: boolean,
    amount: number,
    type: 'QUOTA' | 'LOAN' | 'INSTALLMENT' | 'PRO',
    details: any
  }>({
    isOpen: false, amount: 0, type: 'QUOTA', details: {}
  });

  const [showSuccess, setShowSuccess] = useState<{ isOpen: boolean, title: string, message: string }>({
    isOpen: false, title: '', message: ''
  });

  const [showError, setShowError] = useState<{ isOpen: boolean, title: string, message: string }>({
    isOpen: false, title: '', message: ''
  });

  const [confirmState, setConfirmState] = useState<{ id?: string, type: 'SELL' | 'SELL_ALL' } | null>(null);

  const [reviewModalData, setReviewModalData] = useState<{
    isOpen: boolean;
    transactionId: number;
    amount: number;
  }>({ isOpen: false, transactionId: 0, amount: 0 });

  const isStaff = React.useMemo(() => {
    if (!state.currentUser) return false;
    return state.currentUser.isAdmin || state.currentUser.role === 'ADMIN' || state.currentUser.role === 'ATTENDANT';
  }, [state.currentUser?.isAdmin, state.currentUser?.role]);

  const totalQuotaValue = React.useMemo(() => {
    if (!state.currentUser) return 0;
    return state.quotas
      .filter(q => q.userId === state.currentUser.id)
      .reduce((acc, q) => acc + (q.currentValue || 0), 0);
  }, [state.quotas, state.currentUser?.id]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (state.currentUser && !document.hidden && isOnline) {
        refreshState();
      }
    }, 15000);

    const handleAuthExpired = () => setState(prev => ({ ...prev, currentUser: null }));
    window.addEventListener('auth-expired', handleAuthExpired);

    // Sync Offline Actions logic
    const handleActionQueued = (e: any) => {
      setShowSuccess({
        isOpen: true,
        title: 'Modo Offline',
        message: 'Você está offline. Sua ação foi agendada e será processada assim que a internet voltar.'
      });
    };

    const handleSyncCompleted = (e: any) => {
      const results = e.detail;
      const successCount = results.filter((r: any) => r.success).length;
      if (successCount > 0) {
        setShowSuccess({
          isOpen: true,
          title: 'Sincronização Concluída',
          message: `${successCount} ações offline foram processadas com sucesso!`
        });
        refreshState();
      }
    };

    window.addEventListener('offline-action-queued', handleActionQueued);
    window.addEventListener('offline-sync-completed', handleSyncCompleted);

    let cleanupNotifications: (() => void) | undefined;
    if (state.currentUser && isOnline) {
      cleanupNotifications = apiService.listenToNotifications((notif) => {
        // Verificar se é notificação de saque processado solicitando avaliação
        if (notif.type === 'PAYOUT_COMPLETED' && notif.metadata?.requiresReview) {
          setReviewModalData({
            isOpen: true,
            transactionId: notif.metadata.transactionId,
            amount: notif.metadata.amount
          });
        }

        setShowSuccess({
          isOpen: true,
          title: notif.title || 'Notificação',
          message: notif.message || 'Status atualizado!'
        });
        refreshState();
      });
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('auth-expired', handleAuthExpired);
      window.removeEventListener('offline-action-queued', handleActionQueued);
      window.removeEventListener('offline-sync-completed', handleSyncCompleted);
      if (cleanupNotifications) cleanupNotifications();
    };
  }, [state.currentUser?.id, isOnline, state.currentUser?.isAdmin, state.currentUser?.role]); // Added missing dependencies

  useEffect(() => {
    if (isOnline) {
      syncService.processQueue();
    }
  }, [isOnline]);

  const loadData = async () => {
    try {
      await refreshState();
    } catch {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const refreshState = async () => {
    try {
      const newState = await loadState();
      setState(newState);
    } catch (e) { console.error(e); }
  };

  const handleLogout = async () => {
    await logoutUser();
    setState(prev => ({ ...prev, currentUser: null }));
    navigate('/');
  };

  const handleBuyQuota = async (qty: number, method: 'PIX' | 'BALANCE' | 'CARD') => {
    try {
      const { total } = calculateTotalToPay(qty * QUOTA_PRICE, method.toLowerCase() as any);

      if (method === 'CARD') {
        setCardModalData({
          isOpen: true,
          amount: total,
          type: 'QUOTA',
          details: { qty }
        });
        return;
      }

      const pm = method.toLowerCase() as any;
      const response = await buyQuota(qty, method === 'BALANCE', pm !== 'balance' ? pm : undefined);
      await refreshState();

      if (response && (response.pixData || response.data?.pixData)) {
        const pixData = response.pixData || response.data?.pixData;
        setPixModalData({
          isOpen: true,
          qrCode: pixData.qr_code,
          qrCodeBase64: pixData.qr_code_base64,
          amount: total,
          description: `Aquisição de ${qty} licença(s)`
        });
        return;
      }

      setShowSuccess({ isOpen: true, title: 'Sucesso!', message: 'Licenças ativadas com sucesso!' });
      navigate('/app/portfolio');
    } catch (error: any) {
      setShowError({ isOpen: true, title: 'Erro na Compra', message: error.message });
    }
  };

  const handleSellQuota = (quotaId: string) => {
    setConfirmState({ id: quotaId, type: 'SELL' });
  };

  const handleSellAll = () => {
    setConfirmState({ type: 'SELL_ALL' });
  };

  const executeConfirmedSell = async () => {
    if (!confirmState) return;
    try {
      if (confirmState.type === 'SELL' && confirmState.id) {
        await sellQuota(confirmState.id);
        setShowSuccess({ isOpen: true, title: 'Resgate Realizado', message: 'Valor creditado.' });
      } else if (confirmState.type === 'SELL_ALL') {
        await sellAllQuotas();
        setShowSuccess({ isOpen: true, title: 'Sucesso', message: 'Todas as licenças resgatadas!' });
      }
      await refreshState();
    } catch (error: any) {
      setShowError({ isOpen: true, title: 'Erro', message: error.message });
    } finally {
      setConfirmState(null);
    }
  };

  const handleReinvest = async () => {
    try {
      await buyQuota(1, true);
      await refreshState();
      setShowSuccess({ isOpen: true, title: 'Sucesso', message: 'Aporte realizado com sucesso!' });
    } catch (error: any) { setShowError({ isOpen: true, title: 'Erro', message: error.message }); }
  };

  const handleRequestLoan = async (amount: number, installments: number) => {
    try {
      await requestLoan(amount, installments);
      await refreshState();
      setShowSuccess({ isOpen: true, title: 'Sucesso!', message: 'Apoio solicitado com sucesso!' });
    } catch (e: any) { setShowError({ isOpen: true, title: 'Erro', message: e.message }); }
  };

  const handlePayLoan = async (loanId: string, useBalance: boolean, method?: 'pix' | 'card') => {
    try {
      const loan = state.loans.find(l => l.id === loanId);
      if (!loan) return;
      const { total } = calculateTotalToPay(parseFloat(loan.totalRepayment as any), method || 'pix');

      if (method === 'card') {
        setCardModalData({
          isOpen: true,
          amount: total,
          type: 'LOAN',
          details: { loanId }
        });
        return;
      }

      const response = await repayLoan(loanId, useBalance, method);
      await refreshState();

      if (response && (response.pixData || response.data?.pixData)) {
        const pixData = response.pixData || response.data?.pixData;
        setPixModalData({
          isOpen: true,
          qrCode: pixData.qr_code,
          qrCodeBase64: pixData.qr_code_base64,
          amount: total,
          description: `Reposição de Apoio Mútuo`
        });
      } else {
        setShowSuccess({ isOpen: true, title: 'Pagamento OK!', message: 'Apoio atualizado.' });
      }
    } catch (e: any) { setShowError({ isOpen: true, title: 'Erro', message: e.message }); }
  };

  const handlePayInstallment = async (id: string, amount: number, useBalance: boolean, method?: 'pix' | 'card') => {
    try {
      const { total } = calculateTotalToPay(amount, method || 'pix');

      if (method === 'card') {
        setCardModalData({
          isOpen: true,
          amount: total,
          type: 'INSTALLMENT',
          details: { loanId: id, amount }
        });
        return;
      }

      const response = await repayInstallment(id, amount, useBalance, method);
      await refreshState();

      if (response && (response.pixData || response.data?.pixData)) {
        const pixData = response.pixData || response.data?.pixData;
        setPixModalData({
          isOpen: true,
          qrCode: pixData.qr_code,
          qrCodeBase64: pixData.qr_code_base64,
          amount: total,
          description: `Pagamento de Parcela`
        });
      } else {
        setShowSuccess({ isOpen: true, title: 'Parcela Paga!', message: 'Reposição registrada.' });
      }
    } catch (e: any) { setShowError({ isOpen: true, title: 'Erro', message: e.message }); }
  };

  const handleClaimAdReward = async () => {
    try {
      await claimAdReward();
      await refreshState();
      setShowSuccess({ isOpen: true, title: 'Sucesso', message: 'Recompensa creditada!' });
    } catch (e: any) { setShowError({ isOpen: true, title: 'Erro', message: e.message }); }
  };

  const handleUpgradeProClick = async (method: 'pix' | 'card') => {
    try {
      const { total } = calculateTotalToPay(29.90, method);

      if (method === 'card') {
        setCardModalData({
          isOpen: true,
          amount: total,
          type: 'PRO',
          details: {}
        });
        return;
      }

      const response = await upgradePro(method);
      await refreshState();

      if (response && (response.pixData || response.data?.pixData)) {
        const pixData = response.pixData || response.data?.pixData;
        setPixModalData({
          isOpen: true,
          qrCode: pixData.qr_code,
          qrCodeBase64: pixData.qr_code_base64,
          amount: total,
          description: `Assinatura Cred30 PRO`
        });
      } else {
        setShowSuccess({ isOpen: true, title: 'Sucesso!', message: 'Você agora é PRO!' });
      }
    } catch (e: any) {
      setShowError({ isOpen: true, title: 'Erro', message: e.message });
    }
  };

  if (state.isLoading) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;
  }

  // Verificação de acesso: Clientes SÓ podem acessar via PWA instalado (desktop E mobile)
  const isInstalled = isPWAInstalled();

  if (!state.currentUser) {
    // BLOQUEIA clientes tentando acessar via web (não PWA) - DESKTOP E MOBILE
    if (!isInstalled) {
      return <PWABlocker />;
    }

    return (
      <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><RefreshCw className="animate-spin text-primary-500" /></div>}>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/auth" element={<AuthScreen onLogin={refreshState} />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  }

  if (isStaff) {
    return (
      <PWAEnforcer isAdmin={true}>
        <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><RefreshCw className="animate-spin text-primary-500" /></div>}>
          <Routes>
            <Route path="/admin" element={<AdminView state={state} onRefresh={refreshState} onLogout={handleLogout} onSuccess={(title, msg) => { setShowSuccess({ isOpen: true, title, message: msg }); }} onError={(title, msg) => { setShowError({ isOpen: true, title, message: msg }); }} />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </PWAEnforcer>
    )
  }


  return (
    <PWAEnforcer isAdmin={false}>
      <OfflineNotice isOnline={isOnline} />
      <UpdateNotification />
      <Routes>
        <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/auth" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/app/*" element={
          <>
            <Layout user={state.currentUser} currentView={currentView} onChangeView={(v) => navigate(`/app/${v}`)} onLogout={handleLogout}>
              <Routes>
                <Route path="dashboard" element={
                  <Suspense fallback={<div className="flex justify-center p-12"><RefreshCw className="animate-spin text-primary-500" /></div>}>
                    <Dashboard
                      state={state}
                      onBuyQuota={() => navigate('/app/invest')}
                      onGames={() => navigate('/app/games')}
                      onLoans={() => navigate('/app/loans')}
                      onWithdraw={() => navigate('/app/withdraw')}
                      onReinvest={handleReinvest}
                      onRefer={() => setShowReferral(true)}
                      onVip={() => setShowVip(true)}
                      onLogout={handleLogout}
                      onSuccess={(title, message) => setShowSuccess({ isOpen: true, title, message })}
                      onError={(title, message) => setShowError({ isOpen: true, title, message })}
                      onChangePassword={async (oldPass, newPass) => {
                        await changePassword(oldPass, newPass);
                        setShowSuccess({ isOpen: true, title: 'Sucesso', message: 'Senha alterada!' });
                      }}
                      onClaimReward={handleClaimAdReward}
                      onMarketplace={() => navigate('/app/marketplace')}
                      onEarn={() => navigate('/app/earn')}
                      onEducation={() => navigate('/app/education')}
                      onVoting={() => navigate('/app/voting')}
                    />
                  </Suspense>
                } />
                <Route path="settings" element={
                  <Suspense fallback={null}>
                    <SettingsView
                      user={state.currentUser!}

                      onLogout={handleLogout}
                      onDeleteAccount={() => { }}
                      onChangePassword={changePassword}
                      onRefresh={refreshState}
                    />
                  </Suspense>
                } />
                <Route path="invest" element={<Suspense fallback={null}><InvestView onBuy={handleBuyQuota} /></Suspense>} />
                <Route path="portfolio" element={
                  <Suspense fallback={null}>
                    <PortfolioView
                      quotas={state.quotas.filter(q => q.userId === state.currentUser?.id)}
                      hasLoans={state.loans.some(l => l.userId === state.currentUser?.id && l.status === 'APPROVED' && !l.isFullyPaid)}
                      onSell={handleSellQuota}
                      onSellAll={handleSellAll}
                    />
                  </Suspense>
                } />
                <Route path="loans" element={
                  <Suspense fallback={null}>
                    <LoansView
                      loans={state.loans}
                      onRequest={handleRequestLoan}
                      onPay={handlePayLoan}
                      onPayInstallment={handlePayInstallment}
                      userBalance={state.currentUser.balance}
                      currentUser={state.currentUser}
                    />
                  </Suspense>
                } />
                <Route path="withdraw" element={
                  <Suspense fallback={null}>
                    <WithdrawView
                      balance={state.currentUser.balance}
                      currentUser={state.currentUser}
                      onSuccess={(title, message) => setShowSuccess({ isOpen: true, title, message })}
                      onError={(title, message) => setShowError({ isOpen: true, title, message })}
                      onRefresh={refreshState}
                      totalQuotaValue={totalQuotaValue}
                    />
                  </Suspense>
                } />
                <Route path="marketplace" element={<Suspense fallback={null}><MarketplaceView state={state} onBack={() => navigate('/app/dashboard')} onSuccess={(title, message) => setShowSuccess({ isOpen: true, title, message })} onError={(title, message) => setShowError({ isOpen: true, title, message })} onRefresh={refreshState} /></Suspense>} />
                <Route path="earn" element={<Suspense fallback={null}><EarnView state={state} onBack={() => navigate('/app/dashboard')} onSuccess={(title, message) => setShowSuccess({ isOpen: true, title, message })} onError={(title, message) => setShowError({ isOpen: true, title, message })} onRefresh={refreshState} onUpgrade={handleUpgradeProClick} /></Suspense>} />
                <Route path="games" element={<Suspense fallback={null}><GamesView onBack={() => navigate('/app/dashboard')} /></Suspense>} />
                <Route path="education" element={<Suspense fallback={null}><EducationView onBack={() => navigate('/app/dashboard')} onSuccess={(title, message) => setShowSuccess({ isOpen: true, title, message })} /></Suspense>} />
                <Route path="faq" element={<Suspense fallback={null}><FaqView /></Suspense>} />
                <Route path="voting" element={<Suspense fallback={null}><VotingView appState={state} onBack={() => navigate('/app/dashboard')} onRefresh={refreshState} onSuccess={(title, message) => setShowSuccess({ isOpen: true, title, message })} onError={(title, message) => setShowError({ isOpen: true, title, message })} /></Suspense>} />
                <Route path="history" element={<Suspense fallback={null}><HistoryView transactions={state.transactions.filter(t => t.userId === state.currentUser!.id)} /></Suspense>} />
                <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
              </Routes>

              {showReferral && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowReferral(false)}>
                  <div className="bg-surface border border-surfaceHighlight rounded-3xl p-8 w-full max-w-sm relative animate-in fade-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                    <button title="Fechar" onClick={() => setShowReferral(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white">✕</button>
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-primary-500/10 rounded-2xl flex items-center justify-center text-primary-400 mx-auto mb-4">
                        <Users size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Convidar Membro</h3>
                      <p className="text-zinc-400 text-sm">O Cred30 é exclusivo. Use seu link para convidar pessoas.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-background border border-surfaceHighlight rounded-xl p-4">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Seu Código</p>
                        <p className="text-white font-mono text-lg font-bold tracking-wider">{state.currentUser.referralCode}</p>
                      </div>
                      <button
                        onClick={() => {
                          const link = `${window.location.origin}/auth?ref=${state.currentUser.referralCode}`;
                          navigator.clipboard.writeText(link);
                          setShowSuccess({ isOpen: true, title: 'Copiado!', message: 'Link copiado.' });
                        }}
                        className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20"
                      >
                        <Copy size={18} /> Copiar Link
                      </button>
                      <p className="text-[10px] text-zinc-500 text-center italic">Você ganha R$ 5,00 por indicação ativa.</p>
                    </div>
                  </div>
                </div>
              )}

              <PIXModal
                isOpen={pixModalData.isOpen}
                onClose={() => setPixModalData(prev => ({ ...prev, isOpen: false }))}
                qrCode={pixModalData.qrCode}
                qrCodeBase64={pixModalData.qrCodeBase64}
                amount={pixModalData.amount}
                description={pixModalData.description}
              />

              <CardModal
                isOpen={cardModalData.isOpen}
                onClose={() => setCardModalData(prev => ({ ...prev, isOpen: false }))}
                amount={cardModalData.amount}
                userEmail={state.currentUser?.email || ''}
                currentUser={state.currentUser}
                onSubmit={async (formData) => {
                  try {
                    if (cardModalData.type === 'QUOTA') {
                      await buyQuota(cardModalData.details.qty, false, 'card', formData);
                    } else if (cardModalData.type === 'LOAN') {
                      await repayLoan(cardModalData.details.loanId, false, 'card', formData);
                    } else if (cardModalData.type === 'INSTALLMENT') {
                      await repayInstallment(cardModalData.details.loanId, cardModalData.details.amount, false, 'card', formData);
                    } else if (cardModalData.type === 'PRO') {
                      await upgradePro('card', formData);
                    }
                    await refreshState();
                    setCardModalData(prev => ({ ...prev, isOpen: false }));
                    setShowSuccess({ isOpen: true, title: 'Processando...', message: 'Pagamento sendo analisado.' });
                  } catch (e: any) {
                    setShowError({ isOpen: true, title: 'Erro no Cartão', message: e.message });
                  }
                }}
              />

              {showSuccess.isOpen && (
                <div className="fixed bottom-24 left-4 right-4 md:top-6 md:left-1/2 md:-translate-x-1/2 md:right-auto md:w-auto md:min-w-[400px] z-[9999] animate-in slide-in-from-bottom-5 md:slide-in-from-top-5 duration-300 pointer-events-none">
                  <div className="bg-[#050505] border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-4 shadow-2xl shadow-emerald-900/40 pointer-events-auto ring-1 ring-emerald-500/20">
                    <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-black shrink-0 shadow-lg shadow-emerald-500/30"><Check size={24} strokeWidth={3} /></div>
                    <div className="flex-1 pr-4">
                      <h4 className="text-white font-black text-sm tracking-tight uppercase">{showSuccess.title}</h4>
                      <p className="text-zinc-400 text-xs font-medium leading-relaxed">{showSuccess.message}</p>
                    </div>
                    <button onClick={() => setShowSuccess({ ...showSuccess, isOpen: false })} className="text-zinc-500 hover:text-white transition-colors bg-zinc-900/50 p-2 rounded-lg"><XIcon size={16} /></button>
                  </div>
                </div>
              )}

              {showError.isOpen && (
                <div className="fixed bottom-24 left-4 right-4 md:top-6 md:left-1/2 md:-translate-x-1/2 md:right-auto md:w-auto md:min-w-[400px] z-[9999] animate-in slide-in-from-bottom-5 md:slide-in-from-top-5 duration-300 pointer-events-none">
                  <div className="bg-[#050505] border border-red-500/30 rounded-2xl p-4 flex items-center gap-4 shadow-2xl shadow-red-900/40 pointer-events-auto ring-1 ring-red-500/20">
                    <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-red-500/30"><AlertTriangle size={24} strokeWidth={3} /></div>
                    <div className="flex-1 pr-4">
                      <h4 className="text-white font-black text-sm tracking-tight uppercase">{showError.title}</h4>
                      <p className="text-zinc-400 text-xs font-medium leading-relaxed">{showError.message}</p>
                    </div>
                    <button onClick={() => setShowError({ ...showError, isOpen: false })} className="text-zinc-500 hover:text-white transition-colors bg-zinc-900/50 p-2 rounded-lg"><XIcon size={16} /></button>
                  </div>
                </div>
              )}

              {confirmState && (
                <ConfirmModal
                  isOpen={!!confirmState}
                  onClose={() => setConfirmState(null)}
                  onConfirm={executeConfirmedSell}
                  title={confirmState.type === 'SELL_ALL' ? 'Resgatar Tudo?' : 'Confirmar Resgate?'}
                  message={confirmState.type === 'SELL_ALL' ? 'Deseja resgatar todas as licenças?' : 'Deseja resgatar esta participação?'}
                  confirmText="Resgatar"
                  type="danger"
                />
              )}

              <ReviewModal
                isOpen={reviewModalData.isOpen}
                onClose={() => setReviewModalData({ isOpen: false, transactionId: 0, amount: 0 })}
                onSubmit={async (rating, comment, isPublic) => {
                  await apiService.submitReview(reviewModalData.transactionId, rating, comment, isPublic);
                }}
                transactionId={reviewModalData.transactionId}
                amount={reviewModalData.amount}
              />
            </Layout>
            <AIAssistant appState={state} />
          </>
        } />
      </Routes>
    </PWAEnforcer>
  );
}
