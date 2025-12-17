import React, { useState, useEffect } from 'react';
import { Routes as _Routes, Route as _Route, Navigate } from 'react-router-dom';

// Hack to fix React 19 vs React Router v6 type mismatch in this file
const Routes: any = _Routes;
const Route: any = _Route;
import { Layout } from '../components/layout/main-layout.component';
import { AIAssistant } from '../components/features/ai-assistant.component';
import WelcomePage from './welcome.page';
import { loadState, registerUser, loginUser, logoutUser, buyQuota, sellQuota, sellAllQuotas, requestLoan, fastForwardTime, repayLoan, getCurrentUser, resetPassword, requestWithdrawal, getPendingItems, processAdminAction, updateSystemBalance, updateProfitPool, distributeMonthlyDividends, fixLoanPix, clearAllCache } from '../../application/services/storage.service';
import { AppState, Quota, Loan, Transaction, User } from '../../domain/types/common.types';
import { ADMIN_PIX_KEY, QUOTA_PRICE, VESTING_PERIOD_MS } from '../../shared/constants/app.constants';
import { Wallet, TrendingUp, AlertTriangle, ArrowRight, DollarSign, Calendar, Lock, CheckCircle2, QrCode, ArrowUpRight, ArrowDownLeft, KeyRound, ChevronLeft, PieChart, Trash2, ArrowUpFromLine, Users, Repeat, Crown, Copy, ShieldCheck, Clock, Check, X as XIcon, RefreshCw, LogOut, Coins, PiggyBank, Star } from 'lucide-react';

// --- Admin Component ---

const AdminDashboard = ({ state, onRefresh, onLogout }: {
  state: AppState,
  onRefresh: () => void,
  onLogout: () => void,
}) => {
  const [pending, setPending] = useState<{ transactions: any[], loans: any[] }>({ transactions: [], loans: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        setIsLoading(true);
        const result = await getPendingItems();
        setPending(result);
      } catch (error) {
        console.error('Erro ao carregar itens pendentes:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPending();
  }, [state]);
  const [newBalance, setNewBalance] = useState('');
  const [newProfit, setNewProfit] = useState('');
  const [showDistributeModal, setShowDistributeModal] = useState(false);

  const parseCurrencyInput = (val: string) => {
    // Remove all non-numeric chars except dot and comma
    const clean = val.replace(/[^0-9,.]/g, '');
    // Replace comma with dot
    const standard = clean.replace(',', '.');
    return parseFloat(standard);
  }

  // handleUpdateBalance removido - caixa operacional agora é calculado automaticamente

  const handleUpdateProfit = async () => {
    try {
      const val = parseCurrencyInput(newProfit);
      if (isNaN(val)) throw new Error("Valor inválido");

      const result = await updateProfitPool(val);
      clearAllCache();
      onRefresh();
      setNewProfit('');

      // Mensagem atualizada para refletir a distribuição automática
      alert(`R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} adicionado com sucesso! O valor foi acumulado e será distribuído automaticamente à meia-noite (00:00).`);
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    }
  };

  const handleAction = async (id: string, type: 'TRANSACTION' | 'LOAN', action: 'APPROVE' | 'REJECT') => {
    try {
      console.log('DEBUG - Ação administrativa:', { id, type, action });

      await processAdminAction(id, type, action);

      // Limpar cache após ação administrativa para forçar atualização
      clearAllCache();

      // Aguardar um pouco para garantir que o backend processou
      await new Promise(resolve => setTimeout(resolve, 500));

      // Forçar atualização completa do estado
      console.log('DEBUG - Forçando atualização do estado após ação administrativa');
      await onRefresh();

      // Se for aprovação de empréstimo, mostrar mensagem específica
      if (type === 'LOAN' && action === 'APPROVE') {
        alert('Empréstimo aprovado com sucesso! O valor foi creditado no saldo do cliente.');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRejectPayment = async (transactionId: string) => {
    try {
      // Importar apiService dinamicamente para evitar problemas de importação circular
      const { apiService } = await import('../../application/services/api.service');

      // Verificar se está autenticado
      if (!apiService.isAuthenticated()) {
        alert('Sessão expirada. Por favor, faça login novamente.');
        onLogout();
        return;
      }

      // Chamar a API de rejeição de pagamento usando apiService
      const result = await apiService.rejectPayment(transactionId);

      console.log('DEBUG - Resposta da API de rejeição:', result);

      // O apiService já trata a resposta e retorna apenas o data se sucesso
      // ou lança erro se falhar
      if (result && result.success) {
        clearAllCache();
        onRefresh();
        const data = result.data || {};
        const amountRefunded = data.amountRefunded || 0;
        alert(`Pagamento rejeitado com sucesso! Empréstimo reativado para novo pagamento.${amountRefunded > 0 ? ` Saldo de R$ ${amountRefunded.toFixed(2)} reembolsado.` : ''}`);
      }
    } catch (e: any) {
      console.error('Erro ao rejeitar pagamento:', e);
      // Verificar se é um erro de autenticação
      if (e.message && e.message.includes('401')) {
        alert('Sessão expirada. Por favor, faça login novamente.');
        onLogout();
      } else {
        alert(e.message || "Erro ao rejeitar pagamento.");
      }
    }
  };

  const handleApprovePayment = async (transactionId: string): Promise<void> => {
    try {
      // Importar apiService dinamicamente para evitar problemas de importação circular
      const { apiService } = await import('../../application/services/api.service');

      // Verificar se está autenticado
      if (!apiService.isAuthenticated()) {
        alert('Sessão expirada. Por favor, faça login novamente.');
        onLogout();
        return;
      }

      // Chamar a API de aprovação de pagamento usando apiService
      const result = await apiService.approvePayment(transactionId);

      console.log('DEBUG - Resposta da API de aprovação:', result);

      // O apiService já trata a resposta e retorna apenas o data se sucesso
      // ou lança erro se falhar
      if (result && result.success) {
        const data = result.data || {};
        console.log('DEBUG - Resposta completa da API no frontend:', result);
        console.log('DEBUG - Valores específicos:', {
          principalReturned: data.principalReturned,
          interestAdded: data.interestAdded,
          interestForProfit: data.interestForProfit,
          interestForOperational: data.interestForOperational
        });

        // Verificar se os valores são válidos antes de exibir o alerta
        const principalValue = typeof data.principalReturned === 'number' ? data.principalReturned : 0;
        const interestValue = typeof data.interestAdded === 'number' ? data.interestAdded : 0;
        const profitValue = typeof data.interestForProfit === 'number' ? data.interestForProfit : 0;
        const operationalValue = typeof data.interestForOperational === 'number' ? data.interestForOperational : 0;

        console.log('DEBUG - Valores finais para alerta:', {
          principalValue,
          interestValue,
          profitValue,
          operationalValue
        });

        clearAllCache();
        onRefresh();
        alert(`Pagamento aprovado com sucesso! Principal devolvido: R$ ${principalValue.toFixed(2)}, Juros (85% para lucro: R$ ${profitValue.toFixed(2)}, 15% para caixa: R$ ${operationalValue.toFixed(2)})`);
      }
    } catch (e: any) {
      console.error('Erro ao aprovar pagamento:', e);
      // Verificar se é um erro de autenticação
      if (e.message && e.message.includes('401')) {
        alert('Sessão expirada. Por favor, faça login novamente.');
        onLogout();
      } else {
        alert(e.message || "Erro ao aprovar pagamento.");
      }
    }
  };

  const handleApproveWithdrawal = async (transactionId: string) => {
    try {
      // Importar apiService dinamicamente para evitar problemas de importação circular
      const { apiService } = await import('../../application/services/api.service');

      // Verificar se está autenticado
      if (!apiService.isAuthenticated()) {
        alert('Sessão expirada. Por favor, faça login novamente.');
        onLogout();
        return;
      }

      // Chamar a API de aprovação de saque usando apiService
      const result = await apiService.approveWithdrawal(transactionId);

      console.log('DEBUG - Resposta da API de aprovação de saque:', result);

      if (result && result.success) {
        const data = result.data || {};
        clearAllCache();
        onRefresh();
        alert(`Saque aprovado com sucesso! Valor líquido: R$ ${(data.netAmount || 0).toFixed(2)}, Taxa: R$ ${(data.feeAmount || 0).toFixed(2)} adicionada ao lucro de juros.`);
      }
    } catch (e: any) {
      console.error('Erro ao aprovar saque:', e);
      // Verificar se é um erro de autenticação
      if (e.message && e.message.includes('401')) {
        alert('Sessão expirada. Por favor, faça login novamente.');
        onLogout();
      } else {
        alert(e.message || "Erro ao aprovar saque.");
      }
    }
  };

  const handleRejectWithdrawal = async (transactionId: string) => {
    try {
      // Importar apiService dinamicamente para evitar problemas de importação circular
      const { apiService } = await import('../../application/services/api.service');

      // Verificar se está autenticado
      if (!apiService.isAuthenticated()) {
        alert('Sessão expirada. Por favor, faça login novamente.');
        onLogout();
        return;
      }

      // Chamar a API de rejeição de saque usando apiService
      const result = await apiService.rejectWithdrawal(transactionId);

      console.log('DEBUG - Resposta da API de rejeição de saque:', result);

      if (result && result.success) {
        clearAllCache();
        onRefresh();
        const data = result.data || {};
        // Verificar se amountRefunded existe antes de usar toFixed
        const amountRefunded = data.amountRefunded || 0;
        alert(`Saque rejeitado com sucesso! Valor de R$ ${amountRefunded.toFixed(2)} reembolsado na conta do cliente.`);
      }
    } catch (e: any) {
      console.error('Erro ao rejeitar saque:', e);
      // Verificar se é um erro de autenticação
      if (e.message && e.message.includes('401')) {
        alert('Sessão expirada. Por favor, faça login novamente.');
        onLogout();
      } else {
        alert(e.message || "Erro ao rejeitar saque.");
      }
    }
  };



  const confirmDistribution = async () => {
    try {
      await distributeMonthlyDividends();
      clearAllCache();
      onRefresh();
      setShowDistributeModal(false);
      alert("Distribuição de lucros realizada com sucesso!");
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleFixPix = async (loanId?: string, userEmail?: string) => {
    try {
      const id = loanId || '1';
      const email = userEmail || 'josiassm701@gmail.com';
      await fixLoanPix(id, email);
      clearAllCache();
      onRefresh();
      alert("PIX do empréstimo atualizado com sucesso!");
    } catch (e: any) {
      alert(`Erro ao atualizar PIX: ${e.message}`);
    }
  };

  const formatCurrency = (val: number) => {
    if (typeof val !== 'number' || isNaN(val)) {
      return 'R$ 0,00';
    }
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Calculations for Preview
  const profit = state.profitPool;
  const userShare = profit * 0.85;
  const maintShare = profit * 0.15;
  const perQuota = state.quotas.length > 0 ? userShare / state.quotas.length : 0;

  return (
    <div className="space-y-8">
      {/* Header with Admin Info */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl p-6 text-black">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <ShieldCheck size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Painel Administrativo</h1>
              <p className="text-sm opacity-80">Gerenciamento do Sistema Cred30</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                clearAllCache();
                onRefresh();
                alert("Cache limpo com sucesso! Dados atualizados.");
              }}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-2 transition"
              title="Limpar cache e atualizar dados"
            >
              <RefreshCw size={18} /> Limpar Cache
            </button>
            <button onClick={onLogout} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-2 transition">
              <LogOut size={18} /> Sair
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics Overview - Dashboard Financeiro Completo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white border border-blue-500/30 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Users size={24} className="text-white" />
            </div>
            <span className="text-sm font-medium opacity-90">Total Usuários</span>
          </div>
          <p className="text-3xl font-bold">{state.users.length}</p>
          <p className="text-xs opacity-75 mt-1">Cadastrados no sistema</p>
        </div>

        <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-6 text-white border border-primary-500/30 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <PieChart size={24} className="text-white" />
            </div>
            <span className="text-sm font-medium opacity-90">Cotas Ativas</span>
          </div>
          <p className="text-3xl font-bold">{state.stats?.quotasCount ?? 0}</p>
          <p className="text-xs opacity-75 mt-1">Status: ACTIVE</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white border border-emerald-500/30 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <DollarSign size={24} className="text-white" />
            </div>
            <span className="text-sm font-medium opacity-90">Caixa Operacional</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(state.systemBalance)}</p>
          <p className="text-xs opacity-75 mt-1">Disponível para operações</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-2xl p-6 text-white border border-yellow-500/30 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <PiggyBank size={24} className="text-white" />
            </div>
            <span className="text-sm font-medium opacity-90">Lucro Acumulado</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(state.profitPool)}</p>
          <p className="text-xs opacity-75 mt-1">85% para distribuição</p>
        </div>
      </div>

      {/* Resumo Financeiro Detalhado */}
      <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <TrendingUp className="text-emerald-400" size={20} />
          Resumo Financeiro Detalhado
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl p-4 border border-blue-500/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <ArrowUpFromLine className="text-blue-400" size={16} />
              </div>
              <span className="text-sm text-zinc-300 font-medium">Total Emprestado</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">
              {state.stats?.totalLoaned !== undefined ? formatCurrency(state.stats.totalLoaned) : 'R$ 0,00'}
            </p>
            <p className="text-xs text-zinc-500 mt-2">Valor em empréstimos ativos</p>
          </div>

          <div className="bg-gradient-to-br from-orange-900/30 to-orange-800/20 rounded-xl p-4 border border-orange-500/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <ArrowDownLeft className="text-orange-400" size={16} />
              </div>
              <span className="text-sm text-zinc-300 font-medium">A Receber</span>
            </div>
            <p className="text-2xl font-bold text-orange-400">
              {state.stats?.totalToReceive !== undefined ? formatCurrency(state.stats.totalToReceive) : 'R$ 0,00'}
            </p>
            <p className="text-xs text-zinc-500 mt-2">Principal + juros</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 rounded-xl p-4 border border-emerald-500/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <PieChart className="text-emerald-400" size={16} />
              </div>
              <span className="text-sm text-zinc-300 font-medium">Valor por Cota</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">
              {state.stats?.quotasCount && state.stats.quotasCount > 0 ? formatCurrency((state.profitPool * 0.85) / state.stats.quotasCount) : 'R$ 0,00'}
            </p>
            <p className="text-xs text-zinc-500 mt-2">85% dos lucros / cota</p>
          </div>
        </div>
      </div>

      {/* Control Panels - Sistema Financeiro */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Balance Control - Now Automatic */}
        <div className="bg-gradient-to-br from-surface to-surfaceHighlight rounded-2xl p-6 border border-surfaceHighlight shadow-xl">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center">
              <DollarSign className="text-primary-400" size={20} />
            </div>
            Caixa Operacional
            <span className="ml-2 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full font-medium">Automático</span>
          </h3>
          <div className="bg-gradient-to-r from-background to-surfaceHighlight rounded-xl p-6 mb-6 border border-surfaceHighlight/50">
            <p className="text-sm text-zinc-400 mb-2 font-medium">Saldo Disponível</p>
            <p className="text-3xl font-bold text-white">{formatCurrency(state.systemBalance)}</p>
            <p className="text-xs text-zinc-500 mt-2">Disponível para operações do sistema</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-blue-300 text-sm flex items-center gap-2">
              <RefreshCw size={16} className="text-blue-400" />
              Cálculo Automático
            </h4>
            <div className="space-y-2 text-sm text-blue-200">
              <p>• Total de cotas ativas × R$ 50,00</p>
              <p>• Menos: Valor total emprestado</p>
              <p>• Igual: Caixa disponível</p>
            </div>
            <div className="mt-3 pt-3 border-t border-blue-500/20">
              <p className="text-xs text-blue-300 font-medium">
                <strong>Exemplo:</strong> 10 cotas (R$ 500) - R$ 200 emprestados = R$ 300 disponíveis
              </p>
            </div>
          </div>
        </div>

        {/* Profit Pool Control */}
        <div className="bg-gradient-to-br from-surface to-surfaceHighlight rounded-2xl p-6 border border-surfaceHighlight shadow-xl">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <PiggyBank className="text-emerald-400" size={20} />
            </div>
            Lucro de Juros Acumulado
          </h3>
          <div className="bg-gradient-to-r from-background to-surfaceHighlight rounded-xl p-6 mb-6 border border-surfaceHighlight/50">
            <p className="text-sm text-zinc-400 mb-2 font-medium">Acumulado para Distribuição</p>
            <p className="text-3xl font-bold text-emerald-400">{formatCurrency(state.profitPool)}</p>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-emerald-500/10 rounded-lg p-3">
                <p className="text-xs text-emerald-300 mb-1">Total Cotas</p>
                <p className="text-lg font-bold text-emerald-400">{state.stats?.quotasCount ?? 0}</p>
              </div>
              <div className="bg-blue-500/10 rounded-lg p-3">
                <p className="text-xs text-blue-300 mb-1">Valor por Cota</p>
                <p className="text-lg font-bold text-blue-400">
                  {state.stats?.quotasCount && state.stats.quotasCount > 0 ? formatCurrency((state.profitPool * 0.85) / state.stats.quotasCount) : 'R$ 0,00'}
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <p className="text-xs text-yellow-300">
                <strong>Regra de Distribuição:</strong> 85% para cotistas e 15% para manutenção. A distribuição ocorre automaticamente todos os dias às 00:00.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <label className="text-xs text-zinc-400 block mb-2 font-medium">Adicionar Lucro (Ex: 200,50)</label>
              <input
                type="text"
                placeholder="200,50"
                value={newProfit}
                onChange={(e) => setNewProfit(e.target.value)}
                className="w-full bg-background border border-surfaceHighlight rounded-xl px-4 py-4 text-white outline-none focus:border-emerald-500 transition text-lg font-medium"
              />
            </div>
            <button
              onClick={handleUpdateProfit}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              <Coins size={18} />
              Adicionar Lucro
            </button>
            {(state.stats?.quotasCount ?? 0) === 0 && (
              <p className="text-xs text-blue-400 text-center bg-blue-400/10 rounded-lg p-2">
                ℹ️ Não há cotas ativas no sistema
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Approval Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pending Transactions */}
        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><RefreshCw size={18} /> Transações Pendentes ({pending.transactions?.length || 0})</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {pending.transactions?.length === 0 && <p className="text-zinc-500 text-sm">Nenhuma transação pendente.</p>}
            {pending.transactions?.map((t) => {
              // Parse metadata para obter informações de taxa e valor líquido
              let metadata: any = {};
              try {
                // Verificar se metadata já é um objeto
                if (t.metadata && typeof t.metadata === 'object') {
                  metadata = t.metadata;
                  console.log('DEBUG - Metadata já é objeto (frontend):', metadata);
                } else {
                  // Se for string, fazer parse
                  const metadataStr = String(t.metadata || '{}').trim();
                  console.log('DEBUG - Metadata da transação (frontend):', metadataStr);
                  if (metadataStr.startsWith('{') || metadataStr.startsWith('[')) {
                    metadata = JSON.parse(metadataStr);
                    console.log('DEBUG - Metadata parseado (frontend):', metadata);
                  }
                }
              } catch (error) {
                console.error('Erro ao fazer parse do metadata no frontend:', error);
              }

              const isLoanPayment = t.type === 'LOAN_PAYMENT';
              const canApprovePayment = isLoanPayment && t.status === 'PENDING';

              return (
                <div key={t.id} className="bg-background p-4 rounded-xl border border-surfaceHighlight flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.type === 'BUY_QUOTA' ? 'bg-primary-900 text-primary-200' : isLoanPayment ? 'bg-blue-900 text-blue-200' : 'bg-orange-900 text-orange-200'}`}>
                        {t.type === 'BUY_QUOTA' ? 'COMPRA COTA' : isLoanPayment ? 'PGTO EMPRÉSTIMO' : 'SAQUE'}
                      </span>
                      <span className="text-zinc-400 text-xs">{t.date ? new Date(t.date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'Data não disponível'}</span>
                    </div>

                    {/* Informações do Cliente */}
                    <div className="bg-surfaceHighlight/50 rounded-lg p-2 mb-2">
                      <p className="text-xs text-zinc-400 mb-1">Cliente</p>
                      <p className="text-sm font-medium text-white">{t.user_name || 'Nome não disponível'}</p>
                      <p className="text-xs text-zinc-500">ID: {t.user_id} | {t.user_email || 'Email não disponível'}</p>
                    </div>

                    <p className="text-white font-medium">{t.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-xl font-bold text-white">{formatCurrency(t.amount)}</p>
                      {t.type === 'WITHDRAWAL' && metadata.fee && (
                        <div className="text-right">
                          <p className="text-xs text-red-400">Taxa: {formatCurrency(metadata.fee)}</p>
                          <p className="text-xs text-emerald-400">Líquido: {formatCurrency(metadata.netAmount)}</p>
                        </div>
                      )}
                      {isLoanPayment && (
                        <div className="text-right">
                          <p className="text-xs text-emerald-400">Principal: {formatCurrency(metadata.principalAmount || 0)}</p>
                          <p className="text-xs text-orange-400">Juros: {formatCurrency(metadata.interestAmount || 0)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {isLoanPayment && canApprovePayment ? (
                      <>
                        <button
                          title="Aprovar Pagamento"
                          onClick={() => handleApprovePayment(t.id)}
                          className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"
                        >
                          <DollarSign size={20} />
                        </button>
                        <button
                          title="Rejeitar Pagamento"
                          onClick={() => handleRejectPayment(t.id)}
                          className="p-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30"
                        >
                          <XIcon size={20} />
                        </button>
                      </>
                    ) : t.type === 'WITHDRAWAL' ? (
                      <>
                        <button
                          title="Aprovar Saque"
                          onClick={() => handleApproveWithdrawal(t.id)}
                          className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30"
                        >
                          <DollarSign size={20} />
                        </button>
                        <button
                          title="Rejeitar Saque"
                          onClick={() => handleRejectWithdrawal(t.id)}
                          className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                        >
                          <XIcon size={20} />
                        </button>
                      </>
                    ) : (
                      <button title="Aprovar" onClick={() => handleAction(t.id, 'TRANSACTION', 'APPROVE')} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30"><Check size={20} /></button>
                    )}
                    {!isLoanPayment && t.type !== 'WITHDRAWAL' && (
                      <button title="Rejeitar" onClick={() => handleAction(t.id, 'TRANSACTION', 'REJECT')} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"><XIcon size={20} /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Loans */}
        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><DollarSign size={18} /> Empréstimos Solicitados ({pending.loans?.length || 0})</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {pending.loans?.length === 0 && <p className="text-zinc-500 text-sm">Nenhum empréstimo pendente.</p>}
            {pending.loans?.map(l => {
              return (
                <div key={l.id} className="bg-background p-4 rounded-xl border border-surfaceHighlight flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-900 text-blue-200">
                        SOLICITAÇÃO EMPRÉSTIMO
                      </span>
                      <span className="text-zinc-400 text-xs">{l.created_at || l.createdAt ? new Date(l.created_at || l.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'Data não disponível'}</span>
                    </div>

                    {/* Informações do Cliente */}
                    <div className="bg-surfaceHighlight/50 rounded-lg p-2 mb-2">
                      <p className="text-xs text-zinc-400 mb-1">Cliente</p>
                      <p className="text-sm font-medium text-white">{l.userName || l.user_name || 'Nome não disponível'}</p>
                      <p className="text-xs text-zinc-500">ID: {l.userId || l.user_id} | {l.userEmail || l.user_email || 'Email não disponível'}</p>
                    </div>

                    <p className="text-xl font-bold text-white">{formatCurrency(l.amount)}</p>
                    <p className="text-xs text-zinc-400 mt-1">Pix Destino: {l.pixKeyToReceive || 'Não informado'}</p>
                    <p className="text-xs text-zinc-500">Pagar: {formatCurrency(l.totalRepayment)} em {l.installments}x</p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button title="Corrigir PIX" onClick={() => handleFixPix(l.id, l.user_email)} className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"><RefreshCw size={20} /></button>
                    <button title="Aprovar" onClick={() => handleAction(l.id, 'LOAN', 'APPROVE')} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30"><Check size={20} /></button>
                    <button title="Rejeitar" onClick={() => handleAction(l.id, 'LOAN', 'REJECT')} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"><XIcon size={20} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Distribution Modal */}
      {showDistributeModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-gradient-to-br from-surface to-surfaceHighlight rounded-3xl p-8 w-full max-w-md relative animate-fade-in border border-surfaceHighlight shadow-2xl">
            <button title="Fechar" onClick={() => setShowDistributeModal(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"><XIcon size={24} /></button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <PiggyBank className="text-emerald-400" size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Distribuir Lucros</h3>
                <p className="text-sm text-zinc-400">Repartição proporcional aos cotistas</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-background to-surfaceHighlight rounded-2xl p-6 mb-6 border border-surfaceHighlight/50 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-zinc-700">
                <span className="text-zinc-400 font-medium">Lucro Total Disponível</span>
                <span className="text-emerald-400 font-bold text-xl">{formatCurrency(profit)}</span>
              </div>

              <div className="bg-emerald-500/10 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium flex items-center gap-2">
                    <Users size={16} className="text-emerald-400" />
                    Para Cotistas (85%)
                  </span>
                  <span className="text-emerald-400 font-bold text-lg">{formatCurrency(userShare)}</span>
                </div>
                <div className="flex justify-between text-sm text-zinc-400 pt-2 border-t border-emerald-500/20">
                  <span>{state.stats?.quotasCount ?? 0} cotas ativas</span>
                  <span className="text-emerald-300 font-medium">{formatCurrency(perQuota)} por cota</span>
                </div>
              </div>

              <div className="bg-zinc-700/30 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-300 font-medium flex items-center gap-2">
                    <ShieldCheck size={16} className="text-zinc-400" />
                    Manutenção (15%)
                  </span>
                  <span className="text-zinc-200 font-bold">{formatCurrency(maintShare)}</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-blue-400 flex-shrink-0 mt-0.5" size={16} />
                <div className="text-sm">
                  <p className="text-blue-300 font-medium">Importante</p>
                  <p className="text-blue-200/80 text-xs mt-1">
                    Ao confirmar, o saldo do "Lucro de Juros" será zerado e os valores serão creditados imediatamente nas contas dos usuários.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDistributeModal(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDistribution}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                <Coins size={18} />
                Confirmar Distribuição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Auth Component ---

const AuthScreen = ({ onLogin }: { onLogin: (u: User) => void }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [isForgot, setIsForgot] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secretPhrase, setSecretPhrase] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isForgot) {
        resetPassword(email, secretPhrase, newPassword);
        alert('Senha redefinida com sucesso! Faça login.');
        setIsForgot(false);
        setNewPassword('');
        return;
      }

      if (isRegister) {
        const user = registerUser(name, email, password, pixKey, secretPhrase, referralCode);
        user.then(u => onLogin(u));
      } else {
        const user = loginUser(email, password, secretPhrase);
        user.then(u => onLogin(u));
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-surface border border-surfaceHighlight p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary-400 to-primary-600"></div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center text-black font-bold text-3xl shadow-[0_0_20px_rgba(34,211,238,0.4)] mx-auto mb-4">
            C
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Cred<span className="text-primary-400">30</span></h1>
          <p className="text-zinc-500 mt-2 text-sm">Sua liberdade financeira começa aqui.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isForgot ? (
            <>
              <h2 className="text-white text-lg font-medium text-center mb-4">Recuperar Senha</h2>
              <div className="space-y-4">
                <div className="relative">
                  <Users className="absolute left-3 top-3 text-zinc-500" size={20} />
                  <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" required />
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 text-zinc-500" size={20} />
                  <input type="text" placeholder="Frase Secreta" value={secretPhrase} onChange={e => setSecretPhrase(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" required />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-zinc-500" size={20} />
                  <input type="password" placeholder="Nova Senha" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" required />
                </div>
              </div>
              <button type="submit" className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] mt-4">Redefinir Senha</button>
              <button type="button" onClick={() => setIsForgot(false)} className="w-full text-zinc-400 text-sm hover:text-white mt-2">Voltar para Login</button>
            </>
          ) : (
            <>
              {isRegister && (
                <div className="relative">
                  <Users className="absolute left-3 top-3 text-zinc-500" size={20} />
                  <input type="text" placeholder="Nome Completo" value={name} onChange={e => setName(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" required />
                </div>
              )}
              <div className="relative">
                <Users className="absolute left-3 top-3 text-zinc-500" size={20} />
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" required />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-3 text-zinc-500" size={20} />
                <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" required />
              </div>

              <div className="relative">
                <KeyRound className="absolute left-3 top-3 text-zinc-500" size={20} />
                <input type="text" placeholder={isRegister ? "Crie sua Frase Secreta" : "Frase Secreta"} value={secretPhrase} onChange={e => setSecretPhrase(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" required />
              </div>

              {isRegister && (
                <>
                  <div className="relative">
                    <QrCode className="absolute left-3 top-3 text-zinc-500" size={20} />
                    <input type="text" placeholder="Sua Chave PIX" value={pixKey} onChange={e => setPixKey(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" required />
                  </div>
                  <div className="relative">
                    <Repeat className="absolute left-3 top-3 text-zinc-500" size={20} />
                    <input type="text" placeholder="Código de Indicação (Opcional)" value={referralCode} onChange={e => setReferralCode(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" />
                  </div>
                </>
              )}

              <button type="submit" className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] mt-4">
                {isRegister ? 'Criar Conta' : 'Entrar'}
              </button>
            </>
          )}
        </form>

        {!isForgot && (
          <div className="mt-6 text-center space-y-2">
            <p className="text-zinc-400 text-sm">
              {isRegister ? 'Já tem uma conta?' : 'Não tem uma conta?'}
              <button onClick={() => setIsRegister(!isRegister)} className="ml-2 text-primary-400 hover:text-primary-300 font-medium">
                {isRegister ? 'Fazer Login' : 'Criar Agora'}
              </button>
            </p>
            {!isRegister && (
              <button onClick={() => setIsForgot(true)} className="text-zinc-500 text-sm hover:text-zinc-300">
                Esqueci minha senha
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Client Views ---

const Dashboard = ({ state, onBuyQuota, onReinvest, onRefer, onVip, onLogout }: { state: AppState, onBuyQuota: () => void, onReinvest: () => void, onRefer: () => void, onVip: () => void, onLogout: () => void }) => {
  const user = state.currentUser!;
  const userQuotas = state.quotas.filter((q: any) => q.userId === user.id);
  const totalInvested = userQuotas.reduce((acc: number, q: any) => acc + q.purchasePrice, 0);
  const userLoans = state.loans.filter((l: any) => l.userId === user.id && l.status === 'APPROVED');
  const totalDebt = userLoans.reduce((acc: number, l: any) => acc + l.totalRepayment, 0);

  // VIP Level Logic
  let vipLevel = 'Bronze';
  if (userQuotas.length >= 50) vipLevel = 'Ouro';
  else if (userQuotas.length >= 10) vipLevel = 'Prata';

  // Calculate additional metrics
  const totalEarnings = userQuotas.reduce((acc: number, q: any) => acc + (q.currentValue - q.purchasePrice), 0);
  const earningsPercentage = totalInvested > 0 ? (totalEarnings / totalInvested) * 100 : 0;
  const nextLevelQuotas = vipLevel === 'Bronze' ? 10 : vipLevel === 'Prata' ? 50 : 0;
  const progressToNext = nextLevelQuotas > 0 ? (userQuotas.length / nextLevelQuotas) * 100 : 100;


  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-6">
      {/* Header with User Info */}
      <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-black font-bold text-2xl">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{user.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${vipLevel === 'Ouro' ? 'bg-yellow-500 text-black' : vipLevel === 'Prata' ? 'bg-zinc-400 text-black' : 'bg-orange-600 text-white'}`}>
                  {vipLevel}
                </span>
                <span className="text-zinc-400 text-sm">Membro desde {user.joinedAt ? new Date(user.joinedAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Data não disponível'}</span>
              </div>
              <p className="text-zinc-400 text-sm mt-1">Código: {user.referralCode}</p>
            </div>
          </div>
          <button title="Sair" onClick={onLogout} className="md:hidden text-zinc-400 hover:text-white p-2 bg-surfaceHighlight rounded-lg">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-6 text-black relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={20} />
              <span className="text-sm font-medium">Saldo</span>
            </div>
            <h3 className="text-2xl font-bold">{formatCurrency(user.balance)}</h3>
          </div>
        </div>

        {/* Investment Card */}
        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6 relative">
          <div className="absolute top-0 right-0 p-2 opacity-10"><TrendingUp size={40} /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <PieChart size={20} className="text-primary-400" />
              <span className="text-sm font-medium text-zinc-400">Total Investido</span>
            </div>
            <h3 className="text-2xl font-bold text-white">{formatCurrency(totalInvested)}</h3>
            <p className="text-xs text-zinc-500 mt-1">{userQuotas.length} cotas</p>
          </div>
        </div>

        {/* Earnings Card */}
        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6 relative">
          <div className="absolute top-0 right-0 p-2 opacity-10"><ArrowUpRight size={40} /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpFromLine size={20} className="text-emerald-400" />
              <span className="text-sm font-medium text-zinc-400">Rendimentos</span>
            </div>
            <h3 className="text-2xl font-bold text-emerald-400">{formatCurrency(totalEarnings)}</h3>
            <p className="text-xs text-zinc-500 mt-1">+{earningsPercentage.toFixed(1)}%</p>
          </div>
        </div>


        {/* Debt Card */}
        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6 relative">
          <div className="absolute top-0 right-0 p-2 opacity-10"><AlertTriangle size={40} /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={20} className="text-red-400" />
              <span className="text-sm font-medium text-zinc-400">Dívida Ativa</span>
            </div>
            <h3 className="text-2xl font-bold text-red-400">{formatCurrency(totalDebt)}</h3>
            <p className="text-xs text-zinc-500 mt-1">{userLoans.length} empréstimos</p>
          </div>
        </div>
      </div>

      {/* VIP Progress */}
      {vipLevel !== 'Ouro' && (
        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Progresso para {nextLevelQuotas === 10 ? 'Prata' : 'Ouro'}</h3>
            <span className="text-sm text-zinc-400">{userQuotas.length}/{nextLevelQuotas} cotas</span>
          </div>
          <div className="w-full bg-zinc-700 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-500"
              style={{ width: `${Math.min(progressToNext, 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-zinc-500 mt-2">Faltam {nextLevelQuotas - userQuotas.length} cotas para alcançar o próximo nível</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={onBuyQuota} className="bg-surface hover:bg-surfaceHighlight border border-surfaceHighlight p-4 rounded-2xl flex flex-col items-center gap-2 transition group">
          <div className="bg-primary-900/30 p-3 rounded-full text-primary-400 group-hover:scale-110 transition"><TrendingUp size={24} /></div>
          <span className="text-sm font-medium text-white">Investir</span>
        </button>
        <button onClick={onReinvest} className="bg-surface hover:bg-surfaceHighlight border border-surfaceHighlight p-4 rounded-2xl flex flex-col items-center gap-2 transition group">
          <div className="bg-emerald-900/30 p-3 rounded-full text-emerald-400 group-hover:scale-110 transition"><Repeat size={24} /></div>
          <span className="text-sm font-medium text-white">Reinvestir</span>
        </button>
        <button onClick={onRefer} className="bg-surface hover:bg-surfaceHighlight border border-surfaceHighlight p-4 rounded-2xl flex flex-col items-center gap-2 transition group">
          <div className="bg-purple-900/30 p-3 rounded-full text-purple-400 group-hover:scale-110 transition"><Users size={24} /></div>
          <span className="text-sm font-medium text-white">Indicar</span>
        </button>
        <button onClick={onVip} className="bg-surface hover:bg-surfaceHighlight border border-surfaceHighlight p-4 rounded-2xl flex flex-col items-center gap-2 transition group">
          <div className="bg-orange-900/30 p-3 rounded-full text-orange-400 group-hover:scale-110 transition"><Crown size={24} /></div>
          <span className="text-sm font-medium text-white">Níveis VIP</span>
        </button>
      </div>

      {/* Recent Transactions (Extrato) */}
      <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Últimas Transações</h3>
        <div className="space-y-4">
          {state.transactions.filter((t: any) => t.userId === user.id).slice(-5).reverse().map((t: any) => (
            <div key={t.id} className="flex justify-between items-center border-b border-surfaceHighlight pb-3 last:border-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${t.type === 'DEPOSIT' || t.type === 'LOAN_RECEIVED' || t.type === 'SELL_QUOTA' || t.type === 'REFERRAL_BONUS'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : t.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                  {t.status === 'PENDING' ? <Clock size={18} /> : t.type === 'DEPOSIT' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{t.description}</p>
                  <p className="text-xs text-zinc-500">{t.date ? new Date(t.date).toLocaleDateString('pt-BR') : 'Data não disponível'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold ${t.status === 'PENDING' ? 'text-yellow-400' :
                  (t.type === 'DEPOSIT' || t.type === 'LOAN_RECEIVED' || t.type === 'SELL_QUOTA' || t.type === 'REFERRAL_BONUS')
                    ? 'text-emerald-400'
                    : 'text-white'
                  }`}>
                  {t.type === 'WITHDRAWAL' || t.type === 'BUY_QUOTA' || t.type === 'LOAN_PAYMENT' ? '-' : '+'}
                  {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                {t.status === 'PENDING' && <p className="text-[10px] text-yellow-500">Em Análise</p>}
              </div>
            </div>
          ))}
          {state.transactions.filter((t: any) => t.userId === user.id).length === 0 && (
            <p className="text-zinc-500 text-center text-sm py-4">Nenhuma movimentação recente.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const InvestView = ({ onBuy }: { onBuy: (qty: number, method: 'PIX' | 'BALANCE') => void }) => {
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState<'PIX' | 'BALANCE'>('PIX');
  const [showConfirm, setShowConfirm] = useState(false);

  const handlePurchase = () => {
    onBuy(qty, method);
    setShowConfirm(false);
  };

  return (
    <div className="max-w-md mx-auto pb-40 relative">
      <div className="bg-surface border border-surfaceHighlight rounded-3xl p-8 text-center relative overflow-hidden mb-6">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-400 to-primary-600"></div>
        <TrendingUp size={48} className="mx-auto text-primary-400 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Comprar Cota</h2>
        <p className="text-zinc-400 mb-6">Invista no seu futuro com rendimentos diários variáveis.</p>

        <div className="text-4xl font-bold text-white mb-8">
          {QUOTA_PRICE.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          <span className="text-base font-normal text-zinc-500"> / unidade</span>
        </div>

        <div className="flex items-center justify-center gap-4 mb-8">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 rounded-full bg-surfaceHighlight text-white flex items-center justify-center hover:bg-zinc-700 transition">-</button>
          <span className="text-2xl font-bold text-white w-12">{qty}</span>
          <button onClick={() => setQty(qty + 1)} className="w-10 h-10 rounded-full bg-surfaceHighlight text-white flex items-center justify-center hover:bg-zinc-700 transition">+</button>
        </div>

        <div className="bg-background rounded-xl p-1 mb-6 flex">
          <button onClick={() => setMethod('PIX')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${method === 'PIX' ? 'bg-surfaceHighlight text-white' : 'text-zinc-500'}`}>Via PIX</button>
          <button onClick={() => setMethod('BALANCE')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${method === 'BALANCE' ? 'bg-surfaceHighlight text-white' : 'text-zinc-500'}`}>Usar Saldo</button>
        </div>

        <div className="bg-background rounded-xl p-4 border border-surfaceHighlight">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-zinc-400">Quantidade</span>
            <span className="text-white">{qty}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span className="text-white">Total</span>
            <span className="text-primary-400">{(qty * QUOTA_PRICE).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </div>
      </div>

      {/* Main Action Button */}
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="relative z-[100] w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
      >
        Confirmar Compra
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4">
          <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative animate-fade-in">
            <button title="Fechar" onClick={() => setShowConfirm(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><XIcon size={20} /></button>

            <h3 className="text-xl font-bold text-white mb-4">Finalizar Compra</h3>

            <div className="bg-background border border-zinc-700 rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm text-zinc-400 mb-1">
                <span>Itens</span>
                <span>{qty}x Cotas</span>
              </div>
              <div className="flex justify-between text-lg text-white font-bold">
                <span>Total</span>
                <span>{(qty * QUOTA_PRICE).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>

            {method === 'PIX' ? (
              <>
                <p className="text-zinc-300 text-sm mb-2">Copie a chave abaixo para pagamento:</p>
                <div className="bg-background border border-dashed border-primary-500/50 rounded-xl p-3 flex items-center justify-between mb-4 relative cursor-pointer" onClick={() => navigator.clipboard.writeText(ADMIN_PIX_KEY)}>
                  <span className="font-mono text-white text-sm truncate mr-2">{ADMIN_PIX_KEY}</span>
                  <Copy size={16} className="text-primary-400" />
                </div>
                <p className="text-xs text-zinc-500 mb-4 text-center">Após enviar o PIX, clique no botão abaixo para notificar o administrador.</p>
                <button onClick={handlePurchase} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl transition">
                  Já enviei o PIX
                </button>
              </>
            ) : (
              <>
                <p className="text-zinc-300 text-sm mb-4">O valor será debitado do seu saldo disponível imediatamente.</p>
                <button onClick={handlePurchase} className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-3 rounded-xl transition">
                  Confirmar Pagamento
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const PortfolioView = ({ quotas, hasLoans, onSell, onSellAll }: { quotas: Quota[], hasLoans: boolean, onSell: (id: string) => void, onSellAll: () => void }) => {
  const [selectedQuotaId, setSelectedQuotaId] = useState<string | null>(null);
  const [isSellAll, setIsSellAll] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Verificação de segurança para garantir que quotas é um array válido
  const safeQuotas = Array.isArray(quotas) ? quotas : [];

  // Verificação adicional para garantir que não ocorram erros durante o cálculo
  const totalValue = safeQuotas.reduce((acc: number, q: any) => {
    if (!q || typeof q.purchasePrice !== 'number') return acc;
    return acc + q.purchasePrice;
  }, 0);

  const totalCurrentValue = safeQuotas.reduce((acc: number, q: any) => {
    if (!q || typeof q.currentValue !== 'number') return acc;
    return acc + q.currentValue;
  }, 0);

  const totalEarnings = totalCurrentValue - totalValue;
  const earningsPercentage = totalValue > 0 ? (totalEarnings / totalValue) * 100 : 0;

  const initiateSell = (id: string) => {
    setSelectedQuotaId(id);
    setIsSellAll(false);
    setShowConfirm(true);
  }

  const initiateSellAll = () => {
    setIsSellAll(true);
    setSelectedQuotaId(null);
    setShowConfirm(true);
  }

  const handleConfirm = () => {
    if (isSellAll) {
      onSellAll();
    } else if (selectedQuotaId) {
      onSell(selectedQuotaId);
    }
    setShowConfirm(false);
  }

  // Calculate Data for Modal
  let modalTitle = "";
  let originalValue = 0;
  let penaltyValue = 0;
  let netValue = 0;
  let isPenaltyApplied = false;

  if (showConfirm) {
    if (isSellAll) {
      modalTitle = "Resgate Total (Venda em Massa)";
      safeQuotas.forEach(q => {
        if (!q) return;
        const daysHeld = Math.floor((Date.now() - (Number(q.purchaseDate) || 0)) / (1000 * 60 * 60 * 24));
        const isEarly = daysHeld < 365;
        const penalty = isEarly ? (q.purchasePrice || 0) * 0.4 : 0;
        originalValue += q.purchasePrice || 0;
        penaltyValue += penalty;
        if (isEarly) isPenaltyApplied = true;
      });
      netValue = originalValue - penaltyValue;
    } else if (selectedQuotaId) {
      modalTitle = `Resgate Cota #${typeof selectedQuotaId === 'string' ? selectedQuotaId.substring(0, 4) : 'N/A'}`;
      const quota = safeQuotas.find(q => q?.id === selectedQuotaId);
      if (quota) {
        const daysHeld = Math.floor((Date.now() - (Number(quota.purchaseDate) || 0)) / (1000 * 60 * 60 * 24));
        const isEarly = daysHeld < 365;
        isPenaltyApplied = isEarly;
        originalValue = quota.purchasePrice || 0;
        penaltyValue = isEarly ? (quota.purchasePrice || 0) * 0.4 : 0;
        netValue = originalValue - penaltyValue;
      }
    }
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Portfolio Header with Enhanced Stats */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl p-6 text-black">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-2xl font-bold">Sua Carteira</h2>
            <p className="text-sm opacity-80">Gerencie seus investimentos</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-80">Valor Total</p>
            <p className="text-3xl font-bold">{totalCurrentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white/20 rounded-xl p-4">
            <p className="text-sm opacity-80 mb-1">Investido</p>
            <p className="text-xl font-bold">{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
          <div className="bg-white/20 rounded-xl p-4">
            <p className="text-sm opacity-80 mb-1">Rendimentos</p>
            <p className={`text-xl font-bold ${totalEarnings >= 0 ? 'text-green-800' : 'text-red-800'}`}>
              {totalEarnings >= 0 ? '+' : ''}{totalEarnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <p className={`text-xs ${totalEarnings >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {earningsPercentage >= 0 ? '+' : ''}{earningsPercentage.toFixed(1)}%
            </p>
          </div>
          <div className="bg-white/20 rounded-xl p-4">
            <p className="text-sm opacity-80 mb-1">Total de Cotas</p>
            <p className="text-xl font-bold">{safeQuotas.length}</p>
          </div>
        </div>
      </div>

      {hasLoans && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 flex items-start gap-3">
          <Lock className="text-yellow-500 mt-1 flex-shrink-0" size={20} />
          <div>
            <h4 className="text-yellow-500 font-bold text-sm">Resgate Bloqueado</h4>
            <p className="text-zinc-400 text-xs mt-1">
              Você possui empréstimos ativos. Para resgatar suas cotas, primeiro quite seus débitos pendentes.
            </p>
          </div>
        </div>
      )}

      {safeQuotas.length > 0 && (
        <button
          onClick={initiateSellAll}
          disabled={hasLoans}
          className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-red-400 border border-red-900/30 font-medium py-3 rounded-xl transition flex items-center justify-center gap-2"
        >
          <Trash2 size={18} /> Resgatar Tudo (Venda em Massa)
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {safeQuotas.map((quota: any, idx: number) => {
          // Verificação de segurança para cada quota
          if (!quota || !quota.id) return null;

          // Verificação adicional para garantir que todos os valores necessários existem
          const purchasePrice = typeof quota.purchasePrice === 'number' ? quota.purchasePrice : 0;
          const currentValue = typeof quota.currentValue === 'number' ? quota.currentValue : 0;
          const purchaseDate = quota.purchaseDate ? new Date(quota.purchaseDate).getTime() : Date.now();

          const daysHeld = Math.floor((Date.now() - purchaseDate) / (1000 * 60 * 60 * 24));
          const isEarly = daysHeld < 365;
          const penalty = isEarly ? purchasePrice * 0.4 : 0;
          const redeemValue = purchasePrice - penalty;
          const quotaEarnings = currentValue - purchasePrice;
          const quotaEarningsPercentage = purchasePrice > 0 ? (quotaEarnings / purchasePrice) * 100 : 0;

          return (
            <div key={quota.id} className="bg-surface border border-surfaceHighlight p-5 rounded-2xl relative group hover:border-primary-500/50 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-surfaceHighlight p-2 rounded-lg text-primary-400">
                  <PieChart size={20} />
                </div>
                <span className="text-xs font-mono text-zinc-600">#{typeof quota.id === 'string' ? quota.id.substring(0, 6) : 'N/A'}</span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <p className="text-zinc-400 text-xs">Valor Atual</p>
                  <p className="text-lg font-bold text-white">{currentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-zinc-400 text-xs">Rendimento</p>
                  <p className={`text-sm font-bold ${quotaEarnings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {quotaEarnings >= 0 ? '+' : ''}{quotaEarningsPercentage.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-zinc-500 mb-4">
                <div className="flex justify-between">
                  <span>Data Compra</span>
                  <span>{quota.purchaseDate ? new Date(quota.purchaseDate).toLocaleDateString('pt-BR') : 'Data não disponível'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tempo decorrido</span>
                  <span className={isEarly ? 'text-yellow-400' : 'text-emerald-400'}>{daysHeld} dias</span>
                </div>
                {isEarly && (
                  <div className="flex justify-between text-red-400 bg-red-900/20 rounded p-2">
                    <span>Multa Resgate (40%)</span>
                    <span>- {penalty.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => quota.id && initiateSell(quota.id)}
                disabled={hasLoans}
                className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-white border border-zinc-700 font-medium py-2 rounded-lg text-sm transition flex items-center justify-center gap-2"
              >
                {hasLoans && <Lock size={12} />} Resgatar {redeemValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </button>
            </div>
          );
        })}
        {safeQuotas.length === 0 && (
          <div className="col-span-full text-center py-12 text-zinc-500 bg-surface/50 rounded-3xl border border-surfaceHighlight border-dashed">
            Você ainda não possui cotas.
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4">
          <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative animate-fade-in">
            <button title="Fechar" onClick={() => setShowConfirm(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><XIcon size={20} /></button>

            <h3 className="text-xl font-bold text-white mb-4">{modalTitle || 'Confirmar Resgate'}</h3>

            {isPenaltyApplied && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 flex gap-3 items-start">
                <AlertTriangle className="text-red-400 flex-shrink-0" size={20} />
                <div>
                  <p className="text-red-400 font-bold text-sm">Multa por Resgate Antecipado</p>
                  <p className="text-red-200/70 text-xs mt-1">
                    O período de carência é de 1 ano. Resgates antes deste prazo sofrem desconto de 40% sobre o valor original.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-background border border-zinc-700 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm text-zinc-400">
                <span>Valor Original</span>
                <span>{(typeof originalValue === 'number' ? originalValue : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="flex justify-between text-sm text-red-400">
                <span>Descontos / Multas</span>
                <span>- {(typeof penaltyValue === 'number' ? penaltyValue : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="border-t border-zinc-700 my-2"></div>
              <div className="flex justify-between text-lg text-white font-bold">
                <span>Você Recebe</span>
                <span className="text-emerald-400">{(typeof netValue === 'number' ? netValue : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>

            <button onClick={handleConfirm} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition border border-zinc-600">
              Confirmar Resgate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const LoansView = ({ loans, onRequest, onPay, onPayInstallment, userBalance }: {
  loans: Loan[],
  onRequest: (amount: number, installments: number, pix: string) => void,
  onPay: (id: string, useBalance: boolean) => void,
  onPayInstallment: (id: string, amount: number, useBalance: boolean) => void,
  userBalance: number
}) => {
  const [amount, setAmount] = useState('');
  const [pix, setPix] = useState('');
  const [installments, setInstallments] = useState(1);
  const [payModalId, setPayModalId] = useState<string | null>(null);
  const [installmentModalData, setInstallmentModalData] = useState<{ loanId: string, installmentAmount: number } | null>(null);

  const activeLoans = loans.filter(l => l.status === 'APPROVED' || l.status === 'PENDING' || l.status === 'PAYMENT_PENDING' || l.status === 'REJECTED');
  const selectedLoan = activeLoans.find(l => l.id === payModalId);
  const totalDebt = activeLoans.reduce((acc, l) => acc + (l.remainingAmount || l.totalRepayment), 0);
  const approvedLoans = activeLoans.filter(l => l.status === 'APPROVED');

  const interestRate = 0.20; // 20%
  const monthlyInterest = amount ? parseFloat(amount) * interestRate : 0;
  const totalInterest = monthlyInterest * installments;
  const total = amount ? parseFloat(amount) + totalInterest : 0;
  const monthlyPayment = total / installments;

  return (
    <div className="space-y-8">
      {/* Request Loan */}
      <div className="bg-gradient-to-br from-surface to-surfaceHighlight rounded-3xl p-6 border border-surfaceHighlight">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
            <DollarSign className="text-primary-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Solicitar Empréstimo</h2>
            <p className="text-zinc-400 text-sm">Crédito rápido e seguro para suas necessidades</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-medium">Valor desejado</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-zinc-500">R$</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white outline-none focus:border-primary-500 transition" placeholder="0.00" />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-3 font-medium">Parcelas</label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[1, 3, 6, 12].map(n => (
                  <button
                    key={n}
                    onClick={() => setInstallments(n)}
                    className={`py-2 rounded-lg text-sm font-bold border transition ${installments === n ? 'bg-primary-500 text-black border-primary-500' : 'bg-surfaceHighlight text-zinc-400 border-zinc-700 hover:bg-zinc-700'}`}
                  >
                    {n}x
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                <span>Selecionado: <strong className="text-white">{installments} meses</strong></span>
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-medium">Chave PIX para receber</label>
              <input
                type="text"
                value={pix}
                onChange={e => {
                  const newValue = e.target.value;
                  console.log('DEBUG - Campo PIX alterado:', {
                    newValue,
                    valorAnterior: pix,
                    vazio: !newValue,
                    trim: newValue ? newValue.trim() : 'N/A'
                  });
                  setPix(newValue);
                }}
                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white outline-none focus:border-primary-500 transition"
                placeholder="CPF, Email, Telefone..."
              />
            </div>
          </div>

          <div className="bg-background rounded-xl p-6 border border-surfaceHighlight flex flex-col justify-between">
            <div>
              <p className="text-sm text-zinc-400 mb-4 font-medium">Resumo da Simulação</p>

              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                  <span className="text-zinc-500 text-sm">Valor Solicitado</span>
                  <span className="text-white font-bold">{amount ? parseFloat(amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-sm">Juros Mensal</span>
                  <span className="text-red-400 font-bold">20%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-sm">Prazo</span>
                  <span className="text-white font-medium">{installments} Meses</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-sm">Valor da Parcela</span>
                  <span className="text-primary-400 font-medium">{installments > 0 ? (total / installments).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}</span>
                </div>
              </div>

              <div className="border-t border-zinc-800 my-4"></div>
              <div className="flex justify-between items-center">
                <span className="text-white font-bold">Total a Pagar</span>
                <span className="text-2xl font-bold text-primary-400">
                  {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                // DEBUG: Log antes de enviar a solicitação
                console.log('DEBUG - Botão solicitar clicado:', {
                  amount: parseFloat(amount),
                  installments,
                  pix,
                  pixVazio: !pix,
                  pixTrim: pix ? pix.trim() : 'N/A'
                });

                onRequest(parseFloat(amount), installments, pix);
              }}
              disabled={!amount || !pix}
              className="w-full bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl mt-4 transition"
            >
              Solicitar Agora
            </button>
          </div>
        </div>
      </div>

      {/* Active Loans List */}
      <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <AlertTriangle className="text-primary-400" size={20} />
          Meus Empréstimos
        </h3>

        <div className="space-y-4">
          {activeLoans.map((loan: any) => {
            const daysUntilDue = loan.dueDate ? Math.ceil((new Date(loan.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
            const isOverdue = daysUntilDue < 0;
            const isUrgent = daysUntilDue <= 3 && daysUntilDue >= 0;

            // Calcular progresso de pagamento
            const paidAmount = loan.totalPaid || 0;
            const remainingAmount = loan.remainingAmount || loan.totalRepayment;
            const paidInstallmentsCount = loan.paidInstallmentsCount || 0;
            const progressPercentage = (paidAmount / loan.totalRepayment) * 100;
            const installmentAmount = loan.totalRepayment / loan.installments;

            return (
              <div key={loan.id} className={`border rounded-xl p-5 transition-all ${isOverdue ? 'border-red-500/50 bg-red-500/5' : isUrgent ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-surfaceHighlight bg-surface'}`}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-full ${loan.status === 'PENDING' ? 'bg-yellow-500/20' : loan.status === 'APPROVED' ? 'bg-primary-500/20' : loan.status === 'PAYMENT_PENDING' ? 'bg-blue-500/20' : 'bg-red-500/20'}`}>
                      <AlertTriangle className={loan.status === 'PENDING' ? 'text-yellow-400' : loan.status === 'APPROVED' ? 'text-primary-400' : loan.status === 'PAYMENT_PENDING' ? 'text-blue-400' : 'text-red-400'} size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-bold text-lg">{loan.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        {loan.status === 'PENDING' && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">Aguardando Aprovação</span>}
                        {loan.status === 'PAYMENT_PENDING' && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Pagamento em Análise</span>}
                        {loan.status === 'REJECTED' && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Rejeitado</span>}
                        {loan.isFullyPaid && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Quitado</span>}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500">Parcelas:</span>
                          <span className="text-white font-medium">{loan.installments}x</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500">Vencimento:</span>
                          <span className={`font-medium ${isOverdue ? 'text-red-400' : isUrgent ? 'text-yellow-400' : 'text-white'}`}>
                            {loan.dueDate ? new Date(loan.dueDate).toLocaleDateString('pt-BR') : 'Data não disponível'}
                          </span>
                        </div>
                      </div>

                      {/* Progresso de Pagamento */}
                      {loan.status === 'APPROVED' && (paidAmount > 0 || paidInstallmentsCount > 0) && (
                        <div className="mb-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-zinc-400">Progresso de Pagamento</span>
                            <span className="text-xs text-emerald-400 font-medium">
                              {paidInstallmentsCount}/{loan.installments} parcelas ({progressPercentage.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
                              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-emerald-400">Pago: {paidAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            <span className="text-zinc-400">Restante: {remainingAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          </div>
                        </div>
                      )}

                      {isOverdue && (
                        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                          <AlertTriangle size={12} />
                          Empréstimo vencido há {Math.abs(daysUntilDue)} dias
                        </p>
                      )}
                      {isUrgent && !isOverdue && (
                        <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1">
                          <AlertTriangle size={12} />
                          Vence em {daysUntilDue} dias
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Total a Pagar</p>
                      <p className="text-xl font-bold text-red-400">{loan.totalRepayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      <p className="text-xs text-zinc-500">{installmentAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/parcela</p>
                    </div>

                    {loan.status === 'APPROVED' && !loan.isFullyPaid && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setInstallmentModalData({ loanId: loan.id, installmentAmount })}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition text-sm"
                        >
                          Pagar Parcela
                        </button>
                        <button
                          onClick={() => setPayModalId(loan.id)}
                          className={`px-4 py-2 rounded-xl font-medium transition text-sm ${isOverdue ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-primary-500 hover:bg-primary-400 text-black'}`}
                        >
                          Pagar Tudo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {activeLoans.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-surfaceHighlight rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="text-zinc-500" size={32} />
              </div>
              <p className="text-zinc-500">Você não tem empréstimos ativos.</p>
              <p className="text-zinc-600 text-sm mt-1">Solicite crédito quando precisar de forma rápida e segura.</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal Rendered OUTSIDE the loop for Z-Index safety */}
      {selectedLoan && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold text-white mb-4">Confirmar Pagamento</h3>
            <p className="text-zinc-400 text-sm mb-6">
              Escolha como deseja quitar a dívida de <strong className="text-white">{selectedLoan.totalRepayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>.
            </p>

            <div className="bg-background p-3 rounded-xl mb-4 border border-surfaceHighlight">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-400">Seu Saldo</span>
                <span className="text-white font-bold">{userBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>

            <button
              onClick={() => { onPay(selectedLoan.id, true); setPayModalId(null); }}
              disabled={userBalance < selectedLoan.totalRepayment}
              className="w-full bg-primary-500 hover:bg-primary-400 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl mb-3"
            >
              {userBalance < selectedLoan.totalRepayment ? 'Saldo Insuficiente' : 'Pagar com Saldo'}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-700"></div></div>
              <div className="relative flex justify-center"><span className="bg-surface px-2 text-xs text-zinc-500 uppercase">Ou via PIX</span></div>
            </div>

            <div className="bg-background p-3 rounded-xl border border-surfaceHighlight mb-4 text-center">
              <p className="text-xs text-zinc-500 mb-1">Chave PIX Admin</p>
              <p className="text-white font-mono text-sm select-all">{ADMIN_PIX_KEY}</p>
            </div>

            <button onClick={() => { onPay(selectedLoan.id, false); setPayModalId(null); }} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-xl mb-3">
              Já enviei o PIX
            </button>

            <button onClick={() => setPayModalId(null)} className="w-full text-zinc-500 py-2 text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {/* Installment Payment Modal */}
      {installmentModalData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold text-white mb-4">Pagar Parcela</h3>
            <p className="text-zinc-400 text-sm mb-6">
              Pagar parcela de <strong className="text-white">{installmentModalData.installmentAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>.
            </p>

            <div className="bg-background p-3 rounded-xl mb-4 border border-surfaceHighlight">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-400">Seu Saldo</span>
                <span className="text-white font-bold">{userBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>

            <button
              onClick={() => {
                onPayInstallment(installmentModalData.loanId, installmentModalData.installmentAmount, true);
                setInstallmentModalData(null);
              }}
              disabled={userBalance < installmentModalData.installmentAmount}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl mb-3"
            >
              {userBalance < installmentModalData.installmentAmount ? 'Saldo Insuficiente' : 'Pagar Parcela com Saldo'}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-700"></div></div>
              <div className="relative flex justify-center"><span className="bg-surface px-2 text-xs text-zinc-500 uppercase">Ou via PIX</span></div>
            </div>

            <div className="bg-background p-3 rounded-xl border border-surfaceHighlight mb-4 text-center">
              <p className="text-xs text-zinc-500 mb-1">Chave PIX Admin</p>
              <p className="text-white font-mono text-sm select-all">{ADMIN_PIX_KEY}</p>
            </div>

            <button
              onClick={() => {
                onPayInstallment(installmentModalData.loanId, installmentModalData.installmentAmount, false);
                setInstallmentModalData(null);
              }}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-xl mb-3"
            >
              Já enviei o PIX da Parcela
            </button>

            <button onClick={() => setInstallmentModalData(null)} className="w-full text-zinc-500 py-2 text-sm">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
};

const WithdrawView = ({ balance, onRequest }: {
  balance: number,
  onRequest: (val: number, key: string) => void
}) => {
  const [val, setVal] = useState('');
  const [key, setKey] = useState('');

  // Quick amount options
  const quickAmounts = [50, 100, 200, 500];
  const isValidAmount = val && parseFloat(val) > 0 && parseFloat(val) <= balance;
  const fee = isValidAmount ? Math.max(5, parseFloat(val) * 0.02) : 0; // 2% fee, minimum R$5
  const netAmount = isValidAmount ? parseFloat(val) - fee : 0;

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Balance Overview Card */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-black">
        <div className="text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ArrowUpFromLine size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Solicitar Saque</h2>
          <p className="text-sm opacity-80">Transfira seu saldo disponível para sua conta bancária</p>
        </div>

        <div className="bg-white/20 rounded-xl p-4 mt-6">
          <p className="text-sm opacity-80 mb-1">Saldo Disponível</p>
          <p className="text-3xl font-bold">{balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          <p className="text-xs opacity-70 mt-1">Seu saldo atual na conta</p>
        </div>
      </div>

      {/* Withdrawal Form */}
      <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6">
        <div className="space-y-6">
          <div>
            <label className="text-xs text-zinc-400 block mb-3">Valor do Saque</label>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {quickAmounts.map(amount => (
                <button
                  key={amount}
                  onClick={() => setVal(Math.min(amount, balance).toString())}
                  disabled={amount > balance}
                  className={`py-2 rounded-lg text-sm font-bold border transition ${amount > balance
                    ? 'bg-zinc-800 text-zinc-600 border-zinc-700 cursor-not-allowed'
                    : 'bg-surfaceHighlight text-zinc-300 border-zinc-600 hover:bg-primary-900/30 hover:border-primary-500/50'
                    }`}
                >
                  R$ {amount}
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-3 text-zinc-500">R$</span>
              <input
                type="number"
                value={val}
                onChange={e => setVal(e.target.value)}
                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 pr-16 text-white outline-none focus:border-primary-500 transition"
                placeholder="0.00"
              />
              <button
                onClick={() => setVal(balance.toString())}
                className="absolute right-2 top-2 text-xs text-primary-400 hover:bg-primary-900/30 px-2 py-1.5 rounded transition"
              >
                Tudo
              </button>
            </div>

            {/* Fee Information */}
            {isValidAmount && (
              <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Taxa de saque (2%)</span>
                  <span className="text-zinc-300">{fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-white">Você receberá</span>
                  <span className="text-emerald-400">{netAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1">Chave PIX de Destino</label>
            <input
              type="text"
              value={key}
              onChange={e => setKey(e.target.value)}
              className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white outline-none focus:border-primary-500 transition"
              placeholder="CPF, Email, Telefone ou Chave Aleatória"
            />
          </div>
        </div>

        <button
          onClick={() => onRequest(parseFloat(val), key)}
          disabled={!isValidAmount || !key}
          className="w-full bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] mt-6"
        >
          Confirmar Saque
        </button>

        <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
          <p className="text-xs text-blue-300 flex items-center gap-2">
            <Clock size={14} />
            <span>Processamento em até 24h úteis</span>
          </p>
          <p className="text-xs text-zinc-400 mt-2">
            Taxa mínima de R$ 5,00 ou 2% do valor do saque, o que for maior.
          </p>
          <p className="text-xs text-zinc-400 mt-2">
            <strong>Importante:</strong> Você está sacando do seu saldo disponível na conta.
          </p>
        </div>
      </div>
    </div>
  );
};

const SettingsView = ({ user, onSimulateTime, onLogout }: { user: User, onSimulateTime: () => void, onLogout: () => void }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Configurações</h2>

      <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Perfil</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500">Nome</label>
            <p className="text-white border-b border-surfaceHighlight pb-2">{user.name}</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Email</label>
            <p className="text-white border-b border-surfaceHighlight pb-2">{user.email}</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Chave PIX</label>
            <p className="text-white border-b border-surfaceHighlight pb-2">{user.pixKey}</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Código de Indicação</label>
            <div className="flex items-center gap-2">
              <p className="text-primary-400 font-bold text-xl">{user.referralCode}</p>
              <button title="Copiar" className="text-zinc-500 hover:text-white"><Copy size={16} /></button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">Compartilhe e ganhe R$ 5,00 por amigo.</p>
          </div>
        </div>
      </div>



      <button onClick={onLogout} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-3 rounded-xl font-bold transition">
        Sair do Aplicativo
      </button>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [state, setState] = useState<AppState>({
    currentUser: null,
    users: [],
    quotas: [],
    loans: [],
    transactions: [],
    systemBalance: 0,
    profitPool: 0,
  });
  const [currentView, setCurrentView] = useState('dashboard');
  const [adminMode, setAdminMode] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [showVip, setShowVip] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar estado inicial
  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const initialState = await loadState();
        setState(initialState);
      } catch (error) {
        console.error('Erro ao carregar estado inicial:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialState();
  }, []);

  // Adicionar listener para auth-expired
  useEffect(() => {
    const handleAuthExpired = () => {
      console.log('Sessão expirada, fazendo logout...');
      setState(prev => ({ ...prev, currentUser: null }));
      // Limpar token do localStorage
      localStorage.removeItem('authToken');
    };

    window.addEventListener('auth-expired', handleAuthExpired);

    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, []);

  // Sync state wrapper
  const refreshState = async (): Promise<void> => {
    try {
      // Forçar limpeza completa do cache antes de carregar novo estado
      const { clearAllCache } = await import('../../application/services/storage.service');
      clearAllCache();

      const newState = await loadState();
      setState(newState);

      // DEBUG: Log para verificar o saldo após atualização
      console.log('DEBUG - Estado atualizado:', {
        userId: newState.currentUser?.id,
        userName: newState.currentUser?.name,
        balance: newState.currentUser?.balance,
        balanceType: typeof newState.currentUser?.balance
      });
    } catch (error) {
      console.error('Erro ao atualizar estado:', error);
    }
  };

  const handleLogin = async (user: User) => {
    const newState = await loadState();
    setState(newState);

    // Forçar verificação de admin para o usuário específico
    const isAdminUser = user.email === 'josiassm701@gmail.com' || user.isAdmin;
    console.log('Login - Verificação de admin:', {
      userEmail: user.email,
      userIsAdmin: user.isAdmin,
      forcedAdmin: isAdminUser
    });

    if (isAdminUser) {
      setAdminMode(true);
    } else {
      setCurrentView('dashboard');
    }
  };


  const handleLogout = async (): Promise<void> => {
    await logoutUser();
    setAdminMode(false);
    const newState = await loadState();
    setState(newState);
  };

  const handleBuyQuota = async (qty: number, method: 'PIX' | 'BALANCE') => {
    try {
      // Logic for PIX confirmation is now handled in the UI Modal.
      // We just execute the request here.
      const result = await buyQuota(qty, method === 'BALANCE');

      // Limpar cache para garantir dados atualizados
      const { clearAllCache } = await import('../../application/services/storage.service');
      clearAllCache();

      // Atualizar estado para refletir as novas cotas imediatamente
      await refreshState();

      // Mensagem diferenciada baseada no método de pagamento
      if (method === 'BALANCE') {
        alert(`Compra de ${qty} cota(s) aprovada imediatamente! As cotas já estão disponíveis em sua carteira.`);
      } else {
        alert(`Solicitação de compra enviada! Aguarde a aprovação do administrador.`);
      }

      setCurrentView('portfolio');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleReinvest = async () => {
    if (!state.currentUser) return;
    if (state.currentUser.balance < QUOTA_PRICE) {
      alert("Saldo insuficiente para reinvestir (Mínimo R$ 50,00).");
      return;
    }
    if (window.confirm("Deseja usar seu saldo para comprar 1 nova cota automaticamente?")) {
      try {
        await buyQuota(1, true); // true = useBalance
        await refreshState();
        alert("Reinvestimento realizado com sucesso! Nova cota aguardando aprovação.");
      } catch (e: any) {
        alert(e.message);
      }
    }
  };

  const handleSellQuota = async (id: string) => {
    try {
      await sellQuota(id);

      // Limpar cache para garantir dados atualizados
      const { clearAllCache } = await import('../../application/services/storage.service');
      clearAllCache();

      await refreshState();
      alert("Cota resgatada com sucesso! Valor creditado no saldo.");
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSellAll = async () => {
    try {
      const result = await sellAllQuotas();

      // Limpar cache para garantir dados atualizados
      const { clearAllCache } = await import('../../application/services/storage.service');
      clearAllCache();

      await refreshState();
      alert(`Resgate total realizado! R$ ${result.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} creditados.`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRequestLoan = async (amount: number, installments: number, pix: string) => {
    try {
      // DEBUG: Log para verificar o PIX sendo enviado
      console.log('DEBUG - Solicitação de empréstimo no frontend:', {
        amount,
        installments,
        pix,
        pixVazio: !pix,
        pixTipo: typeof pix
      });

      await requestLoan(amount, installments, pix);
      await refreshState();
      alert("Empréstimo solicitado! Aguarde aprovação.");
      setCurrentView('dashboard');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handlePayLoan = async (id: string, useBalance: boolean) => {
    try {
      await repayLoan(id, useBalance);
      await refreshState();
      alert("Pagamento enviado para análise! Aguarde confirmação.");
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handlePayInstallment = async (id: string, amount: number, useBalance: boolean): Promise<void> => {
    try {
      // Chamar a API de pagamento de parcela
      const response = await fetch('/api/loans/repay-installment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          loanId: id,
          installmentAmount: amount,
          useBalance: useBalance
        })
      });

      const result = await response.json();

      if (result.success) {
        await refreshState();
        alert(useBalance ? "Parcela paga com saldo!" : "Parcela paga via PIX! Aguarde confirmação.");
      } else {
        alert(result.message || "Erro ao pagar parcela.");
      }
    } catch (e: any) {
      alert(e.message || "Erro ao processar pagamento da parcela.");
    }
  };

  // handleApprovePayment foi movido para dentro do componente AdminDashboard

  const handleWithdraw = async (val: number, key: string) => {
    try {
      await requestWithdrawal(val, key);

      // Limpar cache para garantir que o lucro de juros seja atualizado
      const { clearAllCache } = await import('../../application/services/storage.service');
      clearAllCache();

      await refreshState();
      alert("Saque solicitado com sucesso! A taxa de saque foi adicionada ao lucro de juros.");
      setCurrentView('dashboard');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSimulateTime = async () => {
    await fastForwardTime(1);
    await refreshState();
    alert("Tempo avançado em 1 mês.");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    );
  }

  // Calcular variáveis para usuários autenticados
  const userQuotasCount = state.currentUser ? state.quotas.filter(q => q.userId === state.currentUser?.id).length : 0;
  const vipLevel = userQuotasCount >= 50 ? 'Ouro' : userQuotasCount >= 10 ? 'Prata' : 'Bronze';
  const nextLevel = vipLevel === 'Bronze' ? 'Prata' : vipLevel === 'Prata' ? 'Ouro' : 'Máximo';
  const quotasToNext = vipLevel === 'Bronze' ? 10 - userQuotasCount : vipLevel === 'Prata' ? 50 - userQuotasCount : 0;
  const progress = vipLevel === 'Bronze' ? (userQuotasCount / 10) * 100 : vipLevel === 'Prata' ? (userQuotasCount / 50) * 100 : 100;

  // Check for active loans to disable sell buttons
  const hasActiveLoans = state.currentUser ? state.loans.some(l =>
    l.userId === state.currentUser?.id &&
    (l.status === 'APPROVED' || l.status === 'PENDING' || l.status === 'PAYMENT_PENDING')
  ) : false;

  // Renderizar rotas baseadas no estado de autenticação
  if (!state.currentUser) {
    return (
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/auth" element={<AuthScreen onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Se for admin
  if (state.currentUser.isAdmin || state.currentUser.email === 'josiassm701@gmail.com') {
    return (
      <Routes>
        <Route path="/admin" element={
          <div className="min-h-screen bg-background p-8 font-sans">
            <div className="max-w-6xl mx-auto">
              <AdminDashboard state={state} onRefresh={refreshState} onLogout={handleLogout} />
            </div>
          </div>
        } />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  // Usuário normal autenticado
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/auth" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/app/*" element={
        <Layout user={state.currentUser} currentView={currentView} onChangeView={setCurrentView} onLogout={handleLogout}>
          <Routes>
            <Route path="dashboard" element={
              <Dashboard
                state={state}
                onBuyQuota={() => setCurrentView('invest')}
                onReinvest={handleReinvest}
                onRefer={() => setShowReferral(true)}
                onVip={() => setShowVip(true)}
                onLogout={handleLogout}
              />
            } />
            <Route path="invest" element={<InvestView onBuy={handleBuyQuota} />} />
            <Route path="portfolio" element={
              <PortfolioView
                quotas={state.quotas?.filter((q: any) => q.userId === state.currentUser?.id) || []}
                hasLoans={hasActiveLoans}
                onSell={handleSellQuota}
                onSellAll={handleSellAll}
              />
            } />
            <Route path="loans" element={
              <LoansView
                loans={state.loans.filter((l: any) => l.userId === state.currentUser?.id)}
                onRequest={handleRequestLoan}
                onPay={handlePayLoan}
                onPayInstallment={handlePayInstallment}
                userBalance={state.currentUser?.balance || 0}
              />
            } />
            <Route path="withdraw" element={
              <WithdrawView
                balance={state.currentUser?.balance || 0}
                onRequest={handleWithdraw}
              />
            } />
            <Route path="settings" element={
              <SettingsView
                user={state.currentUser}
                onSimulateTime={handleSimulateTime}
                onLogout={handleLogout}
              />
            } />
            <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
          </Routes>

          {/* Referral Modal */}
          {showReferral && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative">
                <button title="Fechar" onClick={() => setShowReferral(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><XIcon size={20} /></button>
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Users className="text-purple-400" /> Indique e Ganhe</h3>
                <p className="text-zinc-400 text-sm mb-6">Ganhe <strong className="text-emerald-400">R$ 5,00</strong> para cada amigo que se cadastrar usando seu código!</p>

                <div className="bg-background border border-dashed border-purple-500/30 rounded-xl p-4 text-center mb-6 relative group cursor-pointer" onClick={() => navigator.clipboard.writeText(state.currentUser?.referralCode || '')}>
                  <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Seu Código</p>
                  <p className="text-3xl font-bold text-purple-400 tracking-wider">{state.currentUser?.referralCode}</p>
                  <div className="absolute inset-0 bg-purple-500/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-xl">
                    <span className="text-xs text-white font-bold flex items-center gap-1"><Copy size={12} /> Copiar</span>
                  </div>
                </div>

                <button onClick={() => setShowReferral(false)} className="w-full bg-zinc-800 text-white py-3 rounded-xl font-bold">Fechar</button>
              </div>
            </div>
          )}

          {/* VIP Modal */}
          {showVip && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative">
                <button title="Fechar" onClick={() => setShowVip(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><XIcon size={20} /></button>
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Crown className="text-orange-400" /> Níveis VIP</h3>

                <div className="flex items-center justify-between mb-6">
                  <div className="text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1 mx-auto ${vipLevel === 'Bronze' ? 'bg-orange-900/40 text-orange-400 ring-2 ring-orange-500' : 'bg-zinc-800 text-zinc-500'}`}>
                      <Star size={20} fill={vipLevel === 'Bronze' ? "currentColor" : "none"} />
                    </div>
                    <span className="text-xs font-bold text-zinc-400">Bronze</span>
                  </div>
                  <div className="h-1 flex-1 bg-zinc-800 mx-2 rounded-full overflow-hidden">
                    <div className={`h-full bg-primary-500 ${vipLevel === 'Bronze' ? 'vip-progress-bronze' : 'vip-progress-full'}`}></div>
                  </div>
                  <div className="text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1 mx-auto ${vipLevel === 'Prata' ? 'bg-zinc-300 text-zinc-800 ring-2 ring-white' : vipLevel === 'Ouro' ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-800 text-zinc-500'}`}>
                      <Star size={20} fill={vipLevel === 'Prata' ? "currentColor" : "none"} />
                    </div>
                    <span className="text-xs font-bold text-zinc-400">Prata</span>
                  </div>
                  <div className="h-1 flex-1 bg-zinc-800 mx-2 rounded-full overflow-hidden">
                    <div className={`h-full bg-primary-500 ${vipLevel === 'Ouro' ? 'vip-progress-full' : 'vip-progress-zero'}`}></div>
                  </div>
                  <div className="text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1 mx-auto ${vipLevel === 'Ouro' ? 'bg-yellow-500 text-black ring-2 ring-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'bg-zinc-800 text-zinc-500'}`}>
                      <Crown size={20} fill={vipLevel === 'Ouro' ? "currentColor" : "none"} />
                    </div>
                    <span className="text-xs font-bold text-zinc-400">Ouro</span>
                  </div>
                </div>

                <div className="text-center mb-6">
                  <p className="text-zinc-400 text-sm">Nível Atual: <strong className="text-white uppercase">{vipLevel}</strong></p>
                  {nextLevel !== 'Máximo' ? (
                    <p className="text-xs text-zinc-500 mt-1">Faltam {quotasToNext} cotas para o nível {nextLevel}</p>
                  ) : (
                    <p className="text-xs text-emerald-400 mt-1">Você atingiu o nível máximo!</p>
                  )}
                </div>

                <div className="bg-background rounded-xl p-4 border border-surfaceHighlight space-y-3 mb-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-primary-400" />
                    <span className="text-sm text-zinc-300">Suporte Prioritário</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className={vipLevel !== 'Bronze' ? "text-primary-400" : "text-zinc-700"} />
                    <span className={`text-sm ${vipLevel !== 'Bronze' ? "text-zinc-300" : "text-zinc-600"}`}>Aprovação Expressa (Prata+)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className={vipLevel === 'Ouro' ? "text-primary-400" : "text-zinc-700"} />
                    <span className={`text-sm ${vipLevel === 'Ouro' ? "text-zinc-300" : "text-zinc-600"}`}>Taxas Reduzidas (Ouro)</span>
                  </div>
                </div>

                <button onClick={() => setShowVip(false)} className="w-full bg-zinc-800 text-white py-3 rounded-xl font-bold">Fechar</button>
              </div>
            </div>
          )}

          <AIAssistant appState={state} />
        </Layout>
      } />
    </Routes>
  );
}
