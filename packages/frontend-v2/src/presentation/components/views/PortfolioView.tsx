import React, { useState } from 'react';
import { TrendingUp, X as XIcon, Lock, DollarSign } from 'lucide-react';
import { Quota } from '../../../domain/types/common.types';

interface PortfolioViewProps {
    quotas: Quota[];
    hasLoans: boolean;
    onSell: (id: string) => void;
    onSellAll: () => void;
}

export const PortfolioView = ({ quotas, hasLoans, onSell, onSellAll }: PortfolioViewProps) => {
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
                        <h2 className="text-2xl font-bold">Participações</h2>
                        <p className="text-sm opacity-80">Gestão de Apoio à Comunidade</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm opacity-80">Total em Licenças</p>
                        <p className="text-3xl font-bold">{totalCurrentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="bg-white/20 rounded-xl p-4">
                        <p className="text-sm opacity-80 mb-1">Valor das Licenças</p>
                        <p className="text-xl font-bold">{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div className="bg-white/20 rounded-xl p-4">
                        <p className="text-sm opacity-80 mb-1">Bônus Acumulado</p>
                        <p className="text-xl font-bold flex items-center gap-1">
                            {totalEarnings >= 0 ? '+' : ''}{totalEarnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            <span className="text-xs bg-black/20 px-1.5 py-0.5 rounded-full">
                                {earningsPercentage.toFixed(1)}%
                            </span>
                        </p>
                    </div>
                    <div className="bg-white/20 rounded-xl p-4">
                        <p className="text-sm opacity-80 mb-1">Licenças Ativas</p>
                        <p className="text-xl font-bold">{safeQuotas.length} {safeQuotas.length === 1 ? 'licença' : 'licenças'}</p>
                    </div>
                </div>
            </div>

            {hasLoans && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
                    <Lock className="text-red-500 shrink-0" size={24} />
                    <p className="text-red-400 text-sm">
                        <span className="font-bold">Atenção:</span> Seus resgates estão bloqueados devido a um empréstimo em aberto. Quite sua dívida para desbloquear essa função.
                    </p>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
                <button
                    onClick={initiateSellAll}
                    disabled={safeQuotas.length === 0 || hasLoans}
                    className="flex-1 bg-surfaceHighlight hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
                >
                    <DollarSign size={18} />
                    Resgatar Tudo
                </button>
            </div>

            {/* Quotas List */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-white pl-1">Minhas Participações ({safeQuotas.length})</h3>
                {safeQuotas.length === 0 ? (
                    <div className="text-center py-12 bg-surface/50 rounded-2xl border border-surfaceHighlight border-dashed">
                        <TrendingUp size={48} className="mx-auto text-zinc-600 mb-4" />
                        <p className="text-zinc-500">Você ainda não possui licenças ativadas.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {safeQuotas.map((quota: any) => {
                            const currentValue = quota.currentValue || quota.purchasePrice;
                            const gain = currentValue - quota.purchasePrice;
                            const gainPercent = (gain / quota.purchasePrice) * 100;
                            const purchaseDate = quota.purchaseDate ? new Date(quota.purchaseDate) : new Date();

                            return (
                                <div key={quota.id} className="bg-surface border border-surfaceHighlight rounded-2xl p-5 hover:border-primary-500/30 transition group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-surfaceHighlight w-10 h-10 rounded-full flex items-center justify-center text-primary-400">
                                            <TrendingUp size={20} />
                                        </div>
                                        <span className="text-[10px] bg-surfaceHighlight text-zinc-400 px-2 py-1 rounded-full font-mono">
                                            #{quota.id.substring(0, 6)}
                                        </span>
                                    </div>

                                    <div className="mb-4">
                                        <p className="text-xs text-zinc-500 mb-1">Valor Atual</p>
                                        <p className="text-2xl font-bold text-white">{currentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        <p className="text-xs text-emerald-400 font-medium flex items-center gap-1 mt-1">
                                            <TrendingUp size={12} />
                                            +{gainPercent.toFixed(1)}% ({gain.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                                        </p>
                                    </div>

                                    <div className="border-t border-surfaceHighlight pt-4 mt-4 text-xs text-zinc-500 flex justify-between items-center">
                                        <span>Comprado em {purchaseDate.toLocaleDateString('pt-BR')}</span>
                                    </div>

                                    <button
                                        onClick={() => initiateSell(quota.id)}
                                        disabled={hasLoans}
                                        className="w-full mt-4 bg-surfaceHighlight hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg text-sm font-medium transition"
                                    >
                                        Resgatar Individual
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[120] p-4 animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative shadow-2xl">
                        <button onClick={() => setShowConfirm(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white"><XIcon size={24} /></button>

                        <h3 className="text-xl font-bold text-white mb-2">{modalTitle.replace("Cota", "Licença")}</h3>
                        {isPenaltyApplied && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg mb-4">
                                Cancelamento antecipado (menos de 1 ano). Incide taxa de administração de 40% sobre o valor de compra.
                            </div>
                        )}

                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-zinc-400 text-sm">
                                <span>Valor Base</span>
                                <span>{originalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="flex justify-between text-yellow-500 text-sm">
                                <span>Taxa de Saída Antecipada {isPenaltyApplied && '(40%)'}</span>
                                <span>- {penaltyValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="border-t border-surfaceHighlight my-2"></div>
                            <div className="flex justify-between text-white font-bold text-lg">
                                <span>Valor Líquido a Receber</span>
                                <span className="text-emerald-400">{netValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleConfirm}
                            className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-3 rounded-xl transition shadow-lg shadow-primary-500/20"
                        >
                            Confirmar Resgate
                        </button>
                        <button
                            onClick={() => setShowConfirm(false)}
                            className="w-full mt-2 py-3 text-zinc-500 hover:text-white text-sm transition"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
