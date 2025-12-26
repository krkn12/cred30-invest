import React, { useState } from 'react';
import { TrendingUp, X as XIcon, Lock, DollarSign, Award, Download, ShieldCheck, Calendar, Info } from 'lucide-react';
import { Quota } from '../../../domain/types/common.types';
import { apiService } from '../../../application/services/api.service';

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
    const [eligibility, setEligibility] = useState<any>(null);
    const [showCertificate, setShowCertificate] = useState(false);
    const [loadingTitle, setLoadingTitle] = useState(false);
    const [titleInfo, setTitleInfo] = useState<any>(null);

    React.useEffect(() => {
        checkEligibility();
    }, []);

    const checkEligibility = async () => {
        try {
            const res = await apiService.checkTitleEligibility();
            setEligibility(res);
        } catch (error) {
            console.error('Erro ao verificar elegibilidade:', error);
        }
    };

    const handleDownloadRequest = async () => {
        setLoadingTitle(true);
        try {
            const res = await apiService.downloadTitle();
            if (res.success) {
                setTitleInfo(res.data);
                setShowCertificate(true);
                // Atualizar elegibilidade para ocultar o botão
                setEligibility({ eligible: false, reason: 'Título já emitido.' });
            }
        } catch (error: any) {
            alert(error.message || 'Erro ao emitir título.');
        } finally {
            setLoadingTitle(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

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
            modalTitle = `Resgate Licença #${typeof selectedQuotaId === 'string' ? selectedQuotaId.substring(0, 4) : 'N/A'}`;
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
                        <span className="font-bold">Atenção:</span> Seus resgates estão bloqueados devido a um apoio mútuo em aberto. Quite seu compromisso para desbloquear essa função.
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

            {/* Título de Sócio Majoritário Recommendation/Claim */}
            {eligibility && (
                <div className={`rounded-2xl p-6 border transition-all duration-500 overflow-hidden relative group ${eligibility.eligible
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-surface border-surfaceHighlight'
                    }`}>
                    {/* Background Detail */}
                    <div className="absolute -right-8 -bottom-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Award size={160} />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${eligibility.eligible
                            ? 'bg-emerald-500 text-black animate-pulse'
                            : 'bg-zinc-800 text-zinc-500'
                            }`}>
                            <Award size={32} />
                        </div>

                        <div className="flex-1 text-center sm:text-left">
                            <h3 className={`text-xl font-bold mb-1 ${eligibility.eligible ? 'text-emerald-400' : 'text-white'}`}>
                                Título de Sócio Majoritário
                            </h3>
                            <p className="text-sm text-zinc-400 max-w-lg">
                                Reconhecimento exclusivo para membros com mais de 500 participações e 1 ano de compromisso com o clube.
                            </p>

                            {!eligibility.eligible && eligibility.currentCount !== undefined && (
                                <div className="mt-4 space-y-2">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        <span>Progresso de Participação</span>
                                        <span>{eligibility.currentCount} / {eligibility.neededCount}</span>
                                    </div>
                                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500/50 transition-all duration-1000"
                                            style={{ width: `${Math.min(100, (eligibility.currentCount / eligibility.neededCount) * 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            {!eligibility.eligible && eligibility.reason && (
                                <div className="mt-3 flex items-center gap-2 justify-center sm:justify-start">
                                    <Info size={14} className="text-zinc-500" />
                                    <p className="text-xs text-zinc-500 italic">{eligibility.reason}</p>
                                </div>
                            )}
                        </div>

                        {eligibility.eligible && (
                            <button
                                onClick={handleDownloadRequest}
                                disabled={loadingTitle}
                                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 px-8 rounded-xl transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 shrink-0 group"
                            >
                                {loadingTitle ? (
                                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Download size={20} className="group-hover:translate-y-0.5 transition-transform" />
                                        EMITIR TÍTULO OFICIAL
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}

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
                                            #{typeof quota.id === 'string' ? quota.id.substring(0, 6) : quota.id}
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
                        <button title="Fechar" onClick={() => setShowConfirm(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white"><XIcon size={24} /></button>

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

            {/* Certificate Modal - Premium Downloadable */}
            {showCertificate && titleInfo && (
                <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[130] p-4 overflow-y-auto no-print">
                    <div className="w-full max-w-2xl relative animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center mb-6 px-4">
                            <h4 className="text-emerald-400 font-black uppercase tracking-widest text-sm flex items-center gap-2">
                                <ShieldCheck size={18} /> Título Emitido com Sucesso
                            </h4>
                            <div className="flex gap-2">
                                <button
                                    onClick={handlePrint}
                                    className="bg-white text-black px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-400 transition"
                                >
                                    <Download size={16} /> Imprimir Título
                                </button>
                                <button onClick={() => setShowCertificate(false)} className="text-zinc-500 hover:text-white p-2">
                                    <XIcon size={24} />
                                </button>
                            </div>
                        </div>

                        {/* DOCUMENTO (CERTIFICADO) */}
                        <div id="certificate-print" className="bg-[#fcf8f1] text-[#2c3e50] p-10 sm:p-16 rounded-sm border-[12px] border-[#d4af37] shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden font-serif print:shadow-none print:border-[8px]">
                            {/* Decorative Gold Inner Border */}
                            <div className="absolute inset-4 border border-[#d4af37]/30 pointer-events-none"></div>

                            {/* Watermark Logo */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] rotate-[-30deg] pointer-events-none flex flex-col items-center">
                                <Award size={400} />
                            </div>

                            <div className="relative z-10 text-center space-y-8">
                                <div className="space-y-2">
                                    <div className="flex justify-center mb-4">
                                        <Award size={64} className="text-[#d4af37]" />
                                    </div>
                                    <h5 className="text-[10px] font-sans font-black tracking-[0.4em] text-[#d4af37] uppercase">Certificado de Reconhecimento</h5>
                                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1a1a1a]">Título de Sócio Majoritário</h1>
                                </div>

                                <div className="h-0.5 w-24 bg-[#d4af37] mx-auto"></div>

                                <p className="text-lg leading-relaxed italic max-w-md mx-auto">
                                    Pelo presente instrumento, o Clube Cred30 confere e reconhece a titularidade especial de sócio participante ao associado:
                                </p>

                                <div className="py-4">
                                    <h2 className="text-4xl sm:text-5xl font-black text-[#1a1a1a] uppercase underline decoration-[#d4af37]/30 underline-offset-8">
                                        {titleInfo.userName}
                                    </h2>
                                </div>

                                <p className="text-sm leading-relaxed max-w-lg mx-auto font-sans text-zinc-700">
                                    Este título é outorgado em reconhecimento ao compromisso inabalável demonstrado através da manutenção de <strong>{titleInfo.quotaCount} participações sociais</strong> e adesão contínua por período superior a <strong>365 dias</strong>, tornando-se parte do corpo consultivo e majoritário desta comunidade.
                                </p>

                                <div className="pt-12 grid grid-cols-2 gap-12 text-center font-sans">
                                    <div>
                                        <div className="h-px bg-[#2c3e50]/20 mb-2"></div>
                                        <p className="text-[10px] uppercase font-bold text-zinc-500">Data de Emissão</p>
                                        <p className="text-sm font-bold">{titleInfo.issueDate}</p>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <ShieldCheck size={40} className="text-emerald-700 mb-1" />
                                        <p className="text-[10px] uppercase font-bold text-zinc-500">Autenticidade Verificada</p>
                                        <p className="text-[8px] font-mono opacity-50">CRED30-SEC-P2P-{Math.random().toString(36).substring(2, 10).toUpperCase()}</p>
                                    </div>
                                </div>

                                <div className="pt-8 text-[9px] uppercase tracking-widest text-[#d4af37] font-sans font-black">
                                    SISTEMA DE GESTÃO ASSOCIATIVA DISTRIBUÍDA • CRED30
                                </div>
                            </div>
                        </div>

                        <p className="text-center text-zinc-500 text-xs mt-6 italic">
                            Dica: Você pode salvar como PDF na Janela de Impressão.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
