import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '../components/layout/main-layout.component';
import { UpdateNotification } from '../components/ui/update-notification.component';
import { loadState, logoutUser, buyQuota, sellQuota, sellAllQuotas, requestLoan, repayLoan, repayInstallment, changePassword, upgradePro, claimAdReward } from '../../application/services/storage.service';
import { apiService } from '../../application/services/api.service';
import { AppState, Quota, Loan, Transaction, User } from '../../domain/types/common.types';
import { QUOTA_PRICE } from '../../shared/constants/app.constants';
import { calculateTotalToPay } from '../../shared/utils/financial.utils';
import { Check, X as XIcon, RefreshCw, AlertTriangle, Users, Copy, Wallet, TrendingUp, ArrowUpFromLine } from 'lucide-react';
import { PIXModal } from '../components/ui/pix-modal.component';
import { CardModal } from '../components/ui/card-modal.component';
import { AuthScreen } from '../components/views/AuthScreen';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { AIAssistant } from '../components/AIAssistant';

// Lazy imports for views
const WelcomePage = lazy(() => import('./welcome.page'));
const TermsPage = lazy(() => import('./terms.page'));
const PrivacyPage = lazy(() => import('./privacy.page'));
const SecurityPage = lazy(() => import('./security.page'));
const Dashboard = lazy(() => import('../components/views/Dashboard').then(m => ({ default: m.Dashboard })));
const SettingsView = lazy(() => import('../components/views/SettingsView').then(m => ({ default: m.SettingsView })));
const InvestView = lazy(() => import('../components/views/InvestView').then(m => ({ default: m.InvestView })));
const PortfolioView = lazy(() => import('../components/views/PortfolioView').then(m => ({ default: m.PortfolioView })));
const LoansView = lazy(() => import('../components/views/LoansView').then(m => ({ default: m.LoansView })));
const WithdrawView = lazy(() => import('../components/views/WithdrawView').then(m => ({ default: m.WithdrawView })));
const AdminView = lazy(() => import('../components/views/AdminView').then(m => ({ default: m.AdminView })));
const HistoryView = lazy(() => import('../components/views/HistoryView').then(m => ({ default: m.HistoryView })));
const MarketplaceView = lazy(() => import('../components/views/MarketplaceView').then(m => ({ default: m.MarketplaceView })));
const EarnView = lazy(() => import('../components/views/EarnView').then(m => ({ default: m.EarnView })));
const GamesView = lazy(() => import('../components/views/GamesView').then(m => ({ default: m.GamesView })));

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
    pendingItems: [],
    serverTime: Date.now()
  });

  const location = useLocation();
  const navigate = useNavigate();
  const currentView = location.pathname.split('/').pop() || 'dashboard';
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

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (state.currentUser && !document.hidden) {
        refreshState();
      }
    }, 15000);

    const handleAuthExpired = () => setState(prev => ({ ...prev, currentUser: null }));
    window.addEventListener('auth-expired', handleAuthExpired);

    let cleanupNotifications: (() => void) | undefined;
    if (state.currentUser) {
      cleanupNotifications = apiService.listenToNotifications((notif) => {
        setShowSuccess({
          isOpen: true,
          title: 'Notificação',
          message: notif.message || 'Status atualizado!'
        });
        refreshState();
      });
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('auth-expired', handleAuthExpired);
      if (cleanupNotifications) cleanupNotifications();
    };
  }, [state.currentUser?.id]);

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
          description: `Compra de ${qty} cota(s)`
        });
        return;
      }

      setShowSuccess({ isOpen: true, title: 'Sucesso!', message: 'Suas cotas foram adquiridas!' });
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
        setShowSuccess({ isOpen: true, title: 'Venda Realizada', message: 'Valor creditado.' });
      } else if (confirmState.type === 'SELL_ALL') {
        await sellAllQuotas();
        setShowSuccess({ isOpen: true, title: 'Sucesso', message: 'Todas as cotas vendidas!' });
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

  const handleRequestLoan = async (amount: number, installments: number, pixKey: string) => {
    try {
      await requestLoan(amount, installments, pixKey);
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

  if (state.currentUser.isAdmin) {
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
                    />
                  </Suspense>
                } />
                <Route path="settings" element={
                  <Suspense fallback={null}>
                    <SettingsView
                      user={state.currentUser!}
                      onSimulateTime={() => { }}
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
                      totalQuotaValue={state.quotas
                        .filter(q => q.userId === state.currentUser!.id)
                        .reduce((acc, q) => acc + (q.currentValue || 0), 0)
                      }
                    />
                  </Suspense>
                } />
                <Route path="marketplace" element={<Suspense fallback={null}><MarketplaceView state={state} onBack={() => navigate('/app/dashboard')} onSuccess={(title, message) => setShowSuccess({ isOpen: true, title, message })} onError={(title, message) => setShowError({ isOpen: true, title, message })} onRefresh={refreshState} /></Suspense>} />
                <Route path="earn" element={<Suspense fallback={null}><EarnView state={state} onBack={() => navigate('/app/dashboard')} onSuccess={(title, message) => setShowSuccess({ isOpen: true, title, message })} onError={(title, message) => setShowError({ isOpen: true, title, message })} onRefresh={refreshState} onUpgrade={handleUpgradeProClick} /></Suspense>} />
                <Route path="games" element={<Suspense fallback={null}><GamesView onBack={() => navigate('/app/dashboard')} /></Suspense>} />
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
                <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-96 z-[200] animate-in slide-in-from-bottom-5 duration-300">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4 backdrop-blur-xl">
                    <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shrink-0"><Check size={24} /></div>
                    <div className="flex-1">
                      <h4 className="text-white font-bold text-sm tracking-tight">{showSuccess.title}</h4>
                      <p className="text-zinc-400 text-xs">{showSuccess.message}</p>
                    </div>
                    <button onClick={() => setShowSuccess({ ...showSuccess, isOpen: false })} className="text-zinc-500 hover:text-white">✕</button>
                  </div>
                </div>
              )}

              {showError.isOpen && (
                <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-96 z-[200] animate-in slide-in-from-bottom-5 duration-300">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-4 backdrop-blur-xl">
                    <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white shrink-0"><AlertTriangle size={24} /></div>
                    <div className="flex-1">
                      <h4 className="text-white font-bold text-sm tracking-tight">{showError.title}</h4>
                      <p className="text-zinc-400 text-xs">{showError.message}</p>
                    </div>
                    <button onClick={() => setShowError({ ...showError, isOpen: false })} className="text-zinc-500 hover:text-white">✕</button>
                  </div>
                </div>
              )}

              {confirmState && (
                <ConfirmModal
                  isOpen={!!confirmState}
                  onClose={() => setConfirmState(null)}
                  onConfirm={executeConfirmedSell}
                  title={confirmState.type === 'SELL_ALL' ? 'Vender Tudo?' : 'Confirmar Venda?'}
                  message={confirmState.type === 'SELL_ALL' ? 'Deseja vender todas as cotas?' : 'Deseja vender esta participação?'}
                  confirmText="Vender"
                  type="danger"
                />
              )}
            </Layout>
            <AIAssistant appState={state} />
          </>
        } />
      </Routes>
    </>
  );
}
