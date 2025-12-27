import React, { useState, useEffect } from 'react';
import { MessageSquare, Check, X as XIcon } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

interface AdminReviewsProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const AdminReviews: React.FC<AdminReviewsProps> = ({ onSuccess, onError }) => {
    const [reviews, setReviews] = useState<any[]>([]);

    useEffect(() => {
        fetchReviews();
    }, []);

    const fetchReviews = async () => {
        try {
            const res = await apiService.getAdminReviews();
            if (res.success) {
                setReviews(res.data || []);
            }
        } catch (e) {
            console.error('Erro ao buscar avaliações:', e);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                    <MessageSquare size={20} className="text-amber-400" />
                    Avaliações de Saques
                </h3>

                {reviews.length === 0 ? (
                    <div className="text-center py-20 opacity-30">
                        <MessageSquare size={48} className="mx-auto mb-4" />
                        <p className="text-xs font-bold uppercase tracking-widest">Nenhuma avaliação registrada</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reviews.map((review) => (
                            <div key={review.id} className={`bg-zinc-800 rounded-2xl p-5 border ${review.is_approved ? 'border-emerald-500/30' : review.is_public ? 'border-amber-500/30' : 'border-zinc-700'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="text-white font-bold">{review.user_name}</p>
                                        <p className="text-zinc-500 text-xs">{review.user_email}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <span key={star} className={star <= review.rating ? 'text-amber-400' : 'text-zinc-700'}>★</span>
                                        ))}
                                    </div>
                                </div>

                                {review.comment && (
                                    <p className="text-zinc-300 text-sm mb-4 italic">"{review.comment}"</p>
                                )}

                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-3">
                                        <span className="text-zinc-500">
                                            Saque: <span className="text-white font-medium">R$ {review.transaction_amount?.toFixed(2)}</span>
                                        </span>
                                        {review.is_public && (
                                            <span className={`px-2 py-0.5 rounded-full ${review.is_approved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                {review.is_approved ? '✓ Aprovado' : 'Pendente'}
                                            </span>
                                        )}
                                    </div>

                                    {review.is_public && !review.is_approved && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await apiService.approveReview(review.id);
                                                        onSuccess('Sucesso', 'Depoimento aprovado!');
                                                        fetchReviews();
                                                    } catch (e) {
                                                        onError('Erro', 'Falha ao aprovar');
                                                    }
                                                }}
                                                className="bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-black px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1"
                                            >
                                                <Check size={14} /> Aprovar
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await apiService.rejectReview(review.id);
                                                        onSuccess('Sucesso', 'Depoimento rejeitado.');
                                                        fetchReviews();
                                                    } catch (e) {
                                                        onError('Erro', 'Falha ao rejeitar');
                                                    }
                                                }}
                                                className="bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-black px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1"
                                            >
                                                <XIcon size={14} /> Rejeitar
                                            </button>
                                        </div>
                                    )}

                                    {review.is_approved && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await apiService.rejectReview(review.id);
                                                    onSuccess('Sucesso', 'Depoimento removido da página.');
                                                    fetchReviews();
                                                } catch (e) {
                                                    onError('Erro', 'Falha ao remover');
                                                }
                                            }}
                                            className="bg-zinc-700 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 px-3 py-1.5 rounded-lg font-bold transition-all"
                                        >
                                            Remover
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
