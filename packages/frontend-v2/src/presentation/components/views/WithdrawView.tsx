import React, { useState, useMemo, useEffect } from 'react';
import { ArrowUpFromLine, ShieldCheck, Clock, XCircle, TrendingUp } from 'lucide-react';
// import packageJson from '../../../../package.json';
import { User } from '../../../domain/types/common.types';
import { apiService } from '../../../application/services/api.service';
import { confirmWithdrawal } from '../../../application/services/storage.service';

interface WithdrawViewProps {
    balance: number;
    currentUser: User | null;
    totalQuotaValue: number;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
    onRefresh: () => void;
}

export const WithdrawView = ({ balance, currentUser, totalQuotaValue, onSuccess, onError, onRefresh }: WithdrawViewProps) => {
    const [val, setVal] = useState('');
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, transactionId: number | null, code: string }>({ isOpen: false, transactionId: null, code: '' });
    const [showAd, setShowAd] = useState(false);
    const [adTimer, setAdTimer] = useState(5);

    // Quick amount options
    const quickAmounts = [50, 100, 200, 500];

    const { isValidAmount, withdrawalAmount, isFree, fee, netAmount } = useMemo(() => {
        const amount = parseFloat(val) || 0;
        const valid = val !== '' && amount > 0 && amount <= balance;
        const free = totalQuotaValue >= amount;
        const f = (valid && !free) ? Math.max(5, amount * 0.02) : 0;
        const net = valid ? amount - f : 0;
        return { isValidAmount: valid, withdrawalAmount: amount, isFree: free, fee: f, netAmount: net };
    }, [val, balance, totalQuotaValue]);


    const [twoFactorData, setTwoFactorData] = useState<{ otpUri: string } | null>(null);

    useEffect(() => {
        if (confirmModal.isOpen) {
            fetch2FASetup();
        }
    }, [confirmModal.isOpen]);

    useEffect(() => {
        let interval: any;
        if (showAd && adTimer > 0) {
            interval = setInterval(() => {
                setAdTimer(prev => prev - 1);
            }, 1000);
        } else if (showAd && adTimer === 0) {
            // Quando o timer acaba, podemos permitir fechar ou fechar automaticamente
            // Vamos deixar o botão de fechar aparecer
        }
        return () => clearInterval(interval);
    }, [showAd, adTimer]);

    const fetch2FASetup = async () => {
        try {
            const data = await apiService.get2FASetup();
            setTwoFactorData(data);
        } catch (e) {
            console.error('Erro ao buscar setup 2FA:', e);
        }
    };

    const handleConfirmWithCode = async () => {
        if (!confirmModal.transactionId) return;
        try {
            const res = await confirmWithdrawal(confirmModal.transactionId, confirmModal.code);
            if (res.success) {
                onSuccess('Resgate Confirmado!', 'Seu resgate foi processado com sucesso.');
                setConfirmModal({ ...confirmModal, isOpen: false });
                setVal('');
                onRefresh();
            } else {
                onError('Erro na Confirmação', res.message);
            }
        } catch (e: any) {
            onError('Erro na Confirmação', e.message);
        }
    };

    const handleRequestWithdrawal = async () => {
        const amount = parseFloat(val);
        // Regra de anúncio: mostrar sempre ao solicitar saque
        setShowAd(true);
        setAdTimer(5);
    };

    const processWithdrawal = async () => {
        setShowAd(false);
        const amount = parseFloat(val);
        try {
            const res = await apiService.requestWithdrawal(amount, currentUser?.pixKey || '');

            if (res.success && res.data?.requiresConfirmation) {
                setConfirmModal({ isOpen: true, transactionId: res.data.transactionId, code: '' });
            } else if (res.success) {
                onSuccess('Solicitação Enviada', 'Solicitação de resgate enviada! Aguarde processamento.');
                setVal('');
                onRefresh();
            } else {
                onError('Erro no Resgate', res.message);
            }
        } catch (e: any) {
            onError('Erro no Resgate', e.message);
        }
    };

    return (
        <div className="max-w-md mx-auto space-y-6">
            {/* Balance Overview Card */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-black">
                <div className="text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ArrowUpFromLine size={32} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Solicitar Resgate</h2>
                    <p className="text-sm opacity-80">Transfira seu saldo disponível para sua chave PIX cadastrada</p>
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
                        <label className="text-xs text-zinc-400 block mb-3">Valor do Resgate</label>

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
                                    <span className="text-zinc-400">Taxa de resgate ({isFree ? 'Grátis' : '2%'})</span>
                                    <span className={isFree ? 'text-emerald-400' : 'text-zinc-300'}>
                                        {isFree ? 'R$ 0,00' : fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
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
                    onClick={handleRequestWithdrawal}
                    disabled={!isValidAmount || !currentUser?.pixKey}
                    className="w-full bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] mt-6"
                >
                    Confirmar Resgate
                </button>

                {confirmModal.isOpen && (
                    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[500] p-0 sm:p-4 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-[#0A0A0A] border-t sm:border border-white/5 sm:border-surfaceHighlight rounded-t-[2.5rem] sm:rounded-3xl p-8 w-full sm:max-w-sm relative shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 duration-500 sm:duration-300">
                            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6 sm:hidden opacity-50" />

                            <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition hidden sm:block">
                                <XCircle size={24} />
                            </button>

                            <div className="text-center mb-8">
                                <div className="w-20 h-20 bg-primary-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary-900/20 ring-1 ring-primary-500/20">
                                    <ShieldCheck size={40} className="text-primary-500" strokeWidth={2.5} />
                                </div>
                                <h3 className="text-2xl font-black text-white tracking-tight">Autenticação 2FA</h3>
                                <p className="text-zinc-500 text-sm mt-2 font-medium">Insira o código do seu autenticador</p>
                            </div>

                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="000 000"
                                value={confirmModal.code}
                                onChange={e => setConfirmModal({ ...confirmModal, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                                className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-5 text-center text-4xl tracking-[0.2em] text-white focus:border-primary-500/50 outline-none mb-8 font-black font-mono transition-all"
                                autoFocus
                            />

                            <div className="space-y-4">
                                <button
                                    onClick={handleConfirmWithCode}
                                    className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black uppercase tracking-widest py-5 rounded-2xl transition-all shadow-2xl shadow-primary-500/20 active:scale-[0.98]"
                                >
                                    CONFIRMAR RESGATE
                                </button>

                                {twoFactorData?.otpUri && (
                                    <a
                                        href={twoFactorData.otpUri}
                                        className="w-full bg-white/5 hover:bg-white/10 text-zinc-400 py-4 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        <ShieldCheck size={14} /> Abrir Autenticador
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
                <p className="text-xs text-blue-300 flex items-center gap-2">
                    <Clock size={14} />
                    <span>Processamento em até 24h úteis</span>
                </p>
                <p className="text-xs text-zinc-400 mt-2">
                    Taxa mínima de R$ 5,00 ou 2% do valor do resgate.
                </p>
                <p className="text-xs text-emerald-400/80 mt-2">
                    💡 <strong>Benefício VIP:</strong> Se o valor das suas participações for maior ou igual ao resgate, a taxa é <strong>ZERO</strong>!
                </p>
                <p className="text-xs text-zinc-400 mt-2">
                    <strong>Importante:</strong> Você está resgatando do seu saldo disponível na conta.
                </p>
            </div>

            {/* Legal Disclaimer */}
            <div className="px-4 text-[10px] text-zinc-600 text-center leading-relaxed">
                <p>O resgate será processado via PIX pelo gateway Asaas. O Cred30 não armazena dados bancários. O prazo de processamento pode variar em feriados ou fins de semana. Resgates acima de R$ 2.000,00 podem exigir comprovação de origem dos fundos conforme política anti-lavagem (AML).</p>
            </div>

            {/* Anúncio Intersticial Premium */}
            {showAd && (
                <div className="fixed inset-0 bg-black/95 z-[600] flex flex-col items-center justify-center p-6 animate-in fade-in duration-500 backdrop-blur-2xl">
                    <div className="w-full max-w-md relative flex flex-col h-[80vh] sm:h-auto">
                        {/* Status Bar */}
                        <div className="flex justify-between items-center mb-8 px-2 animate-in slide-in-from-top-4 duration-700">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">Resgate Seguro Cred30</span>
                            </div>

                            {adTimer > 0 ? (
                                <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                                    <span className="text-[10px] text-zinc-400 font-bold">Pular em <span className="text-primary-400 font-black">{adTimer}s</span></span>
                                </div>
                            ) : (
                                <button
                                    onClick={processWithdrawal}
                                    className="bg-primary-500 text-black px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95"
                                >
                                    PULAR <ArrowUpFromLine size={14} />
                                </button>
                            )}
                        </div>

                        {/* Ad Card */}
                        <div className="bg-[#0A0A0A] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl flex-1 flex flex-col animate-in zoom-in-95 duration-500">
                            <div className="relative flex-1 overflow-hidden group">
                                <img
                                    src="/ad-banner.png"
                                    alt="Oferta Especial"
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/20 to-transparent"></div>

                                <div className="absolute bottom-8 left-8 right-8">
                                    <span className="bg-primary-500 text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest mb-4 inline-block shadow-lg">Oferta VIP</span>
                                    <h4 className="text-3xl font-black text-white leading-tight tracking-tighter">Multiplique seus ganhos com o VIP!</h4>
                                    <p className="text-zinc-400 text-sm mt-3 font-medium leading-relaxed">Membros do clube aproveitam taxas zero em todos os resgates acima de R$ 50,00.</p>
                                </div>
                            </div>

                            <div className="p-8 bg-zinc-900/30 flex items-center justify-between border-t border-white/5">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-primary-500/10 rounded-2xl flex items-center justify-center text-primary-400 ring-1 ring-primary-500/20">
                                        <TrendingUp size={28} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-white uppercase tracking-tight">Clube Cred30</p>
                                        <p className="text-xs text-zinc-500 font-bold">Aproveite agora</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => window.open('https://www.effectivegatecpm.com/ec4mxdzvs?key=a9eefff1a8aa7769523373a66ff484aa', '_blank')}
                                    className="bg-white/10 hover:bg-white/20 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                                >
                                    CONHECER
                                </button>
                            </div>
                        </div>

                        <div className="mt-8 text-center animate-in fade-in duration-1000 delay-500">
                            <p className="text-[9px] text-zinc-600 uppercase font-black tracking-[0.3em]">Patrocinado por Cred30 Network</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
