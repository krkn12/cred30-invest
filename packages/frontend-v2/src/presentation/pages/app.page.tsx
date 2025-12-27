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
const PromoVideosView = lazyWithRetry(() => import('../components/views/PromoVideosView').then(m => ({ default: m.PromoVideosView })));

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
  }, [state.currentUser?.id, isOnline, state.currentUser?.isAdmin, state.currentUser?.role]);

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
      setState(prev => ({ ...prev, ...newState, isLoading: false }));
    } catch (e) {
      console.error(e);
      setState(prev => ({ ...prev, isLoading: false }));
    }
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
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="relative">
          <div className="w-24 h-24 bg-primary-500/10 rounded-[2rem] border border-primary-500/20 flex items-center justify-center shadow-[0_0_50px_rgba(6,182,212,0.15)] animate-pulse">
            <img src="/pwa-192x192.png" alt="Cred30" className="w-16 h-16 rounded-2xl" />
          </div>
          <div className="absolute inset-0 w-24 h-24 border-2 border-primary-500 border-t-transparent rounded-[2rem] animate-spin" />
        </div>
        <div className="mt-8 space-y-2">
          <h1 className="text-2xl font-black text-white tracking-tighter">Cred<span className="text-primary-400">30</span></h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.4em] animate-pulse">Sincronizando Dados...</p>
        </div>
      </div>
    );
  }

  if (!state.currentUser) {
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
      <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><RefreshCw className="animate-spin text-primary-500" /></div>}>
        <Routes>
          <Route path="/admin" element={<AdminView state={state} onRefresh={refreshState} onLogout={handleLogout} onSuccess={(title, msg) => { setShowSuccess({ isOpen: true, title, message: msg }); }} onError={(title, msg) => { setShowError({ isOpen: true, title, message: msg }); }} />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <>
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
                <Route path="invest" element={<Suspense fallback={null}><InvestView onBuy={handleBuyQuota} isPro={state.currentUser?.membership_type === 'PRO'} /></Suspense>} />
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
                <Route path="promo-videos" element={<Suspense fallback={null}><PromoVideosView userBalance={state.currentUser.balance} onRefresh={refreshState} onSuccess={(title, message) => setShowSuccess({ isOpen: true, title, message })} onError={(title, message) => setShowError({ isOpen: true, title, message })} /></Suspense>} />
                <Route path="history" element={<Suspense fallback={null}><HistoryView transactions={state.transactions.filter(t => t.userId === state.currentUser!.id)} isPro={state.currentUser?.membership_type === 'PRO'} /></Suspense>} />
                <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
              </Routes>

              {showReferral && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-[500] p-0 sm:p-4 animate-in fade-in duration-300" onClick={() => setShowReferral(false)}>
                  <div className="bg-[#0A0A0A] border-t sm:border border-white/5 sm:border-surfaceHighlight rounded-t-[2.5rem] sm:rounded-3xl p-8 w-full sm:max-w-sm relative animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 sm:duration-300" onClick={e => e.stopPropagation()}>
                    <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6 sm:hidden opacity-50" />

                    <button title="Fechar" onClick={() => setShowReferral(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white hidden sm:block">✕</button>

                    <div className="text-center mb-8">
                      <div className="w-20 h-20 bg-primary-500/10 rounded-3xl flex items-center justify-center text-primary-400 mx-auto mb-4 shadow-xl shadow-primary-900/20 ring-1 ring-primary-500/20">
                        <Users size={40} strokeWidth={2.5} />
                      </div>
                      <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Convidar Membro</h3>
                      <p className="text-zinc-400 text-sm font-medium leading-relaxed">O Cred30 é um clube exclusivo. Use seu link para convidar pessoas de confiança.</p>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 text-center group cursor-copy active:bg-zinc-800 transition-colors" onClick={() => {
                        const link = `${window.location.origin}/auth?ref=${state.currentUser!.referralCode}`;
                        navigator.clipboard.writeText(link);
                        setShowSuccess({ isOpen: true, title: 'Copiado!', message: 'Link de convite pronto para enviar!' });
                      }}>
                        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Seu Código de Acesso</p>
                        <p className="text-white font-mono text-2xl font-black tracking-[0.2em] group-hover:text-primary-400 transition-colors">{state.currentUser!.referralCode}</p>
                      </div>

                      <button
                        onClick={() => {
                          const link = `${window.location.origin}/auth?ref=${state.currentUser!.referralCode}`;
                          navigator.clipboard.writeText(link);
                          setShowSuccess({ isOpen: true, title: 'Copiado!', message: 'Link de convite pronto para enviar!' });
                        }}
                        className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black uppercase tracking-widest py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-2xl shadow-primary-500/20 active:scale-95"
                      >
                        <Copy size={20} /> COPIAR LINK
                      </button>

                      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                            🎁
                          </div>
                          <div>
                            <p className="text-xs text-emerald-400 font-bold mb-1">Benefício de Boas-Vindas!</p>
                            <p className="text-[10px] sm:text-xs text-zinc-400 leading-relaxed">
                              Quem você indicar ganha <span className="text-emerald-400 font-bold">taxas especiais</span> por até <span className="text-emerald-400 font-bold">3 usos</span>:
                            </p>
                            <ul className="text-[10px] text-zinc-500 mt-2 space-y-1">
                              <li>• Juros de <span className="text-emerald-400">3,5%</span> (ao invés de 20%)</li>
                              <li>• Taxa de saque de <span className="text-emerald-400">R$ 1,00</span> (50% off)</li>
                              <li>• Marketplace com <span className="text-emerald-400">2,5%</span> de taxa (50% off)</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="bg-primary-500/5 border border-primary-500/10 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400 shrink-0">
                          <TrendingUp size={16} />
                        </div>
                        <p className="text-[10px] sm:text-xs text-zinc-400 leading-tight">Você ganha <span className="text-primary-400 font-black">+50 Score</span> por cada novo membro ativo que indicar.</p>
                      </div>
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
                <div className="fixed top-6 left-1/2 -translate-x-1/2 w-[90%] sm:w-auto sm:min-w-[400px] z-[9999] animate-in slide-in-from-top-10 duration-500">
                  <div className="bg-[#050505]/90 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-4 flex items-center gap-4 shadow-[0_20px_50px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/20">
                    <div className="w-11 h-11 bg-emerald-500 rounded-2xl flex items-center justify-center text-black shrink-0 shadow-lg shadow-emerald-500/30">
                      <Check size={24} strokeWidth={4} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-black text-[10px] tracking-widest uppercase mb-0.5">{showSuccess.title}</h4>
                      <p className="text-zinc-400 text-xs font-bold leading-tight">{showSuccess.message}</p>
                    </div>
                    <button onClick={() => setShowSuccess({ ...showSuccess, isOpen: false })} className="text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-xl">
                      <XIcon size={16} />
                    </button>
                  </div>
                </div>
              )}

              {showError.isOpen && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 w-[90%] sm:w-auto sm:min-w-[400px] z-[9999] animate-in slide-in-from-top-10 duration-500">
                  <div className="bg-[#050505]/90 backdrop-blur-xl border border-red-500/30 rounded-3xl p-4 flex items-center gap-4 shadow-[0_20px_50px_rgba(239,68,68,0.2)] ring-1 ring-red-500/20">
                    <div className="w-11 h-11 bg-red-500 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-red-500/30">
                      <AlertTriangle size={24} strokeWidth={3} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-black text-[10px] tracking-widest uppercase mb-0.5">{showError.title}</h4>
                      <p className="text-zinc-400 text-xs font-bold leading-tight">{showError.message}</p>
                    </div>
                    <button onClick={() => setShowError({ ...showError, isOpen: false })} className="text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-xl">
                      <XIcon size={16} />
                    </button>
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
    </>
  );
}
