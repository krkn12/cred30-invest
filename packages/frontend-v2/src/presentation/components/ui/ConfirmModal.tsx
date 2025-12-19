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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-3 sm:p-4 animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-surface border border-surfaceHighlight rounded-2xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-[92vw] sm:max-w-sm relative shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
                <button title="Fechar" onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 p-1.5 rounded-full z-10"><XIcon size={20} /></button>

                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${iconColor} bg-zinc-800/50`}>
                    <AlertTriangle size={24} />
                </div>

                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-6">{message}</p>

                {children}

                <div className="space-y-2">
                    <button
                        onClick={() => { onConfirm(); onClose(); }}
                        className={`w-full font-bold py-3 rounded-xl transition shadow-lg ${accentColor}`}
                    >
                        {confirmText}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-3 text-zinc-500 hover:text-white text-sm font-medium transition"
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
};
