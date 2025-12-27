import React, { useState } from 'react';
import { Bug, Send, X as XIcon } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

interface BugReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({ isOpen, onClose, onSuccess, onError }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<'general' | 'payment' | 'ui' | 'performance' | 'other'>('general');
    const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('low');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (title.length < 5 || description.length < 20) {
            onError('Campos Inválidos', 'Título mín. 5 caracteres. Descrição mín. 20 caracteres.');
            return;
        }

        setIsSubmitting(true);
        try {
            const deviceInfo = JSON.stringify({
                userAgent: navigator.userAgent,
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight,
                url: window.location.href
            });

            const res = await apiService.post<any>('/bugs', {
                title,
                description,
                category,
                severity,
                deviceInfo
            });

            if (res.success) {
                onSuccess('Bug Reportado!', 'Obrigado pelo feedback. Nossa equipe irá analisar.');
                setTitle('');
                setDescription('');
                setCategory('general');
                setSeverity('low');
                onClose();
            } else {
                onError('Erro', res.message);
            }
        } catch (error: any) {
            onError('Erro ao Enviar', error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const categoryOptions = [
        { value: 'general', label: 'Geral' },
        { value: 'payment', label: 'Pagamentos' },
        { value: 'ui', label: 'Interface/Visual' },
        { value: 'performance', label: 'Lentidão' },
        { value: 'other', label: 'Outro' },
    ];

    const severityOptions = [
        { value: 'low', label: 'Baixa', color: 'bg-zinc-500' },
        { value: 'medium', label: 'Média', color: 'bg-yellow-500' },
        { value: 'high', label: 'Alta', color: 'bg-orange-500' },
        { value: 'critical', label: 'Crítica', color: 'bg-red-500' },
    ];

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400">
                            <Bug size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Reportar Problema</h2>
                            <p className="text-zinc-500 text-xs">Ajude-nos a melhorar o sistema</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white p-2 rounded-full hover:bg-zinc-800 transition">
                        <XIcon size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-2 block">Título do Problema</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex: Botão de saque não funciona"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:border-primary-500 outline-none transition"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-2 block">Descrição Detalhada</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Descreva o problema com o máximo de detalhes possível. O que você estava fazendo? O que aconteceu?"
                            rows={4}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:border-primary-500 outline-none transition resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-2 block">Categoria</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value as any)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-primary-500 outline-none transition"
                            >
                                {categoryOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-2 block">Severidade</label>
                            <div className="flex gap-1">
                                {severityOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setSeverity(opt.value as any)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${severity === opt.value
                                            ? `${opt.color} text-black`
                                            : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || title.length < 5 || description.length < 20}
                        className="w-full bg-primary-500 hover:bg-primary-400 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20"
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        ) : (
                            <>
                                <Send size={18} />
                                Enviar Relatório
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
