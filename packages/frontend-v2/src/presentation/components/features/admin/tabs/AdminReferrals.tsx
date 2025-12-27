import React, { useState, useEffect } from 'react';
import { UserPlus, Users, Trash2 } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

interface AdminReferralsProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const AdminReferrals: React.FC<AdminReferralsProps> = ({ onSuccess, onError }) => {
    const [referralCodes, setReferralCodes] = useState<any[]>([]);
    const [newReferralCode, setNewReferralCode] = useState('');
    const [referralMaxUses, setReferralMaxUses] = useState('');

    useEffect(() => {
        fetchReferralCodes();
    }, []);

    const fetchReferralCodes = async () => {
        try {
            const response = await apiService.get<any[]>('/admin/referral-codes');
            if (response.success) {
                setReferralCodes(response.data || []);
            }
        } catch (error) {
            console.error('Erro ao buscar códigos:', error);
        }
    };

    const handleCreateReferralCode = async () => {
        if (!newReferralCode) return;
        try {
            const response = await apiService.post<any>('/admin/referral-codes', {
                code: newReferralCode,
                maxUses: referralMaxUses ? parseInt(referralMaxUses) : null
            });
            if (response.success) {
                onSuccess('Sucesso', 'Código criado!');
                setNewReferralCode('');
                setReferralMaxUses('');
                fetchReferralCodes();
            } else {
                onError('Erro', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleDeleteReferralCode = async (id: number) => {
        if (!window.confirm('Excluir este código definitivamente?')) return;
        try {
            const response = await apiService.delete<any>(`/admin/referral-codes/${id}`);
            if (response.success) {
                onSuccess('Removido', 'Código excluído com sucesso');
                fetchReferralCodes();
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                        <div className="p-2 bg-primary-500/10 rounded-lg"><UserPlus className="text-primary-400" size={20} /></div>
                        Criar Novo Código
                    </h3>
                    <div className="space-y-4">
                        <input
                            type="text"
                            placeholder="CÓDIGO (EX: VIP2024)"
                            value={newReferralCode}
                            onChange={(e) => setNewReferralCode(e.target.value.toUpperCase())}
                            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 font-bold"
                        />
                        <input
                            type="number"
                            placeholder="Máximo de Usos (vazio = ilimitado)"
                            value={referralMaxUses}
                            onChange={(e) => setReferralMaxUses(e.target.value)}
                            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 font-bold"
                        />
                        <button
                            onClick={handleCreateReferralCode}
                            className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-2xl transition-all shadow-xl"
                        >
                            Gerar Código VIP
                        </button>
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                        <div className="p-2 bg-zinc-800 rounded-lg"><Users className="text-zinc-400" size={20} /></div>
                        Códigos Administrativos
                    </h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {referralCodes.map((rc) => (
                            <div key={rc.id} className="bg-black/20 border border-zinc-800 px-4 py-3 rounded-xl flex justify-between items-center">
                                <div>
                                    <p className="font-black text-white tracking-widest leading-none">{rc.code}</p>
                                    <p className="text-[10px] text-zinc-500 font-bold mt-1 uppercase">Usos: {rc.current_uses} / {rc.max_uses || '∞'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleDeleteReferralCode(rc.id)}
                                        className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                                        aria-label="Excluir código de indicação"
                                        title="Excluir código de indicação"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {referralCodes.length === 0 && (
                            <div className="text-center py-20 opacity-30">
                                <Users size={48} className="mx-auto mb-4" />
                                <p className="text-xs font-bold uppercase tracking-widest">Nenhum código gerado</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
