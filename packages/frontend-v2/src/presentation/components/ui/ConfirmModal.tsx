import React from 'react';
import { AlertTriangle, X as XIcon } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    children?: React.ReactNode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'info',
    children
}) => {
    if (!isOpen) return null;

    const accentColor = type === 'danger' ? 'bg-red-500 hover:bg-red-400 text-white' :
        type === 'warning' ? 'bg-yellow-500 hover:bg-yellow-400 text-black' :
            'bg-primary-500 hover:bg-primary-400 text-black';

    const iconColor = type === 'danger' ? 'text-red-400' :
        type === 'warning' ? 'text-yellow-400' :
            'text-primary-400';

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-[#050505] border border-surfaceHighlight ring-1 ring-white/5 rounded-3xl p-6 w-full max-w-sm relative shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
                <button title="Fechar" onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors bg-zinc-900/50 hover:bg-zinc-800 p-2 rounded-full"><XIcon size={18} /></button>

                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${type === 'danger' ? 'bg-red-500/10 text-red-500' : type === 'warning' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-primary-500/10 text-primary-500'} ring-1 ring-inset ${type === 'danger' ? 'ring-red-500/20' : type === 'warning' ? 'ring-yellow-500/20' : 'ring-primary-500/20'}`}>
                    <AlertTriangle size={28} strokeWidth={2.5} />
                </div>

                <h3 className="text-xl font-black text-white mb-2 tracking-tight">{title}</h3>
                <p className="text-zinc-400 text-sm font-medium leading-relaxed mb-6">{message}</p>

                {children}

                <div className="space-y-3">
                    <button
                        onClick={() => { onConfirm(); onClose(); }}
                        className={`w-full font-black text-sm uppercase tracking-wide py-4 rounded-xl transition-all shadow-lg active:scale-95 ${accentColor}`}
                    >
                        {confirmText}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-3 text-zinc-500 hover:text-zinc-300 text-xs font-bold uppercase tracking-widest transition"
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
};
