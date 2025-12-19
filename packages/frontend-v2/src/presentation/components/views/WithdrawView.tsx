import React, { useState } from 'react';
import { ArrowUpFromLine, ShieldCheck, Clock } from 'lucide-react';
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

    // Quick amount options
    const quickAmounts = [50, 100, 200, 500];
    const isValidAmount = val && parseFloat(val) > 0 && parseFloat(val) <= balance;

    // Taxa de saque: Grátis se Valor Total de Cotas >= Valor do Saque
    const withdrawalAmount = parseFloat(val) || 0;
    const isFree = totalQuotaValue >= withdrawalAmount;
    const fee = (isValidAmount && !isFree) ? Math.max(5, withdrawalAmount * 0.02) : 0;
    const netAmount = isValidAmount ? withdrawalAmount - fee : 0;

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
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <div className="bg-surface rounded-3xl p-6 w-full max-w-sm relative border border-surfaceHighlight">
                            <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="absolute top-4 right-4 text-zinc-500">✕</button>
                            <div className="text-center mb-6">
                                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <ShieldCheck size={24} className="text-orange-500" />
                                </div>
                                <h3 className="text-xl font-bold text-white">Confirmação de Segurança</h3>
                                <p className="text-zinc-400 text-sm mt-2">Um código foi enviado para seu email para autorizar este saque.</p>
                            </div>

                            <input
                                type="text"
                                placeholder="Código de 6 dígitos"
                                value={confirmModal.code}
                                onChange={e => setConfirmModal({ ...confirmModal, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 text-center text-xl tracking-widest text-white focus:border-orange-500 outline-none mb-4 font-mono"
                            />

                            <button
                                onClick={handleConfirmWithCode}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl"
                            >
                                Confirmar e Sacar
                            </button>
                        </div>
                    </div>
                )}

                <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
                    <p className="text-xs text-blue-300 flex items-center gap-2">
                        <Clock size={14} />
                        <span>Processamento em até 24h úteis</span>
                    </p>
                    <p className="text-xs text-zinc-400 mt-2">
                        Taxa mínima de R$ 5,00 ou 2% do valor do saque.
                    </p>
                    <p className="text-xs text-emerald-400/80 mt-2">
                        💡 <strong>Benefício VIP:</strong> Se o valor das suas cotas for maior ou igual ao saque, a taxa é <strong>ZERO</strong>!
                    </p>
                    <p className="text-xs text-zinc-400 mt-2">
                        <strong>Importante:</strong> Você está sacando do seu saldo disponível na conta.
                    </p>
                </div>
            </div>
        </div >
    );
};
