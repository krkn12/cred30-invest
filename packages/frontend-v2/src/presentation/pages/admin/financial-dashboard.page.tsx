import React, { useState } from 'react';
import { MetricCard } from '../../components/ui/MetricCard';
import { formatCurrency } from '../../../shared/utils/format.utils';
import { FINANCIAL_CONSTANTS } from '../../../shared/constants/app.constants';

interface FinancialDashboardProps {
  systemBalance: number;
  profitPool: number;
  quotasCount: number;
  totalLoaned: number;
  totalToReceive: number;
  onUpdateBalance: (newBalance: number) => void;
  onAddProfit: (amount: number) => void;
  onDistributeProfits: () => void;
}

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
  systemBalance,
  profitPool,
  quotasCount,
  totalLoaned,
  totalToReceive,
  onUpdateBalance,
  onAddProfit,
  onDistributeProfits
}) => {
  const [balanceInput, setBalanceInput] = useState('');
  const [profitInput, setProfitInput] = useState('');
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showProfitModal, setShowProfitModal] = useState(false);

  const handleUpdateBalance = () => {
    const amount = parseFloat(balanceInput);
    if (!isNaN(amount) && amount >= 0) {
      onUpdateBalance(amount);
      setBalanceInput('');
      setShowBalanceModal(false);
    }
  };

  const handleAddProfit = () => {
    const amount = parseFloat(profitInput);
    if (!isNaN(amount) && amount > 0) {
      onAddProfit(amount);
      setProfitInput('');
      setShowProfitModal(false);
    }
  };

  const profitPerQuota = quotasCount > 0 ? (profitPool * FINANCIAL_CONSTANTS.PROFIT_DISTRIBUTION_RATE) / quotasCount : 0;

  return (
    <div className="space-y-6">
      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Caixa Operacional"
          value={formatCurrency(systemBalance)}
          subtitle="Capital de giro disponível"
          color="blue"
        />
        <MetricCard
          title="Lucro de Juros"
          value={formatCurrency(profitPool)}
          subtitle="Juros acumulados"
          color="green"
        />
        <MetricCard
          title="Total Emprestado"
          value={formatCurrency(totalLoaned)}
          subtitle="Valor em empréstimos ativos"
          color="yellow"
        />
        <MetricCard
          title="A Receber"
          value={formatCurrency(totalToReceive)}
          subtitle="Principal + juros a receber"
          color="purple"
        />
      </div>

      {/* Gestão de Lucros */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Gestão de Lucros</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Resumo de Distribuição</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total de Lucros:</span>
                  <span className="font-medium">{formatCurrency(profitPool)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Cotas Ativas:</span>
                  <span className="font-medium">{quotasCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Lucro por Cota (85%):</span>
                  <span className="font-medium text-green-600">{formatCurrency(profitPerQuota)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Taxa da Plataforma (15%):</span>
                  <span className="font-medium text-blue-600">
                    {formatCurrency(profitPool * 0.15)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowProfitModal(true)}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Adicionar Lucro
              </button>
              <button
                onClick={onDistributeProfits}
                disabled={profitPool <= 0 || quotasCount === 0}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Distribuir Lucros
              </button>
            </div>

            {quotasCount === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ Não há cotas ativas para distribuir lucros
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Informações do Sistema</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Preço da Cota:</span>
                  <span className="font-medium">{formatCurrency(FINANCIAL_CONSTANTS.QUOTA_PRICE)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Taxa de Juros:</span>
                  <span className="font-medium">{(FINANCIAL_CONSTANTS.LOAN_INTEREST_RATE * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Taxa de Multa:</span>
                  <span className="font-medium">{(FINANCIAL_CONSTANTS.PENALTY_RATE * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Período de Carência:</span>
                  <span className="font-medium">{FINANCIAL_CONSTANTS.VESTING_PERIOD_DAYS} dias</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowBalanceModal(true)}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Atualizar Caixa Operacional
            </button>
          </div>
        </div>
      </div>

      {/* Modal para atualizar caixa */}
      {showBalanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Atualizar Caixa Operacional
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Novo valor do caixa
                </label>
                <input
                  type="number"
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Digite o valor..."
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleUpdateBalance}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Atualizar
                </button>
                <button
                  onClick={() => {
                    setShowBalanceModal(false);
                    setBalanceInput('');
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para adicionar lucro */}
      {showProfitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Adicionar Lucro de Juros
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor do lucro
                </label>
                <input
                  type="number"
                  value={profitInput}
                  onChange={(e) => setProfitInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Digite o valor..."
                  step="0.01"
                  min="0.01"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleAddProfit}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Adicionar
                </button>
                <button
                  onClick={() => {
                    setShowProfitModal(false);
                    setProfitInput('');
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};