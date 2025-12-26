import React, { useState } from 'react';
import { TrendingUp, X as XIcon, Users } from 'lucide-react';
import { QUOTA_PRICE, QUOTA_SHARE_VALUE, QUOTA_ADM_FEE } from '../../../shared/constants/app.constants';
import { calculateTotalToPay } from '../../../shared/utils/financial.utils';
import { AdBanner } from '../ui/AdBanner';

interface InvestViewProps {
    onBuy: (qty: number, method: 'PIX' | 'BALANCE' | 'CARD') => void;
    isPro?: boolean;
}

export const InvestView = ({ onBuy, isPro }: InvestViewProps) => {
    const [qty, setQty] = useState(1);
    const [method, setMethod] = useState<'PIX' | 'BALANCE' | 'CARD'>('PIX');
    const [showConfirm, setShowConfirm] = useState(false);

    const baseAmount = qty * QUOTA_PRICE;
    const { total, fee } = calculateTotalToPay(baseAmount, method.toLowerCase() as any);

    const handlePurchase = () => {
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
                <h2 className="text-2xl font-bold text-white mb-2">Adesão ao Clube</h2>
                <p className="text-zinc-400 mb-6 font-medium">Torne-se sócio-participante do clube e ajude a fortalecer nossa economia comum.</p>

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

                <div className="flex justify-between items-center bg-black/20 p-4 rounded-2xl mb-6 border border-white/5">
                    <div className="text-left">
                        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Meta de Participação</p>
                        <p className="text-xs text-emerald-400 font-bold">Título de Sócio Majoritário</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xl font-bold text-white">500+</p>
                    </div>
                </div>

                <div className="bg-background rounded-xl p-4 border border-surfaceHighlight text-left">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-3 tracking-widest text-center border-b border-zinc-800 pb-2">Composição do Aporte</p>

                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-zinc-400">Capital Social ({qty}x)</span>
                        <span className="text-white font-medium">{(qty * QUOTA_SHARE_VALUE).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-zinc-400">Taxa Administrativa</span>
                        <span className="text-white font-medium">{(qty * QUOTA_ADM_FEE).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>

                    {fee > 0 && (
                        <div className="flex justify-between text-sm mb-2 text-yellow-500/90 font-medium">
                            <span>Taxa de Processamento ({method})</span>
                            <span>+ {fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                    )}
                    <div className="h-px bg-surfaceHighlight my-3"></div>
                    <div className="flex justify-between text-lg font-bold">
                        <span className="text-white">Total a Pagar</span>
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
                {method === 'CARD' ? 'Ir para Pagamento Seguro' : 'Confirmar Aporte'}
            </button>

            {/* AdBanner removido para limpeza de UI */}

            {/* Confirmation Modal - Bottom Sheet on Mobile */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-500" onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
                    <div className="bg-[#0A0A0A] border-t sm:border border-white/5 sm:border-surfaceHighlight rounded-t-[2.5rem] sm:rounded-3xl p-8 w-full sm:max-w-sm relative shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-500 sm:duration-300">
                        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6 sm:hidden opacity-50" />

                        <button title="Fechar" onClick={() => setShowConfirm(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white bg-zinc-900/50 p-2 rounded-full hidden sm:block"><XIcon size={20} /></button>

                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-primary-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary-900/20 ring-1 ring-primary-500/20">
                                <TrendingUp size={40} className="text-primary-500" strokeWidth={2.5} />
                            </div>
                            <h3 className="text-2xl font-black text-white tracking-tight">Confirmar Aporte</h3>
                            <p className="text-zinc-500 text-sm mt-2 font-medium">Você está adquirindo {qty} unidade(s)</p>
                        </div>

                        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 mb-8 space-y-4">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-zinc-500 font-bold uppercase tracking-widest">Valor Base</span>
                                <span className="text-zinc-300 font-black">{baseAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>

                            {fee > 0 && (
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-yellow-500/60 font-bold uppercase tracking-widest">Taxa de Processamento</span>
                                    <span className="text-yellow-500/80 font-black">+{fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            )}

                            <div className="h-px bg-white/5 my-2"></div>

                            <div className="flex justify-between items-baseline">
                                <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Total Final</span>
                                <span className="text-3xl font-black text-primary-400">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {method === 'BALANCE' ? (
                                <button
                                    onClick={handlePurchase}
                                    className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black uppercase tracking-[0.2em] py-5 rounded-2xl transition-all shadow-xl shadow-primary-500/20 active:scale-[0.98] text-xs"
                                >
                                    PAGAR COM MEU SALDO
                                </button>
                            ) : (
                                <button
                                    onClick={handlePurchase}
                                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-[0.2em] py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] text-xs"
                                >
                                    GERAR PAGAMENTO {method}
                                </button>
                            )}

                            <button
                                onClick={() => setShowConfirm(false)}
                                className="w-full py-4 text-zinc-600 hover:text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em] transition-all"
                            >
                                CANCELAR E VOLTAR
                            </button>
                        </div>

                        <p className="text-[9px] text-zinc-600 text-center mt-6 leading-relaxed font-medium">
                            Ao confirmar, você aceita os termos de sócio-participante (SCP).
                        </p>
                    </div>
                </div>
            )}
            {/* Legal Disclaimer */}
            <div className="mt-8 px-4 text-[10px] text-zinc-600 text-center leading-relaxed">
                <p>O aporte de capital social confere direitos de participação sobre os resultados do clube de benefícios, conforme modelo de SCP. Não se trata de investimento financeiro, poupança ou título de crédito. Os resultados dependem do desempenho do clube.</p>
            </div>
        </div>
    );
};
