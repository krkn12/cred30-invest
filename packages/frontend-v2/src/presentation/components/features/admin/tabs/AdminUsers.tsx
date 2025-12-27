import React, { useState } from 'react';
import { Gift } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';
import { AdminUserManagement } from '../AdminUserManagement';

interface AdminUsersProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const AdminUsers: React.FC<AdminUsersProps> = ({ onSuccess, onError }) => {
    const [giftEmail, setGiftEmail] = useState('');
    const [giftQuantity, setGiftQuantity] = useState('');
    const [giftReason, setGiftReason] = useState('');

    const handleGiftQuota = async () => {
        if (!giftEmail || !giftQuantity) return;
        if (!window.confirm(`CONFIRMAÇÃO: Enviar ${giftQuantity} participações para ${giftEmail}? Esta ação criará as participações e não cobrará do usuário.`)) return;

        try {
            const response = await apiService.post<any>('/admin/users/add-quota', {
                email: giftEmail,
                quantity: parseInt(giftQuantity),
                reason: giftReason
            });
            if (response.success) {
                onSuccess('Envio Realizado!', response.message);
                setGiftEmail('');
                setGiftQuantity('');
                setGiftReason('');
            } else {
                onError('Erro', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    return (
        <div className="space-y-8">
            <AdminUserManagement onSuccess={onSuccess} onError={onError} />

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl max-w-2xl mx-auto opacity-50 hover:opacity-100 transition-opacity">
                <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg"><Gift className="text-purple-400" size={20} /></div>
                    Presentear Participações (Ação Direta)
                </h3>
                <div className="space-y-4">
                    <input
                        type="email"
                        placeholder="Email do usuário"
                        value={giftEmail}
                        onChange={(e) => setGiftEmail(e.target.value)}
                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-purple-500/50 font-bold"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="number"
                            placeholder="Quantidade"
                            value={giftQuantity}
                            onChange={(e) => setGiftQuantity(e.target.value)}
                            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-purple-500/50 font-bold"
                        />
                        <button
                            onClick={handleGiftQuota}
                            className="bg-purple-500 hover:bg-purple-400 text-black font-black px-6 py-4 rounded-2xl transition-all shadow-xl"
                        >
                            Enviar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
