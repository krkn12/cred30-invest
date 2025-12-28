import React, { useState } from 'react';
import { TrendingUp, X as XIcon, Users, ShieldCheck, Info } from 'lucide-react';
import { QUOTA_PRICE, QUOTA_SHARE_VALUE, QUOTA_ADM_FEE } from '../../../shared/constants/app.constants';
import { calculateTotalToPay } from '../../../shared/utils/financial.utils';

interface InvestViewProps {
    onBuy: (qty: number, method: 'PIX' | 'BALANCE' | 'CARD') => void;
    isPro?: boolean;
}

export const InvestView = ({ onBuy, isPro }: InvestViewProps) => {
    const [qty, setQty] = useState(1);
    const [method, setMethod] = useState<'PIX' | 'BALANCE' | 'CARD'>('PIX');
    const [showConfirm, setShowConfirm] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);

    const baseAmount = qty * QUOTA_PRICE;
    const { total, fee } = calculateTotalToPay(baseAmount, method.toLowerCase() as any);

    const handlePurchase = () => {
        if (!acceptedTerms) return;

        // Adsterra SmartLink Trigger (Pop-Under effect)
        window.open('https://www.effectivegatecpm.com/ec4mxdzvs?key=a9eefff1a8aa7769523373a66ff484aa', '_blank');

        onBuy(qty, method);
        setShowConfirm(false);
    };

    return (
        <div className="max-w-md mx-auto pb-40 relative">
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-8 text-center relative overflow-hidden mb-6">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
                <Users size={48} className="mx-auto text-emerald-400 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Adesão à Cooperativa</h2>
                <p className="text-zinc-400 mb-6 font-medium text-sm">Torne-se um cooperado do grupo Cred30 e participe das decisões e benefícios da comunidade.</p>

                <div className="text-4xl font-bold text-white mb-8">
                    {QUOTA_PRICE.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    <span className="text-base font-normal text-zinc-500"> / cota-parte</span>
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

                <div className="bg-background rounded-xl p-4 border border-surfaceHighlight text-left mb-6">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-3 tracking-widest text-center border-b border-zinc-800 pb-2">Composição da Integralização</p>

                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-zinc-400">Capital Social ({qty}x)</span>
                        <span className="text-white font-medium">{(qty * QUOTA_SHARE_VALUE).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-zinc-400">Taxa Operacional</span>
                        <span className="text-white font-medium">{(qty * QUOTA_ADM_FEE).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>

                    {fee > 0 && (
                        <div className="flex justify-between text-sm mb-2 text-yellow-500/90 font-medium">
                            <span>Encargos do Gateway ({method})</span>
                            <span>+ {fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                    )}
                    <div className="h-px bg-surfaceHighlight my-3"></div>
                    <div className="flex justify-between text-lg font-bold">
                        <span className="text-white">Total a Integralizar</span>
                        <span className="text-primary-400">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                </div>

                {/* Terms Agreement Checkbox */}
                <div className="flex items-start gap-3 text-left bg-zinc-900/40 p-3 rounded-xl border border-white/5 mb-6">
                    <input
                        type="checkbox"
                        id="terms"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-primary-500 focus:ring-primary-500/30"
                    />
                    <label htmlFor="terms" className="text-[10px] text-zinc-400 leading-tight">
                        Li e concordo com o <button onClick={() => setShowTermsModal(true)} className="text-primary-400 underline font-bold">Termo de Adesão e Cooperação Mútua</button> do Grupo Cred30.
                    </label>
                </div>
            </div>

            {/* Main Action Button */}
            <button
                type="button"
                onClick={() => {
                    if (!acceptedTerms) {
                        alert('Por favor, aceite os termos de adesão para continuar.');
                        return;
                    }
                    if (method === 'CARD') {
                        handlePurchase();
                    } else {
                        setShowConfirm(true);
                    }
                }}
                disabled={!acceptedTerms}
                className={`relative z-[100] w-full font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] ${acceptedTerms
                        ? 'bg-primary-500 hover:bg-primary-400 text-black'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50 shadow-none'
                    }`}
            >
                {method === 'CARD' ? 'Ir para Pagamento Seguro' : 'Confirmar Ingresso no Grupo'}
            </button>

            {/* Terms Modal */}
            {showTermsModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[700] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm max-h-[80vh] overflow-y-auto relative">
                        <button onClick={() => setShowTermsModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><XIcon size={20} /></button>

                        <div className="text-center mb-6">
                            <ShieldCheck size={40} className="text-primary-500 mx-auto mb-2" />
                            <h3 className="text-xl font-bold text-white">Termo de Cooperação</h3>
                        </div>

                        <div className="space-y-4 text-xs text-zinc-400 leading-relaxed font-medium">
                            <p className="text-white font-bold bg-white/5 p-2 rounded">Ao adquirir uma cota-parte, você declara estar ciente de que:</p>

                            <div className="flex gap-2">
                                <span className="text-primary-500 font-bold">01.</span>
                                <p>Trata-se de uma adesão a um sistema de suporte mútuo e economia colaborativa (SCP - Sociedade em Conta de Participação).</p>
                            </div>

                            <div className="flex gap-2">
                                <span className="text-primary-500 font-bold">02.</span>
                                <p>O valor aportado compõe o capital social da comunidade para fins de socorro financeiro e benefícios mútuos.</p>
                            </div>

                            <div className="flex gap-2">
                                <span className="text-primary-500 font-bold">03.</span>
                                <p>Os excedentes operacionais distribuídos são frutos do desempenho coletivo da plataforma.</p>
                            </div>

                            <div className="flex gap-2">
                                <span className="text-primary-500 font-bold">04.</span>
                                <p><strong>Não há garantia de rendimento fixo.</strong> Resultados passados não garantem resultados futuros.</p>
                            </div>

                            <div className="flex gap-2">
                                <span className="text-primary-500 font-bold">05.</span>
                                <p>Existe um período de carência (Vesting) de 365 dias para o resgate do capital social sem a aplicação da taxa de saída por descontinuidade.</p>
                            </div>

                            <div className="flex gap-2">
                                <span className="text-primary-500 font-bold">06.</span>
                                <p>A plataforma atua como gestora de tecnologia, não sendo uma instituição financeira ou banco.</p>
                            </div>
                        </div>

                        <button
                            onClick={() => { setAcceptedTerms(true); setShowTermsModal(false); }}
                            className="w-full bg-white text-black font-black py-4 rounded-xl mt-8 text-xs uppercase tracking-widest"
                        >
                            ENTENDI E ACEITO
                        </button>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-500" onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
                    <div className="bg-[#0A0A0A] border-t sm:border border-white/5 sm:border-surfaceHighlight rounded-t-[2.5rem] sm:rounded-3xl p-8 w-full sm:max-w-sm relative shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-500 sm:duration-300">
                        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6 sm:hidden opacity-50" />

                        <button title="Fechar" onClick={() => setShowConfirm(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white bg-zinc-900/50 p-2 rounded-full hidden sm:block"><XIcon size={20} /></button>

                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-primary-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary-900/20 ring-1 ring-primary-500/20">
                                <ShieldCheck size={40} className="text-primary-500" strokeWidth={2.5} />
                            </div>
                            <h3 className="text-2xl font-black text-white tracking-tight">Confirmar Adesão</h3>
                            <p className="text-zinc-500 text-sm mt-2 font-medium">Você está integralizando {qty} cota(s)-parte</p>
                        </div>

                        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 mb-8 space-y-4">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-zinc-500 font-bold uppercase tracking-widest">Valor do Aporte</span>
                                <span className="text-zinc-300 font-black">{baseAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>

                            {fee > 0 && (
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-yellow-500/60 font-bold uppercase tracking-widest">Taxa de Gateway</span>
                                    <span className="text-yellow-500/80 font-black">+{fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            )}

                            <div className="h-px bg-white/5 my-2"></div>

                            <div className="flex justify-between items-baseline">
                                <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Total Líquido</span>
                                <span className="text-3xl font-black text-primary-400">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {method === 'BALANCE' ? (
                                <button
                                    onClick={handlePurchase}
                                    className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black uppercase tracking-[0.2em] py-5 rounded-2xl transition-all shadow-xl shadow-primary-500/20 active:scale-[0.98] text-xs"
                                >
                                    UTILIZAR MEU SALDO
                                </button>
                            ) : (
                                <button
                                    onClick={handlePurchase}
                                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-[0.2em] py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] text-xs"
                                >
                                    GERAR PIX/COBRANÇA
                                </button>
                            )}

                            <button
                                onClick={() => setShowConfirm(false)}
                                className="w-full py-4 text-zinc-600 hover:text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em] transition-all"
                            >
                                CANCELAR E VOLTAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Context Information */}
            <div className="mt-8 bg-zinc-900/30 border border-white/5 rounded-2xl p-4 flex gap-4">
                <div className="bg-primary-500/10 w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                    <Info size={20} className="text-primary-500" />
                </div>
                <div>
                    <h4 className="text-white text-xs font-bold mb-1 tracking-tight">Cota-Parte Social</h4>
                    <p className="text-[10px] text-zinc-500 leading-tight">Representa sua participação no Capital Social da comunidade, tornando você um cooperado com acesso a crédito mútuo.</p>
                </div>
            </div>

            {/* Legal Disclaimer */}
            <div className="mt-6 px-4 text-[9px] text-zinc-600 text-center leading-relaxed font-medium uppercase tracking-[0.05em]">
                <p>O Cred30 é um sistema de economia colaborativa. A integralização de capital social não se caracteriza como investimento, poupança, título de capitalização ou depósito bancário. Operações realizadas sob modelo de SCP conforme Lei 10.406/02.</p>
            </div>
        </div>
    );
};
