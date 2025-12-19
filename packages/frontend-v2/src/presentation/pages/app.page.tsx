import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/main-layout.component';
import { AIAssistant } from '../components/features/ai-assistant.component';
import { SlotMachine } from '../components/features/slot-machine.component';
import { UpdateNotification } from '../components/ui/update-notification.component';
import { StoreView } from '../components/features/store/store.component';
import { AdminStoreManager } from '../components/features/store/admin-store.component';
import WelcomePage from './welcome.page';
import TermsPage from './terms.page';
import PrivacyPage from './privacy.page';
import SecurityPage from './security.page';
import { loadState, registerUser, loginUser, logoutUser, buyQuota, sellQuota, sellAllQuotas, requestLoan, fastForwardTime, repayLoan, repayInstallment, getCurrentUser, resetPassword, requestWithdrawal, getPendingItems, processAdminAction, updateSystemBalance, updateProfitPool, distributeMonthlyDividends, fixLoanPix, clearAllCache, deleteUserAccount, changePassword, verifyEmail, confirmWithdrawal } from '../../application/services/storage.service';
import { apiService } from '../../application/services/api.service';
import { AppState, Quota, Loan, Transaction, User } from '../../domain/types/common.types';
import { QUOTA_PRICE, VESTING_PERIOD_MS } from '../../shared/constants/app.constants';
import { ArrowRight, TrendingUp, Shield, Zap, Users, Star, ChevronRight, Check, ArrowUpRight, ArrowDownLeft, Wallet, PiggyBank, CreditCard, Star as StarIcon, Settings, LogOut, DollarSign, PieChart, ArrowUpFromLine, Trash2, Lock, AlertTriangle, X as XIcon, RefreshCw, KeyRound, QrCode, ShieldCheck, Coins, Clock, ArrowLeft, Repeat, Crown, Copy, CheckCircle2, ChevronLeft, Gamepad2 } from 'lucide-react';
import { PIXModal } from '../components/ui/pix-modal.component';
import { CardModal } from '../components/ui/card-modal.component';
import { AuthScreen } from '../components/views/AuthScreen';
import { SettingsView } from '../components/views/SettingsView';
import { Dashboard } from '../components/views/Dashboard';
import { InvestView } from '../components/views/InvestView';
import { PortfolioView } from '../components/views/PortfolioView';
import { LoansView } from '../components/views/LoansView';
import { WithdrawView } from '../components/views/WithdrawView';
import { AdminView } from '../components/views/AdminView';



// --- Auth Component ---


// --- Client Views ---







// --- Main App ---

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

  const [currentView, setCurrentView] = useState<'dashboard' | 'invest' | 'portfolio' | 'loans' | 'admin' | 'games' | 'store'>('dashboard');
  const [showReferral, setShowReferral] = useState(false);
  const [showVip, setShowVip] = useState(false);
  const [pixModalData, setPixModalData] = useState<{
    isOpen: boolean,
    qrCode: string,
    qrCodeBase64: string,
    amount: number,
    description: string
  }>({
    isOpen: false,
    qrCode: '',
    qrCodeBase64: '',
    amount: 0,
    description: ''
  });

  const [cardModalData, setCardModalData] = useState<{
    isOpen: boolean,
    amount: number,
    type: 'QUOTA' | 'LOAN' | 'INSTALLMENT',
    details: any
  }>({
    isOpen: false,
    amount: 0,
    type: 'QUOTA',
    details: {}
  });

  const [showSuccess, setShowSuccess] = useState<{ isOpen: boolean, title: string, message: string }>({
    isOpen: false,
    title: '',
    message: ''
  });
  const [showError, setShowError] = useState<{ isOpen: boolean, title: string, message: string }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadData();

    // Auto-refresh: Atualiza os dados a cada 15 segundos automaticamente
    const interval = setInterval(() => {
      // Só atualiza se o usuário estiver logado e a aba estiver ativa (visível)
      if (state.currentUser && !document.hidden) {
        refreshState();
        console.log('Dados atualizados automaticamente...');
      }
    }, 15000);

    const handleAuthExpired = () => setState(prev => ({ ...prev, currentUser: null }));
    window.addEventListener('auth-expired', handleAuthExpired);

    return () => {
      clearInterval(interval);
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, [state.currentUser?.id]); // Reinicia se o usuário mudar

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
  };

  const handleBuyQuota = async (qty: number, method: 'PIX' | 'BALANCE' | 'CARD') => {
    try {
      if (method === 'CARD') {
        const baseCost = qty * QUOTA_PRICE;
        const fee = (baseCost * 0.0499) + 0.40;
        setCardModalData({
          isOpen: true,
          amount: baseCost + fee,
          type: 'QUOTA',
          details: { qty }
        });
        return;
      }

      const pm = method.toLowerCase() as any;
      const response = await buyQuota(qty, method === 'BALANCE', pm !== 'balance' ? pm : undefined);
      await refreshState();

      if (response && response.pixData) {
        setPixModalData({
          isOpen: true,
          qrCode: response.pixData.qr_code,
          qrCodeBase64: response.pixData.qr_code_base64,
          amount: response.finalCost || response.cost,
          description: `Compra de ${qty} cota(s)`
        });
      } else {
        setShowSuccess({
          isOpen: true,
          title: 'Sucesso!',
          message: 'Suas cotas foram adquiridas e já estão rendendo!'
        });
        setCurrentView('portfolio');
      }
    } catch (error: any) {
      setShowError({ isOpen: true, title: 'Erro na Compra', message: error.message });
    }
  };

  const handleSellQuota = async (quotaId: string) => {
    try {
      if (!confirm('Vender cota?')) return;
      await sellQuota(quotaId);
      await refreshState();
      setShowSuccess({
        isOpen: true,
        title: 'Venda Realizada',
        message: 'O valor foi creditado no seu saldo.'
      });
    } catch (error: any) { setShowError({ isOpen: true, title: 'Erro', message: error.message }); }
  };

  const handleSellAll = async () => {
    try {
      if (!confirm('Vender TODAS as cotas?')) return;
      await sellAllQuotas();
      await refreshState();
      setShowSuccess({ isOpen: true, title: 'Sucesso', message: 'Todas as cotas vendidas!' });
    } catch (error: any) { setShowError({ isOpen: true, title: 'Erro', message: error.message }); }
  };

  const handleReinvest = async () => {
    try {
      await buyQuota(1, true);
      await refreshState();
      setShowSuccess({ isOpen: true, title: 'Sucesso', message: 'Reinvestimento realizado!' });
    } catch (error: any) { setShowError({ isOpen: true, title: 'Erro', message: error.message }); }
  };

  // Funções auxiliares para passar para LoansView
  const handleRequestLoan = async (amount: number, installments: number, pixKey: string) => {
    try {
      await requestLoan(amount, installments, pixKey);
      await refreshState();
      setShowSuccess({ isOpen: true, title: 'Aprovado!', message: 'Empréstimo aprovado e creditado com sucesso!' });
    } catch (e: any) { setShowError({ isOpen: true, title: 'Erro', message: e.message }); }
  };

  const handlePayLoan = async (loanId: string, useBalance: boolean, method?: 'pix' | 'card') => {
    try {
      if (method === 'card') {
        const loan = state.loans.find(l => l.id === loanId);
        if (!loan) return;
        const baseCost = parseFloat(loan.totalRepayment as any);
        const fee = (baseCost * 0.0499) + 0.40;
        setCardModalData({
          isOpen: true,
          amount: baseCost + fee,
          type: 'LOAN',
          details: { loanId }
        });
        return;
      }

      const response = await repayLoan(loanId, useBalance, method);
      await refreshState();

      if (response && response.pixData) {
        setPixModalData({
          isOpen: true,
          qrCode: response.pixData.qr_code,
          qrCodeBase64: response.pixData.qr_code_base64,
          amount: response.finalCost || response.amount || 0,
          description: `Pagamento de Empréstimo`
        });
      } else {
        setShowSuccess({
          isOpen: true,
          title: 'Pagamento OK!',
          message: 'Seu empréstimo foi atualizado com sucesso.'
        });
      }
    } catch (e: any) { setShowError({ isOpen: true, title: 'Erro', message: e.message }); }
  };

  // Adaptação para interface do LoansView que espera (id, amount, useBalance, method)
  const handlePayInstallment = async (id: string, amount: number, useBalance: boolean, method?: 'pix' | 'card') => {
    try {
      if (method === 'card') {
        const baseCost = amount;
        const fee = (baseCost * 0.0499) + 0.40;
        setCardModalData({
          isOpen: true,
          amount: baseCost + fee,
          type: 'INSTALLMENT',
          details: { loanId: id, amount }
        });
        return;
      }

      const response = await repayInstallment(id, amount, useBalance, method);
      await refreshState();

      if (response && response.pixData) {
        setPixModalData({
          isOpen: true,
          qrCode: response.pixData.qr_code,
          qrCodeBase64: response.pixData.qr_code_base64,
          amount: response.finalCost || amount,
          description: `Pagamento de Parcela`
        });
      } else {
        setShowSuccess({
          isOpen: true,
          title: 'Parcela Paga!',
          message: 'O pagamento da sua parcela foi registrado.'
        });
      }
    } catch (e: any) { setShowError({ isOpen: true, title: 'Erro', message: e.message }); }
  }

  const handleWithdraw = async (amount: number, pixKey: string) => {
    try {
      await requestWithdrawal(amount, pixKey);
      await refreshState();
      setShowSuccess({ isOpen: true, title: 'Solicitação Enviada', message: 'Solicitação de saque enviada! Aguarde processamento.' });
    } catch (e: any) { setShowError({ isOpen: true, title: 'Erro', message: e.message }); }
  }

  if (state.isLoading) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500"></div></div>;
  }

  if (!state.currentUser) {
    return (
      <>
        <UpdateNotification />
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/auth" element={<AuthScreen onLogin={refreshState} />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </>
    );
  }

  if (state.currentUser.isAdmin) {
    return (
      <>
        <UpdateNotification />
        <Routes>
          <Route path="/admin" element={<AdminView state={state} onRefresh={refreshState} onLogout={handleLogout} onSuccess={(title, msg) => { setShowSuccess({ isOpen: true, title, message: msg }); }} onError={(title, msg) => { setShowError({ isOpen: true, title, message: msg }); }} />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </>
    )
  }

  return (
    <>
      <UpdateNotification />
      <Routes>
        <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/auth" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/app/*" element={
          <Layout user={state.currentUser} currentView={currentView} onChangeView={(v) => setCurrentView(v as any)} onLogout={handleLogout}>
            <Routes>
              <Route path="dashboard" element={
                <Dashboard
                  state={state}
                  onBuyQuota={() => setCurrentView('invest')}
                  onReinvest={handleReinvest}
                  onRefer={() => setShowReferral(true)}
                  onVip={() => setShowVip(true)}
                  onLogout={handleLogout}
                  onSuccess={(title, message) => setShowSuccess({ isOpen: true, title, message })}
                  onError={(title, message) => setShowError({ isOpen: true, title, message })}
                  onChangePassword={async (oldPass, newPass) => {
                    await changePassword(oldPass, newPass);
                    setShowSuccess({ isOpen: true, title: 'Sucesso', message: 'Senha alterada com sucesso!' });
                  }}
                />
              } />
              <Route path="store" element={<StoreView />} />
              <Route path="invest" element={<InvestView onBuy={handleBuyQuota} />} />
              <Route path="games" element={<SlotMachine onBalanceUpdate={refreshState} currentBalance={state.currentUser.balance} />} />
              <Route path="portfolio" element={
                <PortfolioView
                  quotas={state.quotas.filter(q => q.userId === state.currentUser!.id)}
                  hasLoans={false}
                  onSell={handleSellQuota}
                  onSellAll={handleSellAll}
                />
              } />
              <Route path="loans" element={
                <LoansView
                  loans={state.loans.filter(l => l.userId === state.currentUser!.id)}
                  onRequest={handleRequestLoan}
                  onPay={handlePayLoan}
                  onPayInstallment={handlePayInstallment}
                  userBalance={state.currentUser.balance}
                  currentUser={state.currentUser}
                />
              } />
              <Route path="settings" element={
                <SettingsView
                  user={state.currentUser}
                  onSimulateTime={() => fastForwardTime(1).then(refreshState)}
                  onLogout={handleLogout}
                  onDeleteAccount={async () => {
                    const res = await deleteUserAccount();
                    if (!res.success) {
                      setShowError({ isOpen: true, title: 'Erro ao Encerrar Conta', message: res.message });
                    } else {
                      setShowSuccess({ isOpen: true, title: 'Conta Encerrada', message: 'Sua conta foi encerrada com sucesso.' });
                      handleLogout();
                    }
                  }}
                  onChangePassword={async (oldPass, newPass) => {
                    await changePassword(oldPass, newPass);
                    setShowSuccess({ isOpen: true, title: 'Sucesso', message: 'Senha alterada com sucesso!' });
                  }}
                />
              } />
              <Route path="withdraw" element={
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
              } />
              <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
            </Routes>

            {showReferral && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-surface rounded-3xl p-6 w-full max-w-sm relative">
                  <button onClick={() => setShowReferral(false)} className="absolute top-4 right-4 text-zinc-500">✕</button>
                  <h3 className="text-xl font-bold text-white mb-4">Indique e Ganhe</h3>
                  <p className="text-zinc-400">Seu código: <strong className="text-white">{state.currentUser.referralCode}</strong></p>
                </div>
              </div>
            )}
            {showVip && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-surface rounded-3xl p-6 w-full max-w-sm relative">
                  <button onClick={() => setShowVip(false)} className="absolute top-4 right-4 text-zinc-500">✕</button>
                  <h3 className="text-xl font-bold text-white mb-4">VIP</h3>
                  <p className="text-zinc-400">Em breve.</p>
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
                  console.log('Finalizando pagamento com cartão...', formData);
                  if (cardModalData.type === 'QUOTA') {
                    await buyQuota(cardModalData.details.qty, false, 'card', formData);
                  } else if (cardModalData.type === 'LOAN') {
                    await repayLoan(cardModalData.details.loanId, false, 'card', formData);
                  } else if (cardModalData.type === 'INSTALLMENT') {
                    await repayInstallment(cardModalData.details.loanId, cardModalData.details.amount, false, 'card', formData);
                  }

                  await refreshState();
                  setCardModalData(prev => ({ ...prev, isOpen: false }));
                  setShowSuccess({
                    isOpen: true,
                    title: 'Pagamento Recebido!',
                    message: 'Seu pagamento com cartão foi processado. A ativação no sistema ocorre em instantes.'
                  });
                  if (cardModalData.type === 'QUOTA') setCurrentView('portfolio');
                } catch (e: any) {
                  throw new Error(e.message || 'Erro ao processar pagamento com cartão');
                }
              }}
            />

            {showSuccess.isOpen && (
              <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300" onClick={(e) => { if (e.target === e.currentTarget) setShowSuccess(prev => ({ ...prev, isOpen: false })); }}>
                <div className="bg-surface border border-primary-500/30 rounded-3xl p-8 w-full max-w-sm text-center shadow-[0_0_40px_rgba(6,182,212,0.15)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 to-emerald-500"></div>
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-in zoom-in duration-500 delay-100">
                    <Check className="text-emerald-400" size={40} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{showSuccess.title}</h3>
                  <p className="text-zinc-400 leading-relaxed mb-8">{showSuccess.message}</p>
                  <button
                    onClick={() => setShowSuccess(prev => ({ ...prev, isOpen: false }))}
                    className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-4 rounded-xl transition-all shadow-lg"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            )}
          </Layout>
        } />
      </Routes>
    </>
  );
}
