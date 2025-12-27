import React, { useState, useEffect } from 'react';
import { ArrowUpRight, Check, Clipboard } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

interface AdminPayoutsProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const AdminPayouts: React.FC<AdminPayoutsProps> = ({ onSuccess, onError }) => {
    const [payoutQueue, setPayoutQueue] = useState<{ transactions: any[], loans: any[] }>({ transactions: [], loans: [] });

    useEffect(() => {
        fetchPayoutQueue();
    }, []);

    const fetchPayoutQueue = async () => {
        try {
            const data = await apiService.getPayoutQueue();
            setPayoutQueue(data || { transactions: [], loans: [] });
        } catch (e) {
            console.error('Erro ao buscar fila de pagamentos:', e);
        }
    };

    const handleConfirmPayout = async (id: any, type: 'TRANSACTION' | 'LOAN') => {
        try {
            await apiService.confirmPayout(id.toString(), type);
            onSuccess('Sucesso', 'Pagamento registrado com sucesso!');
            fetchPayoutQueue();
        } catch (e: any) {
            onError('Erro', e.message || 'Falha ao confirmar pagamento.');
        }
    };

    const formatCurrency = (val: number | string) => {
        const numVal = typeof val === 'string' ? parseFloat(val) : val;
        if (typeof numVal !== 'number' || isNaN(numVal)) return 'R$ 0,00';
        return numVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="max-w-4xl mx-auto">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold text-white flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg"><ArrowUpRight className="text-emerald-400" size={20} /></div>
                            Fila de Resgates (PIX)
                        </h3>
                        <span className="bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full text-[10px] font-black uppercase">Pendentes: {payoutQueue.transactions?.length || 0}</span>
                    </div>

                    <div className="space-y-4 max-h-[700px] overflow-y-auto pr-3 custom-scrollbar">
                        {!payoutQueue.transactions || payoutQueue.transactions.length === 0 ? (
                            <div className="py-24 text-center">
                                <div className="bg-zinc-800/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check className="text-zinc-500" size={32} />
                                </div>
                                <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Tudo em dia!</p>
                            </div>
                        ) : (
                            payoutQueue.transactions.map((t) => (
                                <div key={t.id} className="bg-black/30 border border-zinc-800/50 rounded-2xl p-6 transition-all hover:border-zinc-700 hover:bg-black/40 group">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-3 flex-1">
                                            <div>
                                                <p className="text-sm font-bold text-white mb-0.5">{t.user_name}</p>
                                                <div className="flex items-center gap-2 bg-zinc-800/50 p-2 rounded-lg cursor-pointer" onClick={() => {
                                                    navigator.clipboard.writeText(t.user_pix || t.pix_key);
                                                    onSuccess('Copiado', 'Chave PIX copiada!');
                                                }}>
                                                    <p className="text-[11px] text-primary-400 font-mono break-all">{t.user_pix || t.pix_key}</p>
                                                    <Clipboard size={12} className="text-zinc-500" />
                                                </div>
                                            </div>
                                            <p className="text-2xl font-black text-white">{formatCurrency(t.amount)}</p>
                                        </div>
                                        <button
                                            onClick={() => handleConfirmPayout(t.id, 'TRANSACTION')}
                                            className="p-4 bg-primary-500/10 text-primary-400 rounded-2xl hover:bg-primary-500 hover:text-black transition-all flex flex-col items-center justify-center gap-2 min-w-[120px]"
                                        >
                                            <Check size={20} />
                                            <span className="text-[10px] font-black uppercase">Confirmar</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
