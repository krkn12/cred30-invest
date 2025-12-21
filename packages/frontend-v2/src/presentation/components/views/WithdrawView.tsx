import React, { useState, useMemo, useEffect } from 'react';
import { ArrowUpFromLine, ShieldCheck, Clock, XCircle, TrendingUp } from 'lucide-react';
import packageJson from '../../../../package.json';
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
                onSuccess('Saque Confirmado!', 'Seu saque foi processado com sucesso.');
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
                onSuccess('Solicitação Enviada', 'Solicitação de saque enviada! Aguarde processamento.');
                setVal('');
                onRefresh();
            } else {
                onError('Erro no Saque', res.message);
            }
        } catch (e: any) {
            onError('Erro no Saque', e.message);
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
                                    <span className="text-zinc-400">Taxa de saque ({isFree ? 'Grátis' : '2%'})</span>
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
                    Confirmar Saque
                </button>

                {confirmModal.isOpen && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-surface rounded-3xl p-6 md:p-8 w-full max-w-sm relative border border-surfaceHighlight shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                            <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition z-10">
                                <XCircle size={24} />
                            </button>

                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <ShieldCheck size={32} className="text-primary-500" />
                                </div>
                                <h3 className="text-xl font-bold text-white">Autenticação 2FA</h3>
                                <p className="text-zinc-400 text-sm mt-2 mb-6">Insira o código de 6 dígitos do seu autenticador para confirmar o saque.</p>

                                {twoFactorData?.otpUri && (
                                    <a
                                        href={twoFactorData.otpUri}
                                        className="mb-6 w-full bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 border border-primary-500/30 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all"
                                    >
                                        <ShieldCheck size={18} />
                                        Abrir no Autenticador
                                    </a>
                                )}
                            </div>

                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="000 000"
                                value={confirmModal.code}
                                onChange={e => setConfirmModal({ ...confirmModal, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-4 text-center text-2xl tracking-[0.5em] text-white focus:border-primary-500 outline-none mb-6 font-mono"
                                autoFocus
                            />

                            <button
                                onClick={handleConfirmWithCode}
                                className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-4 rounded-xl transition-all shadow-lg active:scale-95"
                            >
                                Confirmar e Sacar
                            </button>
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
                    Taxa mínima de R$ 5,00 ou 2% do valor do saque.
                </p>
                <p className="text-xs text-emerald-400/80 mt-2">
                    💡 <strong>Benefício VIP:</strong> Se o valor das suas participações for maior ou igual ao saque, a taxa é <strong>ZERO</strong>!
                </p>
                <p className="text-xs text-zinc-400 mt-2">
                    <strong>Importante:</strong> Você está sacando do seu saldo disponível na conta.
                </p>
            </div>

            {/* Anúncio Intersticial */}
            {showAd && (
                <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300 backdrop-blur-md">
                    <div className="w-full max-w-lg relative animate-in zoom-in duration-500">
                        {/* Botão de Fechar com Timer */}
                        <div className="absolute -top-12 right-0 flex items-center gap-3">
                            {adTimer > 0 ? (
                                <span className="text-zinc-400 text-xs font-bold bg-zinc-800/80 px-3 py-1.5 rounded-full border border-zinc-700">
                                    O saque continuará em {adTimer}s...
                                </span>
                            ) : (
                                <button
                                    onClick={processWithdrawal}
                                    className="bg-primary-500 text-black px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-primary-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] animate-bounce"
                                >
                                    Pular Anúncio <ArrowUpFromLine size={16} />
                                </button>
                            )}
                        </div>

                        {/* Conteúdo do Anúncio */}
                        <div className="bg-surface border border-primary-500/20 rounded-3xl overflow-hidden shadow-2xl">
                            <div className="relative aspect-square sm:aspect-video overflow-hidden">
                                <img
                                    src="/ad-banner.png"
                                    alt="Oferta Especial"
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                                <div className="absolute bottom-4 left-6 right-6">
                                    <span className="bg-primary-500 text-black text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider mb-2 inline-block">Patrocinado</span>
                                    <h4 className="text-xl font-bold text-white">Ganhe até 10% de Cashback!</h4>
                                    <p className="text-zinc-300 text-xs mt-1">Sabia que como membro VIP Ouro você recupera parte de cada aporte?</p>
                                </div>
                            </div>

                            <div className="p-6 bg-zinc-900/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-400">
                                        <TrendingUp size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-white">Cred30 Rewards</p>
                                        <p className="text-[10px] text-zinc-500">Aproveite agora mesmo</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => window.open('https://www.effectivegatecpm.com/ec4mxdzvs?key=a9eefff1a8aa7769523373a66ff484aa', '_blank')}
                                    className="text-primary-400 text-xs font-bold hover:underline"
                                >
                                    VER OFERTA
                                </button>
                            </div>
                        </div>

                        <p className="text-center text-[10px] text-zinc-600 mt-4 uppercase tracking-[0.2em]">Anúncio Premium • Cred30 v{packageJson.version}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
