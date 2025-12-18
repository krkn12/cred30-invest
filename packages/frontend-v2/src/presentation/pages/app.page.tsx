import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/main-layout.component';
import { AIAssistant } from '../components/features/ai-assistant.component';
import { SlotMachine } from '../components/features/slot-machine.component';
import { UpdateNotification } from '../components/ui/update-notification.component';
import { StoreView } from '../components/features/store/store.component';
import { AdminStoreManager } from '../components/features/store/admin-store.component';
import WelcomePage from './welcome.page';
import { loadState, registerUser, loginUser, logoutUser, buyQuota, sellQuota, sellAllQuotas, requestLoan, fastForwardTime, repayLoan, repayInstallment, getCurrentUser, resetPassword, requestWithdrawal, getPendingItems, processAdminAction, updateSystemBalance, updateProfitPool, distributeMonthlyDividends, fixLoanPix, clearAllCache, deleteUserAccount } from '../../application/services/storage.service';
import { apiService } from '../../application/services/api.service';
import { AppState, Quota, Loan, Transaction, User } from '../../domain/types/common.types';
import { QUOTA_PRICE, VESTING_PERIOD_MS } from '../../shared/constants/app.constants';
import { Wallet, TrendingUp, AlertTriangle, ArrowRight, DollarSign, Calendar, Lock, CheckCircle2, QrCode, ArrowUpRight, ArrowDownLeft, KeyRound, ChevronLeft, PieChart, Trash2, ArrowUpFromLine, Users, Repeat, Crown, Copy, ShieldCheck, Clock, Check, X as XIcon, RefreshCw, LogOut, Coins, PiggyBank, Star, Settings, Gamepad2 } from 'lucide-react';
import { PIXModal } from '../components/ui/pix-modal.component';
import { CardModal } from '../components/ui/card-modal.component';


// --- Admin Component ---

const AdminView = ({ state, onRefresh, onLogout }: {
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
  const [newManualCost, setNewManualCost] = useState('');
  const [manualCostDescription, setManualCostDescription] = useState('');
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

  const handleUpdateManualCost = async () => {
    try {
      const val = parseCurrencyInput(newManualCost);
      if (isNaN(val) || val <= 0) throw new Error("Valor inválido");

      const response = await apiService.post('/admin/manual-cost', {
        amount: val,
        description: manualCostDescription || 'Custo manual'
      });

      if (response.success) {
        clearAllCache();
        onRefresh();
        setNewManualCost('');
        setManualCostDescription('');
        alert(`Custo de R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} registrado com sucesso e deduzido do caixa operacional.`);
      } else {
        alert('Erro: ' + response.message);
      }
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

  const handleSimulateMpPayment = async (paymentId: string, transactionId: string) => {
    try {
      if (!confirm('Deseja simular a aprovação deste pagamento no Mercado Pago Sandbox?')) return;

      const response = await apiService.post('/admin/simulate-mp-payment', { paymentId, transactionId });

      if (response.success) {
        alert('Sucesso! O pagamento foi aprovado no Sandbox e a transação foi processada.');
        await onRefresh();
      } else {
        alert('Erro: ' + response.message);
      }
    } catch (error: any) {
      alert('Erro ao simular: ' + error.message);
    }
  };

  const handleRejectPayment = async (transactionId: string) => {
    try {
      // Importar apiService dinamicamente removido - uso de import estático
      // const { apiService } = await import('../../application/services/api.service');

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
      // Importar apiService dinamicamente removido - uso de import estático
      // const { apiService } = await import('../../application/services/api.service');

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
      // Importar apiService dinamicamente removido - uso de import estático
      // const { apiService } = await import('../../application/services/api.service');

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
      // Importar apiService dinamicamente removido - uso de import estático
      // const { apiService } = await import('../../application/services/api.service');

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

  const handleFixPix = async (loanId: string) => {
    const newPix = prompt("Digite a nova Chave PIX:");
    if (!newPix) return;
    try {
      await fixLoanPix(loanId, newPix);
      clearAllCache();
      onRefresh();
      alert("Chave PIX atualizada com sucesso!");
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

        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-6 text-white border border-red-500/30 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <ShieldCheck size={24} className="text-white" />
            </div>
            <span className="text-sm font-medium opacity-90">Custo Gateway</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(state.stats?.totalGatewayCosts ?? 0)}</p>
          <p className="text-xs opacity-75 mt-1">Taxas pagas ao Mercado Pago</p>
        </div>

        <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl p-6 text-white border border-orange-500/30 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Coins size={24} className="text-white" />
            </div>
            <span className="text-sm font-medium opacity-90">Custos Manuais</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(state.stats?.totalManualCosts ?? 0)}</p>
          <p className="text-xs opacity-75 mt-1">Lançados manualmente</p>
        </div>
      </div>

      <AdminStoreManager />

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
              <p>• Menos: Custo do Gateway (Mercado Pago)</p>
              <p>• Igual: Caixa disponível</p>
            </div>
            <div className="mt-3 pt-3 border-t border-blue-500/20">
              <p className="text-xs text-blue-300 font-medium">
                <strong>Exemplo:</strong> 10 cotas (R$ 500) - R$ 200 emprestados - R$ 4,95 taxas = R$ 295,05 disponíveis
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

        {/* Manual Cost Control */}
        <div className="bg-gradient-to-br from-surface to-surfaceHighlight rounded-2xl p-6 border border-surfaceHighlight shadow-xl">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <ArrowDownLeft className="text-orange-400" size={20} />
            </div>
            Lançar Custos Adicionais
          </h3>
          <div className="bg-gradient-to-r from-background to-surfaceHighlight rounded-xl p-6 mb-6 border border-surfaceHighlight/50">
            <p className="text-sm text-zinc-400 mb-2 font-medium">Total de Custos Manuais</p>
            <p className="text-3xl font-bold text-orange-400">{formatCurrency(state.stats?.totalManualCosts ?? 0)}</p>
            <p className="text-xs text-zinc-500 mt-2">Estes custos são deduzidos do caixa operacional.</p>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <label className="text-xs text-zinc-400 block mb-2 font-medium">Valor do Custo (Ex: 50,00)</label>
              <input
                type="text"
                placeholder="0,00"
                value={newManualCost}
                onChange={(e) => setNewManualCost(e.target.value)}
                className="w-full bg-background border border-surfaceHighlight rounded-xl px-4 py-4 text-white outline-none focus:border-orange-500 transition text-lg font-medium"
              />
            </div>
            <div className="relative">
              <label className="text-xs text-zinc-400 block mb-2 font-medium">Descrição (Opcional)</label>
              <input
                type="text"
                placeholder="Ex: Servidor, Manutenção, etc."
                value={manualCostDescription}
                onChange={(e) => setManualCostDescription(e.target.value)}
                className="w-full bg-background border border-surfaceHighlight rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 transition text-sm"
              />
            </div>
            <button
              onClick={handleUpdateManualCost}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-black font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              <ArrowDownLeft size={18} />
              Lançar Custo
            </button>
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

                    {/* Botão de Simulação Mercado Pago (Apenas se houver mp_id) */}
                    {metadata.mp_id && (
                      <button
                        onClick={() => handleSimulateMpPayment(metadata.mp_id, t.id)}
                        className="w-full mt-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                        title="Simular pagamento aprovado no Mercado Pago"
                      >
                        <ShieldCheck size={14} /> Simular Pagamento (Sandbox)
                      </button>
                    )}
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
                    <button title="Corrigir PIX" onClick={() => handleFixPix(l.id)} className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"><RefreshCw size={20} /></button>
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

  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();

  const handleDeleteAccount = async () => {
    const res = await deleteUserAccount();
    if (!res.success) {
      alert('Erro: ' + res.message);
    } else {
      alert('Sua conta foi encerrada.');
      onLogout();
    }
  };

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

  const isPositive = (type: string) =>
    ['DEPOSIT', 'LOAN_RECEIVED', 'SELL_QUOTA', 'REFERRAL_BONUS', 'LOAN_APPROVED'].includes(type);

  return (
    <div className="space-y-6">
      {/* Header with User Info */}
      <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-black font-bold text-2xl">
              {user.name ? user.name.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{user.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${vipLevel === 'Ouro' ? 'bg-yellow-500 text-black' : vipLevel === 'Prata' ? 'bg-zinc-400 text-black' : 'bg-orange-600 text-white'}`}>
                  {vipLevel}
                </span>
                <span className="px-3 py-1 rounded-full text-sm font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                  <Star size={14} fill="currentColor" /> {user.score || 0}
                </span>
                <span className="text-zinc-400 text-sm">Membro desde {user.joinedAt ? new Date(user.joinedAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Data não disponível'}</span>
              </div>
              <p className="text-zinc-400 text-sm mt-1">Código: {user.referralCode}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Score de Crédito</p>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${(user.score || 0) > 700 ? 'bg-emerald-500' : (user.score || 0) > 400 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(((user.score || 0) / 1000) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="text-sm font-bold text-white">{user.score || 0}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button title="Configurações" onClick={() => setShowSettings(true)} className="text-zinc-400 hover:text-white p-2 bg-surfaceHighlight rounded-lg">
                <Settings size={20} />
              </button>
              <button title="Sair" onClick={onLogout} className="text-zinc-400 hover:text-white p-2 bg-surfaceHighlight rounded-lg">
                <LogOut size={20} />
              </button>
            </div>
          </div>
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
      {/* Quick Actions (Carrossel Horizontal) */}
      <div className="flex gap-4 overflow-x-auto py-4 px-1 no-scrollbar sm:justify-start -mx-4 px-4 sm:mx-0">
        <button onClick={onBuyQuota} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-primary-400 group-hover:bg-primary-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
            <TrendingUp size={24} />
          </div>
          <span className="text-xs font-medium text-zinc-300">Investir</span>
        </button>

        <button onClick={() => navigate('/app/games')} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-purple-400 group-hover:bg-purple-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
            <Gamepad2 size={24} />
          </div>
          <span className="text-xs font-medium text-zinc-300">Jogos</span>
        </button>

        <button onClick={() => navigate('/app/loans')} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-blue-400 group-hover:bg-blue-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
            <DollarSign size={24} />
          </div>
          <span className="text-xs font-medium text-zinc-300">Empréstimo</span>
        </button>

        <button onClick={() => navigate('/app/withdraw')} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-zinc-700 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
            <ArrowUpFromLine size={24} />
          </div>
          <span className="text-xs font-medium text-zinc-300">Sacar</span>
        </button>

        <button onClick={onReinvest} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
            <Repeat size={24} />
          </div>
          <span className="text-xs font-medium text-zinc-300">Reinvestir</span>
        </button>

        <button onClick={onRefer} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-orange-400 group-hover:bg-orange-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
            <Users size={24} />
          </div>
          <span className="text-xs font-medium text-zinc-300">Indicar</span>
        </button>

        <button onClick={onVip} className="flex flex-col items-center gap-2 min-w-[72px] group shrink-0">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-yellow-500 group-hover:bg-yellow-900/40 transition-all border border-zinc-700 shadow-lg group-active:scale-95">
            <Crown size={24} />
          </div>
          <span className="text-xs font-medium text-zinc-300">VIP</span>
        </button>
      </div>

      {/* Recent Transactions (Extrato) */}
      <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Últimas Transações</h3>
        <div className="space-y-4">
          {state.transactions.slice(-5).reverse().map((t: any) => (
            <div key={t.id} className="flex justify-between items-center border-b border-surfaceHighlight pb-3 last:border-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isPositive(t.type)
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : t.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                  {t.status === 'PENDING' ? <Clock size={18} /> : isPositive(t.type) ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{t.description}</p>
                  <p className="text-xs text-zinc-500">{t.date ? new Date(t.date).toLocaleDateString('pt-BR') : 'Data não disponível'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold ${t.status === 'PENDING' ? 'text-yellow-400' :
                  isPositive(t.type)
                    ? 'text-emerald-400'
                    : 'text-red-400'
                  }`}>
                  {isPositive(t.type) ? '+' : '-'}
                  {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                {t.status === 'PENDING' && <p className="text-[10px] text-yellow-500">Em Análise</p>}
              </div>
            </div>
          ))}
          {state.transactions.length === 0 && (
            <p className="text-zinc-500 text-center text-sm py-4">Nenhuma movimentação recente.</p>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-surface border border-surfaceHighlight rounded-2xl w-full max-w-sm p-6 relative shadow-2xl">
            <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 p-1 rounded-full">
              <XIcon size={20} />
            </button>

            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white"><Settings className="text-primary-400" /> Configurações</h3>

            <div className="space-y-3">
              <button onClick={() => alert('Em breve')} className="w-full p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl flex items-center justify-between hover:bg-zinc-700 transition">
                <span className="flex items-center gap-3 text-white"><Lock size={20} className="text-zinc-400" /> Alterar Senha</span>
                <ChevronLeft size={16} className="rotate-180 text-zinc-500" />
              </button>

              <div className="h-px bg-surfaceHighlight my-4"></div>

              <button onClick={handleDeleteAccount} className="w-full p-4 bg-red-900/10 border border-red-900/30 rounded-xl flex items-center justify-between hover:bg-red-900/20 transition group">
                <span className="flex items-center gap-3 text-red-400 font-bold"><Trash2 size={20} /> Encerrar Conta</span>
                <ChevronLeft size={16} className="rotate-180 text-red-500 group-hover:translate-x-1 transition" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 mt-6 text-center">Versão 2.1.0 • Cred30</p>
          </div>
        </div>
      )}
    </div>
  );
};

const InvestView = ({ onBuy }: { onBuy: (qty: number, method: 'PIX' | 'BALANCE' | 'CARD') => void }) => {
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState<'PIX' | 'BALANCE' | 'CARD'>('PIX');
  const [showConfirm, setShowConfirm] = useState(false);

  const baseCost = qty * QUOTA_PRICE;

  // Cálculo local de taxas para exibição
  const getFee = () => {
    if (method === 'PIX' || method === 'BALANCE') return 0;
    // Regra: 4.99% + 0.40 para cartão
    return (baseCost * 0.0499) + 0.40;
  };

  const fee = getFee();
  const total = baseCost + fee;

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

        <div className="bg-background rounded-xl p-1 mb-6 flex gap-1">
          <button onClick={() => setMethod('PIX')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${method === 'PIX' ? 'bg-primary-500 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>PIX</button>
          <button onClick={() => setMethod('CARD')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${method === 'CARD' ? 'bg-primary-500 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>CARTÃO</button>
          <button onClick={() => setMethod('BALANCE')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${method === 'BALANCE' ? 'bg-primary-500 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>SALDO</button>
        </div>

        <div className="bg-background rounded-xl p-4 border border-surfaceHighlight text-left">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-zinc-400">Subtotal ({qty}x)</span>
            <span className="text-white font-medium">{baseCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
          {fee > 0 && (
            <div className="flex justify-between text-sm mb-2 text-yellow-500/90 font-medium">
              <span>Taxa de Serviço ({method})</span>
              <span>+ {fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
          )}
          <div className="h-px bg-surfaceHighlight my-3"></div>
          <div className="flex justify-between text-lg font-bold">
            <span className="text-white">Total</span>
            <span className="text-primary-400">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </div>
      </div>

      {/* Main Action Button */}
      <button
        type="button"
        onClick={() => {
          if (method === 'CARD') {
            handlePurchase();
          } else {
            setShowConfirm(true);
          }
        }}
        className="relative z-[100] w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
      >
        {method === 'CARD' ? 'Ir para Pagamento Seguro' : 'Confirmar Compra'}
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
          <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative animate-fade-in">
            <button title="Fechar" onClick={() => setShowConfirm(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 p-1.5 rounded-full z-10"><XIcon size={24} /></button>

            <h3 className="text-xl font-bold text-white mb-4">Finalizar Compra</h3>

            <div className="bg-background border border-zinc-700 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm text-zinc-400">
                <span>Valor das Cotas</span>
                <span className="text-zinc-200">{baseCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>

              {fee > 0 && (
                <div className="flex justify-between text-sm text-yellow-500/80">
                  <span>Taxa de Processamento</span>
                  <span>{fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              )}

              <div className="h-px bg-zinc-800 my-1"></div>

              <div className="flex justify-between text-lg text-white font-bold">
                <span>Total Final</span>
                <span className="text-primary-400">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>

            {method === 'BALANCE' ? (
              <>
                <p className="text-zinc-300 text-sm mb-4">O valor será debitado do seu saldo disponível imediatamente.</p>
                <button onClick={handlePurchase} className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-3 rounded-xl transition">
                  Confirmar Pagamento com Saldo
                </button>
              </>
            ) : (
              <>
                <p className="text-zinc-300 text-sm mb-4">Um código de pagamento dinâmico será gerado para você.</p>
                <button onClick={handlePurchase} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl transition">
                  Gerar Pagamento {method}
                </button>
              </>
            )}

            <button
              onClick={() => setShowConfirm(false)}
              className="w-full mt-3 py-2 text-zinc-500 hover:text-white text-sm transition-colors"
            >
              Cancelar e Voltar
            </button>
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
          <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative animate-fade-in">
            <button title="Fechar" onClick={() => setShowConfirm(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 p-1.5 rounded-full z-10"><XIcon size={24} /></button>

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

            <button
              onClick={() => setShowConfirm(false)}
              className="w-full mt-3 py-2 text-zinc-500 hover:text-white text-sm transition-colors"
            >
              Cancelar e Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const LoansView = ({ loans, onRequest, onPay, onPayInstallment, userBalance, currentUser }: {
  loans: Loan[],
  onRequest: (amount: number, installments: number, pix: string) => void,
  onPay: (id: string, useBalance: boolean, method?: 'pix' | 'card') => void,
  onPayInstallment: (id: string, amount: number, useBalance: boolean, method?: 'pix' | 'card') => void,
  userBalance: number,
  currentUser: User | null
}) => {
  const [amount, setAmount] = useState('');
  const [installments, setInstallments] = useState(1);
  const [payModalId, setPayModalId] = useState<string | null>(null);
  const [installmentModalData, setInstallmentModalData] = useState<{ loanId: string, installmentAmount: number } | null>(null);

  const activeLoans = loans.filter(l => l.status === 'APPROVED' || l.status === 'PENDING' || l.status === 'PAYMENT_PENDING' || l.status === 'REJECTED');
  const selectedLoan = activeLoans.find(l => l.id === payModalId);
  const [payMethod, setPayMethod] = useState<'pix' | 'card'>('pix');
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

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <label className="text-xs text-emerald-400 block mb-1 font-medium italic">Recebimento automático via PIX</label>
              <p className="text-white text-sm font-mono break-all line-clamp-1">{currentUser?.pixKey || 'Chave não cadastrada'}</p>
              <p className="text-emerald-500/60 text-[10px] mt-1 line-clamp-2 leading-tight">O empréstimo será enviado para sua chave principal cadastrada no perfil.</p>
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
                onRequest(parseFloat(amount), installments, currentUser?.pixKey || '');
              }}
              disabled={!amount || !currentUser?.pixKey}
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={(e) => { if (e.target === e.currentTarget) setPayModalId(null); }}>
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

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-700"></div></div>
              <div className="relative flex justify-center"><span className="bg-surface px-2 text-xs text-zinc-500 uppercase">Pagamento Externo</span></div>
            </div>

            <div className="bg-background rounded-xl p-1 mb-4 flex gap-1">
              <button onClick={() => setPayMethod('pix')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${payMethod === 'pix' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>PIX</button>
              <button onClick={() => setPayMethod('card')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${payMethod === 'card' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>CARTÃO</button>
            </div>

            <div className="bg-background p-4 rounded-xl border border-surfaceHighlight mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Total Dívida</span>
                <span className="text-white">{selectedLoan.totalRepayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              {payMethod === 'card' && (
                <div className="flex justify-between text-sm text-yellow-500/80">
                  <span>Taxa de Serviço</span>
                  <span>{(selectedLoan.totalRepayment * 0.0499 + 0.40).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              )}
              <div className="h-px bg-zinc-800 my-1"></div>
              <div className="flex justify-between text-lg font-bold">
                <span className="text-white">Total a Pagar</span>
                <span className="text-primary-400">
                  {(payMethod === 'card'
                    ? selectedLoan.totalRepayment + (selectedLoan.totalRepayment * 0.0499 + 0.40)
                    : selectedLoan.totalRepayment
                  ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                onPay(selectedLoan.id, false, payMethod);
                setPayModalId(null);
              }}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-xl mb-3 shadow-lg shadow-emerald-500/20 transition-all font-display tracking-tight"
            >
              {payMethod === 'card' ? 'Pagar com Cartão' : 'Gerar PIX copia e cola'}
            </button>

            <button onClick={() => setPayModalId(null)} className="w-full text-zinc-500 py-2 text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {/* Installment Payment Modal */}
      {installmentModalData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={(e) => { if (e.target === e.currentTarget) setInstallmentModalData(null); }}>
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
              {userBalance < installmentModalData.installmentAmount ? 'Saldo Insuficiente' : 'Pagar com Saldo'}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-700"></div></div>
              <div className="relative flex justify-center"><span className="bg-surface px-2 text-xs text-zinc-500 uppercase">Pagamento Externo</span></div>
            </div>

            <div className="bg-background rounded-xl p-1 mb-4 flex gap-1">
              <button onClick={() => setPayMethod('pix')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${payMethod === 'pix' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>PIX</button>
              <button onClick={() => setPayMethod('card')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${payMethod === 'card' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>CARTÃO</button>
            </div>

            <div className="bg-background p-4 rounded-xl border border-surfaceHighlight mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Valor Parcela</span>
                <span className="text-white">{installmentModalData.installmentAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              {payMethod === 'card' && (
                <div className="flex justify-between text-sm text-yellow-500/80">
                  <span>Taxa de Serviço</span>
                  <span>{(installmentModalData.installmentAmount * 0.0499 + 0.40).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              )}
              <div className="h-px bg-zinc-800 my-1"></div>
              <div className="flex justify-between text-lg font-bold">
                <span className="text-white">Total a Pagar</span>
                <span className="text-primary-400">
                  {(payMethod === 'card'
                    ? installmentModalData.installmentAmount + (installmentModalData.installmentAmount * 0.0499 + 0.40)
                    : installmentModalData.installmentAmount
                  ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                onPayInstallment(installmentModalData.loanId, installmentModalData.installmentAmount, false, payMethod);
                setInstallmentModalData(null);
              }}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl mb-3 shadow-lg shadow-emerald-500/20 transition-all font-display tracking-tight"
            >
              {payMethod === 'card' ? 'Pagar com Cartão' : 'Gerar PIX copia e cola'}
            </button>

            <button onClick={() => setInstallmentModalData(null)} className="w-full text-zinc-500 py-2 text-sm">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
};

const WithdrawView = ({ balance, onRequest, currentUser }: {
  balance: number,
  onRequest: (val: number, key: string) => void,
  currentUser: User | null
}) => {
  const [val, setVal] = useState('');

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

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            <label className="text-xs text-emerald-400 block mb-1 font-medium italic">Depósito automático via PIX</label>
            <p className="text-white text-sm font-mono break-all line-clamp-1">{currentUser?.pixKey || 'Chave não cadastrada'}</p>
            <p className="text-emerald-500/60 text-[10px] mt-1 line-clamp-2 leading-tight">O valor será enviado para sua chave principal cadastrada no perfil.</p>
          </div>
        </div>

        <button
          onClick={() => onRequest(parseFloat(val), currentUser?.pixKey || '')}
          disabled={!isValidAmount || !currentUser?.pixKey}
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
            <label className="text-xs text-zinc-500">Score de Crédito</label>
            <div className="flex items-center gap-2 border-b border-surfaceHighlight pb-2">
              <Star size={16} className="text-primary-400" fill="currentColor" />
              <p className="text-white font-bold">{user.score || 0}</p>
              <span className="text-[10px] px-2 py-0.5 rounded bg-surfaceHighlight text-zinc-400">
                {(user.score || 0) > 700 ? 'Excelente' : (user.score || 0) > 400 ? 'Bom' : 'Regular'}
              </span>
            </div>
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
};

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

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadData();
    const handleAuthExpired = () => setState(prev => ({ ...prev, currentUser: null }));
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

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
      alert(error.message);
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
    } catch (error: any) { alert(error.message); }
  };

  const handleSellAll = async () => {
    try {
      if (!confirm('Vender TODAS as cotas?')) return;
      await sellAllQuotas();
      await refreshState();
      alert('Todas as cotas vendidas!');
    } catch (error: any) { alert(error.message); }
  };

  const handleReinvest = async () => {
    try {
      await buyQuota(1, true);
      await refreshState();
      alert('Reinvestimento realizado!');
    } catch (error: any) { alert(error.message); }
  };

  // Funções auxiliares para passar para LoansView
  const handleRequestLoan = async (amount: number, installments: number, pixKey: string) => {
    try {
      await requestLoan(amount, installments, pixKey);
      await refreshState();
      alert('Empréstimo aprovado e creditado com sucesso!');
    } catch (e: any) { alert(e.message); }
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
    } catch (e: any) { alert(e.message); }
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
    } catch (e: any) { alert(e.message); }
  }

  const handleWithdraw = async (amount: number, pixKey: string) => {
    try {
      await requestWithdrawal(amount, pixKey);
      await refreshState();
      alert('Solicitação de saque enviada! Aguarde processamento.');
    } catch (e: any) { alert(e.message); }
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
          <Route path="/admin" element={<AdminView state={state} onRefresh={refreshState} onLogout={handleLogout} />} />
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
                />
              } />
              <Route path="withdraw" element={
                <WithdrawView
                  balance={state.currentUser.balance}
                  onRequest={handleWithdraw}
                  currentUser={state.currentUser}
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
