import React, { useState } from 'react';
import { DollarSign, AlertTriangle, X as XIcon, CheckCircle2, ShieldCheck, Clock } from 'lucide-react';
import { Loan, User } from '../../../domain/types/common.types';

interface LoansViewProps {
    loans: Loan[];
    onRequest: (amount: number, installments: number, pixKey: string) => void;
    onPay: (loanId: string, full: boolean, method?: 'pix' | 'card') => void;
    onPayInstallment: (loanId: string, amount: number, full: boolean, method?: 'pix' | 'card') => void;
    userBalance: number;
    currentUser: User | null;
}

export const LoansView = ({ loans, onRequest, onPay, onPayInstallment, userBalance, currentUser }: LoansViewProps) => {
    const [amount, setAmount] = useState(500);
    const [months, setMonths] = useState(3);
    const [payModalId, setPayModalId] = useState<string | null>(null);
    const [payMethod, setPayMethod] = useState<'pix' | 'card'>('pix');
    const [viewDetailsId, setViewDetailsId] = useState<string | null>(null);
    const [installmentModalData, setInstallmentModalData] = useState<{ loanId: string, installmentAmount: number } | null>(null);

    const interestRate = 0.20; // 20%
    const totalRepay = amount * (1 + interestRate);
    const monthlyPayment = totalRepay / months;

    const activeLoans = loans.filter(l => l.status === 'APPROVED' || l.status === 'PENDING' || l.status === 'PAYMENT_PENDING' || l.status === 'REJECTED');
    const selectedLoan = activeLoans.find(l => l.id === payModalId);

    // Helper: Calculate remaining installments
    const getRemainingInstallments = (loan: Loan) => {
        const total = loan.installments;
        const paid = loan.paidInstallmentsCount || 0;
        return Math.max(0, total - paid);
    };

    // Helper: Calculate installment value
    const getInstallmentValue = (loan: Loan) => {
        return loan.totalRepayment / loan.installments;
    };

    return (
        <div className="space-y-8 pb-32">
            {/* Loan Request Card */}
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <DollarSign size={120} />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
                            <DollarSign className="text-primary-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Solicitar Empréstimo</h2>
                            <p className="text-zinc-400 text-sm">Crédito rápido na sua conta</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Simulation Inputs */}
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs text-zinc-400 font-medium mb-2 block">Quanto você precisa?</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-medium">R$</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(Number(e.target.value))}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-4 pl-10 pr-4 text-white text-lg font-bold focus:border-primary-500 outline-none transition"
                                        placeholder="0,00"
                                    />
                                </div>
                                <div className="flex gap-2 mt-2">
                                    {[100, 300, 500, 1000].map(val => (
                                        <button
                                            key={val}
                                            onClick={() => setAmount(val)}
                                            className="px-3 py-1 rounded-lg bg-surfaceHighlight text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white transition"
                                        >
                                            R$ {val}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-zinc-400 font-medium mb-2 block">Em quantas vezes?</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[1, 2, 3, 6].map(m => (
                                        <button
                                            key={m}
                                            onClick={() => setMonths(m)}
                                            className={`py-3 rounded-xl text-sm font-bold border transition ${months === m
                                                    ? 'bg-primary-500 text-black border-primary-500'
                                                    : 'bg-background border-surfaceHighlight text-zinc-400 hover:border-zinc-600'
                                                }`}
                                        >
                                            {m}x
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="bg-background rounded-2xl p-6 border border-surfaceHighlight flex flex-col justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-white mb-4">Resumo da Simulação</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-zinc-500">Valor Solicitado</span>
                                        <span className="text-white font-medium">{amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-zinc-500">Juros (20%)</span>
                                        <span className="text-red-400 font-medium">{(totalRepay - amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-zinc-500">Valor da Parcela</span>
                                        <span className="text-primary-400 font-medium">{monthlyPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="h-px bg-zinc-800 my-2"></div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-zinc-400 text-sm">Total a Pagar</span>
                                        <span className="text-xl font-bold text-white">{totalRepay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => onRequest(amount, months, currentUser?.pixKey || '')}
                                disabled={!amount || amount <= 0}
                                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl mt-6 transition shadow-lg shadow-emerald-500/20"
                            >
                                Solicitar Empréstimo
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Loans List */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-white pl-1">Seus Empréstimos</h3>

                {activeLoans.length === 0 && (
                    <div className="text-center py-12 bg-surface/50 rounded-3xl border border-surfaceHighlight border-dashed">
                        <p className="text-zinc-500">Nenhum empréstimo ativo no momento.</p>
                    </div>
                )}

                {activeLoans.map(loan => {
                    const daysUntilDue = loan.dueDate ? Math.ceil((new Date(loan.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
                    const isOverdue = daysUntilDue < 0;
                    const isUrgent = daysUntilDue <= 3 && daysUntilDue >= 0;

                    const paidAmount = loan.totalPaid || 0;
                    const remainingAmount = loan.remainingAmount || loan.totalRepayment;
                    const progressPercentage = (paidAmount / loan.totalRepayment) * 100;
                    const installmentValue = getInstallmentValue(loan);

                    return (
                        <div key={loan.id} className="bg-surface border border-surfaceHighlight rounded-2xl p-5 transition hover:border-zinc-700">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${loan.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' :
                                            loan.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-zinc-800 text-zinc-400'
                                        }`}>
                                        <DollarSign size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-lg">{loan.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h4>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${loan.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                                                    loan.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400' :
                                                        'bg-zinc-800 text-zinc-400'
                                                }`}>
                                                {loan.status === 'APPROVED' ? 'Aprovado' : loan.status === 'PENDING' ? 'Em Análise' : loan.status}
                                            </span>
                                            {isOverdue && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle size={10} /> Atrasado</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="text-xs text-zinc-400">Restante</p>
                                    <p className="font-bold text-white">{remainingAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            {loan.status === 'APPROVED' && (
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-zinc-500">{loan.paidInstallmentsCount || 0} de {loan.installments} parcelas</span>
                                        <span className="text-zinc-400">{progressPercentage.toFixed(0)}% pago</span>
                                    </div>
                                    <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            {loan.status === 'APPROVED' && !loan.isFullyPaid && (
                                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-surfaceHighlight">
                                    <button
                                        onClick={() => setInstallmentModalData({ loanId: loan.id, installmentAmount: installmentValue })}
                                        className="py-2.5 rounded-xl bg-surfaceHighlight hover:bg-zinc-700 text-white text-sm font-medium transition"
                                    >
                                        Pagar Parcela
                                    </button>
                                    <button
                                        onClick={() => setPayModalId(loan.id)}
                                        className={`py-2.5 rounded-xl text-white text-sm font-medium transition ${isOverdue ? 'bg-red-500 hover:bg-red-600' : 'bg-primary-500 hover:bg-primary-400 text-black'}`}
                                    >
                                        Quitar Tudo
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Pay Full Loan Modal */}
            {selectedLoan && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={(e) => { if (e.target === e.currentTarget) setPayModalId(null); }}>
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative animate-fade-in">
                        <button title="Fechar" onClick={() => setPayModalId(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 p-1.5 rounded-full z-10"><XIcon size={24} /></button>

                        <h3 className="text-xl font-bold text-white mb-4">Quitar Empréstimo</h3>
                        <p className="text-zinc-400 text-sm mb-6">
                            Você está prestes a quitar o valor total de <strong className="text-white">{selectedLoan.totalRepayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>.
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
                            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl mb-3"
                        >
                            {userBalance < selectedLoan.totalRepayment ? 'Saldo Insuficiente' : 'Pagar com Saldo'}
                        </button>
                    </div>
                </div>
            )}

            {/* Pay Installment Modal */}
            {installmentModalData && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={(e) => { if (e.target === e.currentTarget) setInstallmentModalData(null); }}>
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative animate-fade-in">
                        <button title="Fechar" onClick={() => setInstallmentModalData(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 p-1.5 rounded-full z-10"><XIcon size={24} /></button>

                        <h3 className="text-xl font-bold text-white mb-4">Pagar Parcela</h3>
                        <p className="text-zinc-400 text-sm mb-6">
                            Valor da parcela: <strong className="text-white">{installmentModalData.installmentAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
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
                    </div>
                </div>
            )}
        </div>
    );
};
