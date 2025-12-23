import React, { useState } from 'react';
import { Star, X, Send, MessageSquare, CheckCircle2 } from 'lucide-react';

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (rating: number, comment: string, isPublic: boolean) => Promise<void>;
    transactionId: number;
    amount: number;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    transactionId,
    amount
}) => {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [hoveredStar, setHoveredStar] = useState(0);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onSubmit(rating, comment, isPublic);
            setIsSuccess(true);
            setTimeout(() => {
                onClose();
                setIsSuccess(false);
                setRating(5);
                setComment('');
                setIsPublic(false);
            }, 2000);
        } catch (error) {
            console.error('Erro ao enviar avaliação:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCurrency = (value: number) =>
        value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    return (
        <div
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500/20 to-primary-500/20 p-6 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1.5 bg-zinc-800/50 rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                            <CheckCircle2 className="text-emerald-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Saque Processado!</h2>
                            <p className="text-emerald-400 font-medium">{formatCurrency(amount)}</p>
                        </div>
                    </div>
                </div>

                {isSuccess ? (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="text-emerald-400" size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Obrigado!</h3>
                        <p className="text-zinc-400 text-sm">Sua avaliação foi enviada com sucesso.</p>
                        <p className="text-emerald-400 text-sm font-medium mt-2">+2 pontos de Score!</p>
                    </div>
                ) : (
                    <div className="p-6 space-y-6">
                        {/* Rating Stars */}
                        <div className="text-center">
                            <p className="text-zinc-400 text-sm mb-3">Como foi sua experiência?</p>
                            <div className="flex justify-center gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => setRating(star)}
                                        onMouseEnter={() => setHoveredStar(star)}
                                        onMouseLeave={() => setHoveredStar(0)}
                                        className="transition-transform hover:scale-110"
                                    >
                                        <Star
                                            size={36}
                                            className={`transition-colors ${star <= (hoveredStar || rating)
                                                    ? 'text-amber-400 fill-amber-400'
                                                    : 'text-zinc-700'
                                                }`}
                                        />
                                    </button>
                                ))}
                            </div>
                            <p className="text-zinc-500 text-xs mt-2">
                                {rating === 5 && 'Excelente!'}
                                {rating === 4 && 'Muito bom!'}
                                {rating === 3 && 'Bom'}
                                {rating === 2 && 'Pode melhorar'}
                                {rating === 1 && 'Ruim'}
                            </p>
                        </div>

                        {/* Comment */}
                        <div>
                            <label className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
                                <MessageSquare size={14} />
                                Deixe um comentário (opcional)
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Conte como foi sua experiência com o saque..."
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-white placeholder-zinc-500 text-sm resize-none focus:border-primary-500 focus:outline-none transition-colors"
                                rows={3}
                                maxLength={500}
                            />
                            <p className="text-zinc-600 text-xs mt-1 text-right">{comment.length}/500</p>
                        </div>

                        {/* Public Toggle */}
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={isPublic}
                                    onChange={(e) => setIsPublic(e.target.checked)}
                                    className="sr-only"
                                />
                                <div className={`w-12 h-6 rounded-full transition-colors ${isPublic ? 'bg-primary-500' : 'bg-zinc-700'}`}>
                                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </div>
                            </div>
                            <div>
                                <p className="text-white text-sm font-medium group-hover:text-primary-400 transition-colors">
                                    Tornar público
                                </p>
                                <p className="text-zinc-500 text-xs">
                                    Seu depoimento pode aparecer na página inicial (após aprovação)
                                </p>
                            </div>
                        </label>

                        {/* Submit Button */}
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="w-full bg-gradient-to-r from-emerald-500 to-primary-500 hover:from-emerald-400 hover:to-primary-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Send size={18} />
                                    Enviar Avaliação
                                </>
                            )}
                        </button>

                        <p className="text-center text-zinc-600 text-xs">
                            Ao avaliar, você ganha +2 pontos de Score!
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewModal;
